/**
 * stage2Controls.test.mjs — AUDIT-2 stage 2. Five candidates through the ACTUAL runner, each of which
 * must succeed or fail FOR ITS INTENDED REASON.
 *
 *   node server/stage2Controls.test.mjs
 *
 * A verdict reached for the wrong reason fails this stage. That distinction is the whole point: a suite
 * can show every control landing on the right side while one of them gets there by accident, and the
 * first fresh page then behaves in a way nothing predicted.
 *
 *   correct          reaches RETAIN with the protected set passing
 *   inert            REJECTED because the addition fails, with carried-forward behaviour intact
 *   regression       REJECTED because it BREAKS carried-forward behaviour, then RESTORED with
 *                    byte-identity evidence against the start commit - not a disposition label
 *   wrong-language   REFUSED at containment as WRONG_SLOT_LANGUAGE, and never spliced into the page
 *   out-of-scope     truncated at the point it leaves its slot, and the out-of-scope text NEVER
 *                    reaches the page
 *
 * Every arm runs `managerRun.mjs` as a child process against a scripted backend, so the real observer,
 * planner, containment, gate and acceptance all run and only the model's answer is fixed. $0.
 */
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const NL = String.fromCharCode(10);
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const ITEMS = ['apple', 'apricot', 'banana', 'cherry', 'date'];
const BASE = `<!DOCTYPE html><html><body>
<h1>Fruit</h1>
<input type="text" id="filter" placeholder="filter">
<ul id="list">${ITEMS.map((x) => `<li class="item">${x}</li>`).join('')}</ul>
<script>
const input = document.getElementById('filter');
const items = Array.from(document.querySelectorAll('#list .item'));
function applyFilter() {
  const q = input.value.toLowerCase();
  items.forEach((li) => { li.style.display = li.textContent.toLowerCase().includes(q) ? '' : 'none'; });
}
input.addEventListener('input', applyFilter);
</script></body></html>`;

const CORRECT = `
const b = document.createElement('button');
b.id = 'clear-filter';
b.textContent = 'Clear';
document.body.appendChild(b);
b.addEventListener('click', () => { input.value = ''; applyFilter(); });`;

const INERT = `
const b = document.createElement('button');
b.id = 'clear-filter';
b.textContent = 'Clear';
document.body.appendChild(b);
b.addEventListener('click', () => { const intended = ''; });`;

// Creates the control AND destroys the list the carried-forward checks depend on.
const REGRESSION = `
const b = document.createElement('button');
b.id = 'clear-filter';
document.body.appendChild(b);
items.forEach((li) => li.remove());`;

const WRONG_LANGUAGE = `<button id="clear-filter">Clear</button>
<script>document.getElementById('clear-filter').onclick = function () { input.value = ''; applyFilter(); };</script>`;

// One legitimate statement, then a closing brace it never opened, then an edit outside the slot. The
// marker below must never appear in any candidate written to disk.
const OUT_OF_SCOPE_MARKER = 'OUT_OF_SCOPE_WIPE';
const OUT_OF_SCOPE = `
const b = document.createElement('button');
});
document.body.innerHTML = '${OUT_OF_SCOPE_MARKER}';`;

function scriptedBackend(completion) {
  return new Promise((done) => {
    const srv = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ response: completion, done: true, done_reason: 'stop', eval_count: 40, prompt_eval_count: 300 }));
      });
    });
    srv.listen(0, '127.0.0.1', () => done({ srv, port: srv.address().port }));
  });
}

