/**
 * repairLoop.test.mjs - prove the repair loop's mechanics before any of it costs money.
 *
 *   node server/repairLoop.test.mjs
 *
 * The loop's value depends entirely on properties that can be checked with a scripted model:
 *
 *   1. a CORRECT repair, proposed in the loop's own edit format, reaches RETAIN. Without this the
 *      experiment could not succeed even if the model were perfect.
 *   2. the evidence handed to the model is MACHINE-CAPTURED and contains none of my analysis: the
 *      real error string appears, and the words that would give the answer away do not.
 *   3. a non-applicable edit is counted as a round and changes nothing on disk.
 *   4. a repair that breaks the protected behaviour is rolled back, and the next round continues
 *      from the restored file rather than from the damage.
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, rmSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = join(HERE, '..', 'legasus', 'screen');
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

// The defect in arm B seed 3, as the model wrote it.
const BROKEN = [
  "        document.getElementById('plant').addEventListener('click', () => {",
  '            if (inventory.seeds > 0) {',
  '                plantSeed();',
  '                inventory.seeds--;',
  '            }',
  '        });',
].join('\n');

// A correct repair: bind the key the contract names, and spend the seed only when a tile appears.
const FIXED = [
  "        document.addEventListener('keydown', (e) => {",
  "            if (e.key !== 'p') return;",
  '            const k = `${player.x},${player.y}`;',
  '            if (!tiles[k] && inventory.seeds > 0) {',
  "                tiles[k] = { crop: 'wheat', stage: 0 };",
  '                inventory.seeds--;',
  '            }',
  '        });',
].join('\n');

const block = (find, replace) => ['<<<<<<< FIND', find, '=======', replace, '>>>>>>> END'].join('\n');

/** A fake ollama that answers each round from a script and records the prompts it was given. */
function fakeModel(replies) {
  const seen = [];
  const srv = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      try { seen.push(JSON.parse(body)); } catch { seen.push(null); }
      const reply = replies[Math.min(seen.length - 1, replies.length - 1)];
      res.writeHead(200, { 'content-type': 'application/x-ndjson' });
      res.end(JSON.stringify({ model: 'fake', message: { role: 'assistant', content: reply }, done: true, done_reason: 'stop', eval_count: 50, prompt_eval_count: 900 }) + '\n');
    });
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port, seen })));
}

/**
 * The whole injected region of the candidate, as one FIND. A repair that replaces only the first
 * invented listener still throws on the second, so the scripted correct repair has to replace the
 * lot - which is what a real correct repair would do.
 */
function injectedRegion(candidateFile) {
  const text = JSON.parse(readFileSync(candidateFile, 'utf8')).candidate.text;
  // Anchor on the FIRST INVENTED listener, not on the first getElementById in the file: the page's
  // own draw() contains `document.getElementById('day')`, and anchoring there swallowed movePlayer
  // and plantSeed into the FIND, which is why the first version of this fixture failed.
  const from = text.indexOf("        document.getElementById('plant')");
  const last = text.lastIndexOf("document.getElementById('load')");
  const eol = text.indexOf(String.fromCharCode(10), last);
  if (from === -1 || last === -1) throw new Error('the candidate does not have the expected invented listeners');
  return text.slice(from, eol);
}

async function run(label, replies, candidate = join(SCREEN, 'MODEL-CMP-1_armB_seed3.json'), rounds = 3, extra = []) {
  const { srv, port, seen } = await fakeModel(replies);
  const dir = mkdtempSync(join(tmpdir(), `rl-${label}-`));
  const out = join(dir, 'r.json');
  await new Promise((resolve) => {
    const p = spawn(process.execPath, [join(HERE, 'repairLoop.mjs'), '--model-url', `http://127.0.0.1:${port}`,
      '--model', 'fake', '--task', 'farm-plant', '--candidate', candidate, '--max-rounds', String(rounds),
      '--seed', '1', '--out', out, ...extra], { stdio: ['ignore', 'pipe', 'pipe'] });
    let o = ''; p.stdout.on('data', (d) => { o += d; }); p.stderr.on('data', (d) => { o += d; });
    p.on('exit', () => { console.log(o.split('\n').filter(Boolean).map((l) => '        ' + l).join('\n')); resolve(); });
  });
  srv.close();
  const rec = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null;
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  return { rec, seen };
}

