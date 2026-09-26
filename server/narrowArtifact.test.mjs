/**
 * narrowArtifact.test.mjs - the narrow-artifact harness measures the boundary the failure sits
 * at. Five scripted replies, one per boundary, through the real harness, the real play, the
 * real evaluator and the real acceptance policy. A measurement that cannot fail is not a
 * measurement, so every boundary is shown failing as well as passing.
 *
 *   node server/narrowArtifact.test.mjs
 *
 *   1. a clean fence with a page that satisfies increment 1  -> every boundary YES, RETAIN
 *   2. prose only, no fence                                   -> B1 no, nothing written
 *   3. a fence that never closes (token ceiling)              -> B1 yes, B2 no, nothing written
 *   4. prose AND a good fence                                 -> B3 no; strict not accepted,
 *                                                                lenient accepted (both recorded)
 *   5. a clean fence with a page that throws on load          -> B4 yes, B5 no, not accepted
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const { extractArtifact } = await import('./narrowArtifact.mjs').catch(() => ({ extractArtifact: null }));
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const FARM = join(HERE, '..', 'legasus', 'bench', 'farm');
const GOOD = readFileSync(join(FARM, 'controls', 'positive', 'index.html'), 'utf8');
const THROWS = readFileSync(join(FARM, 'controls', 'negative-throws', 'index.html'), 'utf8');

/** A fake ollama: streams a chosen reply as NDJSON with a chosen done_reason. */
function fakeOllama(reply, doneReason = 'stop') {
  return new Promise((resolve) => {
    const srv = createServer((req, res) => {
      let body = '';
      req.on('data', (d) => { body += d; });
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'application/x-ndjson' });
        const chunks = String(reply).match(/[\s\S]{1,80}/g) || [];
        for (const c of chunks) res.write(JSON.stringify({ model: 'fake', message: { role: 'assistant', content: c }, done: false }) + '\n');
        res.end(JSON.stringify({ model: 'fake', message: { role: 'assistant', content: '' }, done: true, done_reason: doneReason, eval_count: 42, prompt_eval_count: 300 }) + '\n');
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

async function run(label, reply, doneReason) {
  const { srv, port } = await fakeOllama(reply, doneReason);
  const dir = mkdtempSync(join(tmpdir(), `na-${label}-`));
  const out = join(dir, 'result.json');
  await new Promise((resolve) => {
    const p = spawn(process.execPath, [join(HERE, 'narrowArtifact.mjs'), '--model-url', `http://127.0.0.1:${port}`, '--model', 'fake', '--task', 'farm-i1', '--seed', '7', '--deadline-sec', '120', '--out', out], { stdio: ['ignore', 'pipe', 'pipe'] });
    let o = ''; p.stdout.on('data', (d) => { o += d; }); p.stderr.on('data', (d) => { o += d; });
    p.on('exit', () => { console.log(o.split('\n').filter(Boolean).map((l) => '        ' + l).join('\n')); resolve(); });
  });
  srv.close();
  const rec = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null;
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  return rec;
}

console.log('=== extraction, as a unit ===');
{
  const a = extractArtifact('```html\n<p>x</p>\n```');
  say(a.produced && a.complete && a.artifact === '<p>x</p>\n' && a.outside === '' && a.fences === 2, 'a clean fence yields the artifact and nothing outside');
  const b = extractArtifact('Here is the file:\n```html\n<p>x</p>\n```\nHope that helps!');
  say(b.produced && b.complete && b.artifact === '<p>x</p>\n' && /Here is the file/.test(b.outside) && /Hope that helps/.test(b.outside), 'prose before and after is captured as outside, the artifact is still clean');
  const c = extractArtifact('```html\n<p>x</p>\n');
  say(c.produced && !c.complete, 'a fence with no close is produced but INCOMPLETE');
  const d = extractArtifact('I would start by planning the tile grid.');
  say(!d.produced && !d.complete && /planning the tile grid/.test(d.outside), 'prose with no fence produces nothing');
}

console.log('\n=== 1. a clean fence with a page that satisfies increment 1 ===');
{
  const r = await run('good', '```html\n' + GOOD + '\n```', 'stop');
  const b = r?.boundaries || {};
  say(b.artifactProduced && b.artifactComplete && b.contractClean, 'B1-B3: produced, complete, contract clean');
  say(r?.naturalStop === true && r?.terminationReason === 'stop', `terminated naturally (${r?.terminationReason})`);
  say(b.reachedExecution && b.passedDiagnostic && b.passedProtected, 'B4-B6: the page ran, the requested steps passed, nothing protected to break');
  say(b.accepted === true && r?.acceptance?.disposition === 'RETAIN', `B7: accepted (${r?.acceptance?.disposition})`);
  say(JSON.stringify(r?.play?.passing) === '[1,2,3]', `the play judged exactly increment 1's steps (${JSON.stringify(r?.play?.passing)})`);
  say(typeof r?.timing?.firstTokenMs === 'number' && typeof r?.timing?.playMs === 'number' && typeof r?.timing?.acceptanceMs === 'number', 'timing to each boundary was recorded');
}

console.log('\n=== 2. prose only, no fence ===');
{
  const r = await run('prose', 'To build increment 1 I would first outline the tile grid, then add the player.', 'stop');
  const b = r?.boundaries || {};
  say(b.artifactProduced === false, 'B1 fails: no artifact');
  say(b.reachedExecution === undefined && !r.play, 'nothing was executed and no play verdict was invented');
  say(r?.extraction?.outsideChars > 0, `the prose is recorded (${r?.extraction?.outsideChars} chars outside)`);
}

console.log('\n=== 3. a fence that never closes (token ceiling) ===');
{
  const r = await run('trunc', '```html\n' + GOOD.slice(0, 900), 'length');
  const b = r?.boundaries || {};
  say(b.artifactProduced === true && b.artifactComplete === false, 'B1 passes, B2 fails: produced but cut off');
  say(r?.naturalStop === false && r?.terminationReason === 'length', `the reason is the token ceiling, not the model giving up (${r?.terminationReason})`);
  say(!r.play && b.accepted === undefined, 'an incomplete artifact is never written or judged');
}

console.log('\n=== 4. prose AND a good fence: the contract is violated, the file still works ===');
{
  const r = await run('dirty', 'Sure! Here is increment 1:\n```html\n' + GOOD + '\n```\nLet me know if you want the planting next.', 'stop');
  const b = r?.boundaries || {};
  say(b.artifactProduced && b.artifactComplete && b.contractClean === false, 'B3 fails while B1 and B2 pass');
  say(b.passedDiagnostic === true && b.acceptedIfLenient === true && b.acceptedStrict === false, 'lenient would accept it, strict does not - both recorded');
  say(/Sure! Here is increment 1/.test(r?.extraction?.outsideSample || ''), 'the offending prose is quoted in the record');
}

console.log('\n=== 5. a clean fence with a page that throws on load ===');
{
  const r = await run('throws', '```html\n' + THROWS + '\n```', 'stop');
  const b = r?.boundaries || {};
  say(b.artifactProduced && b.artifactComplete && b.contractClean, 'B1-B3 pass: the protocol was obeyed');
  say(b.reachedExecution === true, 'B4 passes: the play ran (a broken page is a verdict, not an apparatus failure)');
  say(b.passedDiagnostic === false && b.accepted === false, `B5 and B7 fail: ${r?.verdict?.requested} / ${r?.acceptance?.disposition}`);
  say((r?.play?.failing || []).length === 3, `all three of increment 1's steps failed (${JSON.stringify(r?.play?.failing)})`);
}

console.log(`\n  narrow artifact: ${passed} passed, ${failed} failed -> ${failed ? 'THE MEASUREMENT IS NOT ESTABLISHED' : 'each boundary passes and fails on its own, and the gate is unchanged'}`);
process.exit(failed ? 1 : 0);