async function arm(completion) {
  const dir = mkdtempSync(join(tmpdir(), 's2-'));
  const { srv, port } = await scriptedBackend(completion);
  try {
    writeFileSync(join(dir, 'baseline-as-delivered.html'), BASE, 'utf8');
    await exec(process.execPath, ['server/emitTaskAuto.mjs', '--dir', dir],
      { cwd: process.cwd(), windowsHide: true, maxBuffer: 20e6 });
    const outFile = join(dir, 'run.json');
    await exec(process.execPath, ['server/managerRun.mjs', '--dir', dir, '--out', outFile,
      '--model-url', `http://127.0.0.1:${port}`, '--seeds', '1', '--max-rounds', '1'],
      { cwd: process.cwd(), windowsHide: true, maxBuffer: 20e6 }).catch(() => {});
    const run = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : null;
    const task = JSON.parse(readFileSync(join(dir, 'task.json'), 'utf8'));
    // Everything the run wrote to disk, so "never reached the page" is checked rather than asserted.
    const corpusDir = outFile.replace(/\.json$/, '') + '.attempts';
    let written = '';
    const writtenFiles = [];
    if (existsSync(corpusDir)) {
      const { readdirSync } = await import('node:fs');
      for (const f of readdirSync(corpusDir)) {
        const text = readFileSync(join(corpusDir, f), 'utf8');
        written += text;
        writtenFiles.push({ name: f, text });
      }
    }
    return { run, task, written, writtenFiles, attempt: run && run.attempts[0] };
  } finally {
    try { srv.close(); } catch { /* best effort */ }
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

// ══ 1. correct ══════════════════════════════════════════════════════════════════════════════════
console.log('\n1. correct - reaches RETAIN, and for the right reason');
const c = await arm(CORRECT);
say(c.attempt && c.attempt.outcome === 'ACCEPTED', `outcome ACCEPTED (${c.attempt && c.attempt.outcome})`);
say(c.attempt && c.attempt.acceptance.disposition === 'RETAIN', `disposition RETAIN (${c.attempt && c.attempt.acceptance.disposition})`);
say(c.attempt && c.attempt.acceptance.survivingWorkspaceVerdict.protected === 'PASS', 'the protected set PASSES');
const addSteps = c.task.provenance.additionSteps;
say(addSteps.every((n) => (c.attempt.play.passing || []).includes(n)), `and it passes because every addition check passed (${addSteps.join(',')})`);

// ══ 2. inert ════════════════════════════════════════════════════════════════════════════════════
console.log('\n2. inert - rejected because the ADDITION failed, not because anything broke');
const i = await arm(INERT);
say(i.attempt && i.attempt.outcome === 'REJECTED', `outcome REJECTED (${i.attempt && i.attempt.outcome})`);
say(i.attempt && i.attempt.classification.mismatch === 'NOTHING_WORKED',
  `classified NOTHING_WORKED (${i.attempt && i.attempt.classification.mismatch}) - the reason is a failed addition`);
say(i.attempt && i.attempt.classification.carriedForward.broken.length === 0, 'and NOTHING carried forward broke');
say(i.attempt && i.attempt.acceptance.disposition === 'PRESERVE_INCOMPLETE',
  `disposition PRESERVE_INCOMPLETE (${i.attempt && i.attempt.acceptance.disposition}) - nothing to restore`);

// ══ 3. regression ═══════════════════════════════════════════════════════════════════════════════
console.log('\n3. regression - rejected because it BROKE something, and restored on evidence');
const r = await arm(REGRESSION);
say(r.attempt && r.attempt.outcome !== 'ACCEPTED', `not accepted (${r.attempt && r.attempt.outcome})`);
say(r.attempt && r.attempt.classification.mismatch === 'BROKE_WHAT_WORKED',
  `classified BROKE_WHAT_WORKED (${r.attempt && r.attempt.classification.mismatch}) - a different reason from the inert arm`);
say(r.attempt && r.attempt.classification.carriedForward.broken.length > 0,
  `naming what broke (${r.attempt && r.attempt.classification.carriedForward.broken.join(',')})`);
say(r.attempt && r.attempt.acceptance.disposition === 'RESTORED', `disposition RESTORED (${r.attempt && r.attempt.acceptance.disposition})`);
say(r.attempt && r.attempt.acceptance.survivingBytes === 'IDENTICAL_TO_START',
  `with BYTE-IDENTITY EVIDENCE against the start commit, not a label (${r.attempt && r.attempt.acceptance.survivingBytes})`);
say(r.attempt && typeof r.attempt.preserved === 'string' && /survivingBytes/.test(r.written),
  'and that evidence is carried into the corpus, where an interrupted run would leave it as the only record');

// ══ 4. wrong language ═══════════════════════════════════════════════════════════════════════════
console.log('\n4. wrong language - refused at containment, never spliced');
const w = await arm(WRONG_LANGUAGE);
say(w.attempt && w.attempt.outcome === 'REFUSED_WRONG_SLOT_LANGUAGE',
  `outcome ${w.attempt && w.attempt.outcome} - refused by NAME, not as a generic failure`);
say(w.attempt && !w.attempt.transformedCandidate, 'it never became a candidate at all');
say(w.attempt && !w.attempt.play, 'so the gate never ran on it - nothing was spliced to run against');
say(w.run && w.run.accepted === false, 'and the run reports no accepted addition');

// ══ 5. out of scope ═════════════════════════════════════════════════════════════════════════════
console.log('\n5. out-of-scope edit - truncated at the escape, and it never reaches the page');
const o = await arm(OUT_OF_SCOPE);
const kept = o.attempt && (o.attempt.transformedCandidate || {}).text;
say(!!o.attempt, 'an attempt was recorded');
say(o.attempt && o.attempt.outcome !== 'ACCEPTED', `not accepted (${o.attempt && o.attempt.outcome})`);
say(!kept || !kept.includes(OUT_OF_SCOPE_MARKER), 'the out-of-scope statement is NOT in the contained text');
// The previous version of this line ended in `|| true`, which makes an assertion that cannot fail -
// the [].every() class. What it has to check is that the marker survives ONLY in the preserved raw
// completion, and appears in no contained text and no candidate file.
const perFile = (() => {
  const out = { rawOnly: 0, contained: 0, candidate: 0 };
  for (const blob of o.writtenFiles) {
    if (blob.name.endsWith('.html')) { if (blob.text.includes(OUT_OF_SCOPE_MARKER)) out.candidate++; continue; }
    const j = JSON.parse(blob.text);
    if (((j.completion || {}).text || '').includes(OUT_OF_SCOPE_MARKER)) out.rawOnly++;
    if (((j.contained || {}).text || '').includes(OUT_OF_SCOPE_MARKER)) out.contained++;
  }
  return out;
})();
say(perFile.candidate === 0, `the marker is in ZERO candidate files written to disk (${perFile.candidate})`);
say(perFile.contained === 0, `and in ZERO contained texts (${perFile.contained})`);
say(perFile.rawOnly > 0, `while the raw completion that contained it IS preserved for study (${perFile.rawOnly})`);
const spliced = (o.written.match(/OUT_OF_SCOPE_WIPE/g) || []).length;
say(o.attempt && (o.attempt.extraction || {}).truncatedAtLine !== null || o.attempt.outcome.startsWith('REFUSED'),
  `it was truncated at the escape point or refused outright (${o.attempt && ((o.attempt.extraction || {}).truncatedAtLine ?? o.attempt.outcome)})`);
say(spliced <= 1, `the marker appears only in the preserved raw completion, never in a spliced candidate (${spliced} occurrence(s) on disk)`);

console.log(`\n  stage 2 controls: ${passed} passed, ${failed} failed -> ${failed ? 'THE APPARATUS IS NOT VALIDATED' : 'every control succeeds or fails for its intended reason'}`);
process.exit(failed ? 1 : 0);