console.log('=== 1. a CORRECT repair, in the loop\'s own format, reaches RETAIN ===');
{
  const { rec, seen } = await run('good', [block(injectedRegion(join(SCREEN, 'MODEL-CMP-1_armB_seed3.json')), FIXED)]);
  say(rec?.rounds?.[0]?.round === 0 && rec.rounds[0].diagnosis.failureClass === 'RUNTIME_EXCEPTION_AT_LOAD',
    `round 0 classifies the untouched candidate as a load-time exception (${rec?.rounds?.[0]?.diagnosis?.failureClass})`);
  say(rec?.accepted === true && rec.finalDisposition === 'RETAIN', `the repaired page is ACCEPTED (${rec?.finalDisposition})`);
  say(JSON.stringify(rec?.finalPlay) === JSON.stringify([1, 2, 3, 4, 5, 6]), `and passes all six steps (${JSON.stringify(rec?.finalPlay)})`);
  say(rec?.totals?.repairRounds === 1, `it took ${rec?.totals?.repairRounds} repair round(s), counted`);

  // ── the evidence audit: what was the model actually told, BEYOND the file itself? ──
  // The candidate's own code contains `getElementById` and `keydown`, so searching the whole
  // prompt for those words proves nothing - it flags the file. The audit therefore removes the
  // file text and the task's own contract, and inspects only what the harness ADDED.
  const prompt = JSON.stringify(seen[0]?.messages || []);
  say(/Cannot read properties of null/.test(prompt), 'the evidence contains the REAL captured error string');
  say(/window\.game/.test(prompt), 'and the declared interface contract');
  const candidateText = JSON.parse(readFileSync(join(SCREEN, 'MODEL-CMP-1_armB_seed3.json'), 'utf8')).candidate.text;
  let added = prompt;
  for (const line of candidateText.split('\n')) {
    const t = line.trim();
    if (t.length > 8) added = added.split(JSON.stringify(t).slice(1, -1)).join(' ');
  }
  const leaks = ['keydown', 'getElementById', 'button', 'does not exist', 'decrement', 'guard', 'rewire', 'null check'];
  const found = leaks.filter((w) => new RegExp(w, 'i').test(added));
  say(found.length === 0, `and NONE of my analysis in what the harness ADDED: no ${leaks.join(', ')}${found.length ? ' -- LEAKED: ' + found.join(', ') : ''}`);
}

console.log('\n=== 2. a non-applicable edit is a counted round that changes nothing ===');
{
  const { rec } = await run('badfind', [block('a line that is nowhere in the file', 'x')], undefined, 2);
  const r1 = rec?.rounds?.find((r) => r.round === 1);
  say(r1?.outcome === 'EDIT_NOT_APPLICABLE', `the round is recorded as EDIT_NOT_APPLICABLE (${r1?.outcome})`);
  say(r1?.applyResults?.[0]?.status === 'NOT_FOUND', 'with the reason named');
  say(rec?.totals?.repairRounds === 2, `and it still counts toward the budget (${rec?.totals?.repairRounds} rounds used)`);
  say(rec?.accepted === false, 'nothing was accepted');
}

console.log('\n=== 3. a repair that breaks the protected behaviour is rolled back ===');
{
  // Remove the movement wiring: the protected steps must fail and the policy must restore.
  const DESTROY = block("        document.addEventListener('keydown', movePlayer);", '        // movement removed');
  const { rec } = await run('destroy', [DESTROY, block(injectedRegion(join(SCREEN, 'MODEL-CMP-1_armB_seed3.json')), FIXED)], undefined, 2);
  const r1 = rec?.rounds?.find((r) => r.round === 1);
  say(r1?.disposition === 'RESTORED' || r1?.disposition === 'NO_VERIFIED_BASELINE',
    `the damaging repair is not kept (${r1?.disposition})`);
  say(r1?.workingCopy?.startsWith('reverted'), `the damaging round is REVERTED rather than built on (${r1?.workingCopy})`);
  const r2 = rec?.rounds?.find((r) => r.round === 2);
  say(!!r2, 'the loop continues to a further round');
  say(r2?.outcome === 'ACCEPTED' || r2?.blocks > 0, 'and round 2 can still edit the candidate, because the repair subject survived the revert');
}

console.log('\n=== 4. an identical reply ends the loop instead of being paid for again ===');
{
  // REPAIR-1 sent the same evidence over the same file three times and got the same refused patch
  // three times. Either a repeated (file, evidence) pair or a repeated reply must stop the loop.
  const { rec } = await run('norepeat', [block('a line that is nowhere in the file', 'x')], undefined, 3);
  const stopped = rec?.rounds?.find((r) => r.outcome === 'NO_NEW_INFORMATION');
  say(!!stopped, `the loop stops itself with NO_NEW_INFORMATION (round ${stopped?.round})`);
  say(rec?.totals?.repairRounds < 3, `and does not spend the full budget (${rec?.totals?.repairRounds} rounds, not 3)`);
  say(/identical|already sent/.test(stopped?.reason || ''), `with the reason recorded: ${JSON.stringify((stopped?.reason || '').slice(0, 60))}`);
}

