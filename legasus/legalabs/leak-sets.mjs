// DID ANY WRONG DOMAIN SURVIVE VERIFICATION, in the set family?
//
// The requested domains are finite sets, so "does this realization mean the requested set" can be
// answered by EXECUTION rather than by parsing the guard - which is the point, because the guards include
// forms no parser here reads: or-chains, `n % 2 == 0`, `n in range(4, 7)`.
//
// THIS SCRIPT'S FIRST VERSION REPORTED ZERO LEAKS WHILE EVERY EVALUATION THREW. The recorded condition is
// stored without its `if` and colon, so the generated probe program was a syntax error every time, the
// result was null, the `continue` skipped it, and every transaction fell into the "all correct" bucket by
// default. It printed exactly the answer I was hoping for. So:
//
//     EVERY EVALUATION IS COUNTED, and the run REFUSES to report if any of them failed.
//
// A checker that cannot distinguish "nothing was wrong" from "nothing was checked" is not a checker.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { makeTally, observed, unobservable, finding, conclude } from './nonvacuity.mjs';

const FILE = process.argv[2] || 'measurements/2026-09-19-set-domains/RESULT.json';
const NL = String.fromCharCode(10);

// The requested domain of each operation, as the plan holds it, restricted to the finite sets.
const WANT = { evens: [2, 4, 6, 8], mid2: [4, 6], four: [4], odds: [1, 5, 7] };
const RANGE = [];
for (let v = -20; v <= 20; v++) RANGE.push(v);

// A FAULT INJECTION, so this script can demonstrate its own refusal rather than asserting it. Run with
// --inject-unobservable and every evaluation fails: the run must then REFUSE to report, not print a clean
// null. Without this, the non-vacuity wiring is a claim about a path nobody has exercised.
const INJECT = process.argv.includes('--inject-unobservable');

// Which values does this guard actually admit? Answered by running it.
function denotes(cond) {
  if (INJECT) throw new Error('injected: evaluation deliberately unavailable');
  const prog = ['def f(n):', '    if ' + cond + ':', '        return True', '    return False', '',
    'import json',
    'print(json.dumps([v for v in range(-20, 21) if f(v)]))'].join(NL);
  const out = execFileSync('python', ['-c', prog], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out);
}

const r = JSON.parse(readFileSync(FILE, 'utf8'));
const cache = new Map();
// The non-vacuity law, mechanized rather than remembered: this tally is what makes a null meaningful.
const tally = makeTally('set-domain leak check');
const failures = [];
let rightTotal = 0; let rightVerified = 0; let wrongTotal = 0; let wrongVerified = 0;
const leaks = [];
const byForm = new Map();

for (const key of Object.keys(r.cells)) {
  const c = r.cells[key];
  for (const row of c.rows) {
    if (!row.assembled) continue;
    let anyWrong = false;
    for (const [id, o] of Object.entries(row.perOp || {})) {
      if (!o.condition || !WANT[id]) continue;
      if (!cache.has(o.condition)) {
        try {
          cache.set(o.condition, denotes(o.condition));
          observed(tally);
        } catch (e) {
          cache.set(o.condition, 'FAILED');
          unobservable(tally, o.condition + '  ->  ' + String(e.message).split(String.fromCharCode(10))[0]);
          failures.push(o.condition);
        }
      }
      const got = cache.get(o.condition);
      // A guard that cannot be evaluated is NOT evidence of correctness. It is a refusal to conclude.
      if (got === 'FAILED') { anyWrong = null; continue; }
      const wrong = JSON.stringify(got) !== JSON.stringify(WANT[id]);
      // Keyed by OPERATION AND CONDITION. Keyed by condition alone, `n == 4` written by `four` (where
      // it is correct) and by `mid2` (where it is wrong) collapse into one row that reports whichever
      // was seen first - and the table then contradicts the aggregate it sits beneath.
      const fk = id + ' | ' + o.condition;
      const f = byForm.get(fk) || { n: 0, v: 0, wrong, id, cond: o.condition };
      f.n++; if (row.verified) f.v++;
      byForm.set(fk, f);
      if (wrong && anyWrong !== null) anyWrong = true;
    }
    if (anyWrong === null) continue;   // undecidable transaction, excluded and counted below
    if (anyWrong) {
      wrongTotal++;
      if (row.verified) {
        wrongVerified++; finding(tally);
        leaks.push({ case: c.case, model: c.model, codes: row.codes });
      }
    }
    else { rightTotal++; if (row.verified) rightVerified++; }
  }
}

console.log('  SOURCE: ' + FILE);
console.log('');

// COVERAGE FIRST, CONCLUSION SECOND. The other order invites reading a clean number before checking
// whether it could have been dirty, which is exactly how this script's first version misled me.
const verdict = conclude(tally, {
  clean: 'ZERO LEAKS. Every wrong domain was rejected, and no detector was written for any of them.',
  dirty: (n) => n + ' LEAK(S) - the gap-probe argument is wrong and must be withdrawn.',
});
console.log(verdict.text);
if (!verdict.ok) {
  console.log('');
  console.log('  Failing forms:');
  for (const f of [...new Set(failures)].slice(0, 10)) console.log('    ' + f);
  process.exit(1);
}

console.log('');
console.log('  DOMAIN CORRECTNESS BY EXECUTION');
console.log('    every realization denotes the requested set   ' + rightTotal
  + '   verified ' + rightVerified
  + (rightTotal ? '  (' + (100 * rightVerified / rightTotal).toFixed(1) + '%)' : ''));
console.log('    at least one WRONG domain                    ' + wrongTotal
  + '   verified ' + wrongVerified);

console.log('');
console.log('  BY FORM  (transactions containing it)');
const rows = [...byForm.entries()].filter(([, f]) => f.n >= 4)
  .sort((a, b) => b[1].n - a[1].n);
for (const [, f] of rows) {
  console.log('    ' + String(f.n).padStart(4) + 'x  verified ' + String(f.v).padStart(3)
    + '  ' + (f.wrong ? 'WRONG DOMAIN  ' : 'correct       ') + String(f.id).padEnd(6) + '  ' + f.cond);
}
