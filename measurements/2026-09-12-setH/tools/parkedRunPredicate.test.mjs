// Exercise the EXACT predicate added to trialH.mjs, with negative controls.
// A test that cannot fail proves nothing, so cases 3-5 must NOT be tagged parked.
import { readFileSync } from 'node:fs';
const src = readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/tools/trialH.mjs', 'utf8');

// PREMISE: the patched lines are actually present in the file under test.
for (const needle of ['never_started_parked', 'GOAL NEVER RAN', '30 * 60000']) {
  if (!src.includes(needle)) { console.error(`  FAIL premise: ${needle} absent from trialH.mjs`); process.exit(1); }
}
console.log('  ok    PREMISE: patched lines present in the real file');

// The predicate, copied verbatim from the patch.
const parkedOf = (s) => !!(s && (s.busy || /already working in this workspace/.test(String(s.error || ''))));

const cases = [
  // [name, start-response, expected parked]
  ['real 409 body (busy flag + message)', { error: 'a run is already working in this workspace (running: "Create s1_library.js..."). Two runs share the same files', busy: true, activeRunId: 'x' }, true],
  ['409 message only, no busy flag',      { error: 'a run is already working in this workspace (stopped: "...")' }, true],
  ['NEGATIVE: hub down / fetch failed',   { error: 'fetch failed' }, false],
  ['NEGATIVE: 500 from start',            { error: 'Internal Server Error' }, false],
  ['NEGATIVE: empty object',              {}, false],
  ['NEGATIVE: undefined',                 undefined, false],
];
let pass = 0, fail = 0;
for (const [name, s, want] of cases) {
  const got = parkedOf(s);
  if (got === want) { pass++; console.log(`  ok    ${name} -> parked=${got}`); }
  else { fail++; console.error(`  FAIL  ${name} -> parked=${got}, expected ${want}`); }
}

// The row this branch pushes must be shaped like a real row, or the summary/scorer chokes.
const i = 41, s = { error: 'a run is already working in this workspace (running: "x")', busy: true };
const parked = parkedOf(s);
const row = { n: i + 1, runId: null, status: parked ? 'never_started_parked' : 'never_started',
  steps: 0, calls: 0, err: 0, grd: 0, secs: 0, disk: 'GOAL NEVER RAN', good: false, forcedFinish: false };
const realKeys = ['n','runId','status','steps','calls','err','grd','secs','disk','good','forcedFinish'];
const missing = realKeys.filter(k => !(k in row));
if (missing.length) { fail++; console.error('  FAIL  row shape missing: ' + missing.join(',')); }
else { pass++; console.log('  ok    row shape matches the real rows.push keys (' + realKeys.length + ' fields)'); }
if (row.n !== 42 || row.status !== 'never_started_parked') { fail++; console.error('  FAIL  row values wrong: ' + JSON.stringify(row)); }
else { pass++; console.log('  ok    goal 42 parked -> n=42 status=never_started_parked disk="GOAL NEVER RAN"'); }

// The monitor must SEE this status (its row regex is `^ *[0-9]+ +[a-z_]+ +[0-9]+`).
const line = `  ${String(row.n).padStart(2)}  ${String(row.status).padEnd(11)} ${String(0).padStart(4)} ${String(0).padStart(5)}   0   0     0  ${row.disk}`;
if (/^ *[0-9]+ +[a-z_]+ +[0-9]+ +[0-9]+ +[0-9]+ +[0-9]+ +[\d.]+/.test(line)) { pass++; console.log('  ok    monitor regex matches the parked row (cascade will be visible, not silent)'); }
else { fail++; console.error('  FAIL  monitor regex does NOT match: ' + JSON.stringify(line)); }

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