console.log('\n=== 5. the original text, the applied diff and the match rule are all retained ===');
{
  const { rec } = await run('retain', [block(injectedRegion(join(SCREEN, 'MODEL-CMP-1_armB_seed3.json')), FIXED)], undefined, 1);
  const r1 = rec?.rounds?.find((r) => r.round === 1);
  say(!!rec?.originalCandidate?.sha256 && rec.originalCandidate.chars > 1000, 'the ORIGINAL candidate is retained with its sha256');
  say(!!r1?.before?.sha256, 'the text before the round is retained with its sha256');
  say(/^@@ line \d+: -\d+ \+\d+ @@/.test(r1?.appliedDiff || ''), `the applied diff is retained (${(r1?.appliedDiff || '').split('\n')[0]})`);
  say(/exactly ONCE/.test(r1?.matchRule || '') && /no guessing|No similarity/i.test(r1?.matchRule || ''),
    'the match rule is recorded, including that nothing is guessed');
}

console.log('\n=== 6. the DOM evidence mode adds only facts read off the page ===');
{
  const { rec, seen } = await run('domev', [block('a line that is nowhere in the file', 'x')], undefined, 1, ['--evidence', 'dom']);
  const prompt = JSON.stringify(seen[0]?.messages || []);
  say(rec?.evidenceMode === 'dom' && rec?.assistance?.domFactsSupplied === true, 'the record says DOM facts were supplied');
  // The prompt is inspected as JSON, so an embedded quote arrives as a backslash-quote pair. Match
  // the id with the escaping allowed for, not against it.
  say(/lookups returned nothing.{0,20}plant/.test(prompt), 'the failing selector is named');
  say(/ids the document contained at that moment/.test(prompt) && /gameCanvas/.test(prompt), 'the ids present at the failure are given');
  say(/once it has finished loading/.test(prompt) && /readyState complete/.test(prompt),
    'and the ids present AFTER readiness, with the readyState - the fact that separates "not yet" from "not at all"');
  const leaks = ['does not exist', 'never exists', 'no such button', 'keydown', 'decrement', 'rewire'];
  const candidateText = JSON.parse(readFileSync(join(SCREEN, 'MODEL-CMP-1_armB_seed3.json'), 'utf8')).candidate.text;
  let added = prompt;
  for (const line of candidateText.split('\n')) {
    const t = line.trim();
    if (t.length > 8) added = added.split(JSON.stringify(t).slice(1, -1)).join(' ');
  }
  const found = leaks.filter((w) => new RegExp(w, 'i').test(added));
  say(found.length === 0, `and still none of my analysis${found.length ? ' -- LEAKED: ' + found.join(', ') : ''}`);
}

console.log('\n=== 7. the second check runs AFTER the loop and decides nothing ===');
{
  // A candidate that passes the old six-step gate must not be reported as a working repair while it
  // still throws during movement. So the stricter spec is measured afterwards, on the file the loop
  // ended with, and is kept out of the evidence, the revert rule and the acceptance decision.
  const { rec, seen } = await run('postcheck', [block(injectedRegion(join(SCREEN, 'MODEL-CMP-1_armB_seed3.json')), FIXED)],
    undefined, 1, ['--post-check', 'farm-plant-v2']);
  say(rec?.accepted === true, `the loop's own gate (farm-plant, 6 steps) accepted the repair (${rec?.finalDisposition})`);
  say(rec?.postCheck?.task === 'farm-plant-v2' && rec.postCheck.appliedAfterTheLoop === true, 'the second check ran, and is marked as applied after the loop');
  say(rec?.postCheck?.fedBackToTheModel === false && rec.postCheck.influencedAcceptance === false, 'and is marked as having fed back nothing and decided nothing');
  say([...(rec?.postCheck?.failing || [])].includes(7) && rec.postCheck.errorsRaised > 0,
    `the SAME file fails the stricter spec's new step with ${rec?.postCheck?.errorsRaised} errors raised - so "accepted" here is not "error-free"`);
  const prompt = JSON.stringify(seen.map((x) => x?.messages || []));
  say(!/no page or console error may be raised/i.test(prompt), 'the stricter requirement never appeared in anything the model was told');
}

console.log(`\n  repair loop: ${passed} passed, ${failed} failed -> ${failed ? 'THE LOOP IS NOT ESTABLISHED' : 'a correct repair reaches RETAIN, the evidence carries no human analysis, and damage is rolled back between rounds'}`);
process.exit(failed ? 1 : 0);
