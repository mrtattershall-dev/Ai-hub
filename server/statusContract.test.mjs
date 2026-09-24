/**
 * statusContract.test.mjs - EVERY EMITTED STATUS HAS A REPORTING CONTRACT.
 *
 *   node server/statusContract.test.mjs
 *
 * Three campaigns in a row generated their report automatically and then reported
 * integrity:false for a status the check did not know about:
 *
 *   ENDURANCE-2   UNATTEMPTED   77 runs flagged for a verdict a never-run task cannot have
 *   (fix)         INTERRUPTED   added at the same time, by hand
 *   BENCH-1       BLOCKED       4 runs flagged - a status added in the SAME SESSION as the check
 *
 * Adding statuses one at a time as they false-alarm is the defect. The set of statuses the
 * batch can emit is read FROM THE SOURCE here, and every one of them must have a contract. A
 * new status added without one fails this test before it can fail a campaign.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const { REQUIRED_FIELDS_BY_STATUS, requiredFieldsFor, recordRun, recordPlan, buildReport } =
  await import('./campaignReport.js');
const { TASK_STATE } = await import('./batch.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);

// ── 1. ENUMERATE EVERY STATUS THE BATCH CAN EMIT, from the source ──
console.log('=== 1. statuses the batch can emit, read from the source ===');
const batchSrc = readFileSync(join(HERE, 'batch.js'), 'utf8');
// (a) the declared TASK_STATE values
const declared = Object.values(TASK_STATE);
// (b) every literal `termination: 'X'` the batch writes
const emittedTerminations = [...new Set([...batchSrc.matchAll(/termination:\s*'([A-Z_]+)'/g)].map((m) => m[1]))];
// (c) every `state: TASK_STATE.X` the batch writes
const emittedStates = [...new Set([...batchSrc.matchAll(/state:\s*TASK_STATE\.([A-Z_]+)/g)].map((m) => TASK_STATE[m[1]]).filter(Boolean))];
const all = [...new Set([...declared, ...emittedTerminations, ...emittedStates])];
say(all.length > 0, `found ${all.length} distinct statuses: ${all.join(', ')}`);
note('Read from batch.js itself, not from a list someone remembered to update.');

// ── 2. EVERY ONE HAS A CONTRACT ──
console.log('\n=== 2. every emitted status has a reporting contract ===');
// Terminal states that are NOT a termination keyword resolve to the COMPLETED contract, which
// is the right default for anything that produced a verdict. The ones that must NOT be held to
// that standard are the ones that never ran.
const neverRan = ['UNATTEMPTED', 'INTERRUPTED', 'BLOCKED'];
for (const s of all) {
  const fields = requiredFieldsFor({ termination: s });
  const owesVerdict = fields.includes('requested');
  if (neverRan.includes(s)) {
    say(!owesVerdict, `${s}: never ran, so it owes NO verdict (fields: ${fields.join(', ')})`);
    say(fields.includes('reason'), `${s}: but it owes a REASON`);
  } else {
    say(owesVerdict, `${s}: produced a verdict, so it owes one (fields: ${fields.length})`);
  }
}
// and the explicit table covers every never-ran status by name, not by fallthrough
for (const s of neverRan) {
  say(Object.prototype.hasOwnProperty.call(REQUIRED_FIELDS_BY_STATUS, s), `${s} is in the contract table by NAME, not by fallthrough`);
}

// ── 3. EACH CONTRACT IS EXERCISED END TO END, both directions ──
console.log('\n=== 3. each contract passes on correct data and fails on incorrect data ===');
const d = mkdtempSync(join(tmpdir(), 'sc-'));
try {
  for (const s of all) {
    const good = join(d, `good-${s}.jsonl`), bad = join(d, `bad-${s}.jsonl`);
    const base = { idx: 1, rep: 1, task: `t-${s}`, arm: 'A', termination: s };
    const full = neverRan.includes(s)
      ? { ...base, reason: 'because' }
      : { ...base, requested: 'PASS', protected: 'PASS', disposition: 'RETAIN', modelCalls: 1, elapsedSec: 1 };
    recordPlan(good, [full.task]); recordRun(good, full);
    const g = buildReport(good);
    say(g.integrity.ok, `${s}: a correctly-recorded run passes integrity`);

    // remove ONE required field and it must be caught
    const req = requiredFieldsFor(full);
    const drop = req.find((f) => !['idx', 'rep', 'task', 'arm', 'termination'].includes(f)) || req[req.length - 1];
    const broken = { ...full }; delete broken[drop];
    recordPlan(bad, [full.task]); recordRun(bad, broken);
    const b = buildReport(bad);
    say(!b.integrity.ok, `${s}: dropping '${drop}' is CAUGHT`);
  }
} finally {
  try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
}

// ── 4. A STATUS WITH NO CONTRACT MUST FAIL THIS TEST, not a campaign ──
console.log('\n=== 4. an unknown status cannot silently inherit a contract ===');
const unknown = requiredFieldsFor({ termination: 'SOME_NEW_STATUS' });
say(unknown === REQUIRED_FIELDS_BY_STATUS.COMPLETED,
  'an unknown status falls to the STRICTEST contract (must produce a verdict), never to a lenient one');
note('So a new never-ran status added without a contract false-alarms HERE, on scripted data,');
note('rather than after a two-hour campaign.');

console.log(`\n  status contracts: ${passed} passed, ${failed} failed -> ${failed ? 'A STATUS CAN STILL FALSE-ALARM A CAMPAIGN' : 'every emitted status has a tested contract'}`);
process.exit(failed ? 1 : 0);
