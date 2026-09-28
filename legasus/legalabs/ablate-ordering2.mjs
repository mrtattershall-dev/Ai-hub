// THE DECIDE ABLATION, RE-AUDITED — because the first version's verdict never looked at the program.
//
// The original ablation returned 105 verified under the derived order and 0 under the presented order,
// and EVERY ONE of the 105 failures was a dead operation with zero probe failures. That is the tell.
// `reachability` takes the requested domains and the order and never sees the emitted code, so its
// verdict is a pure function of (plan, order): identical for every model, every temperature, and every
// realization of the same plan. It cannot vary with what was generated, so on its own it measures the
// apparatus's bookkeeping rather than the artifact.
//
// It also rejects a legitimate alternative, which is the violation that matters here:
//
//     if n == 3:              return "three"
//     if n < 10 and n >= 0:   return "low"
//     if n > 100:             return "high"
//     if n < 0:               return "micro"
//
// Executed, every requested behaviour fires. The planned check calls `micro` dead anyway.
//
// So this re-run asks deadness of the ARTIFACT - an operation is dead when no input produces its
// result - and reports BOTH verdicts side by side. The gap between them is the number of fragments the
// original ablation condemned for a defect their code did not have.
//
//   RESCUED   plan says dead, execution says alive   -> a self-defending realization
//   AGREED    both say dead                          -> genuinely shadowed, the original was right
//
// This does not presume the DECIDE row is wrong. It measures how much of it survives an instrument
// that can admit alternatives.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transactionProbes, reachability, reachabilityExecuted, auditResultLabels }
  from '../legaverify/transaction.mjs';
import { requestedBehaviour } from '../legacore/predicates.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);
const FILE = process.argv[2];
if (!FILE) { console.log('usage: ablate-ordering.mjs <RESULT json>'); process.exit(1); }

const SRC_LINES = ['def classify(n):', '    if n == 3:', '        return "three"', '    return "other"'];
const INSERT_AFTER = 2;
const PRESERVED = { kind: 'point', variable: 'n', value: 3 };

// The deltas, as the harness rendered them. Re-derived here rather than copied as domains, so the
// ablation reads the same specification the run did.
const DELTA = {
  micro: 'For every value below 0, however small, return "micro".',
  low: 'For every value below 10, however small, where n is not 3, return "low".',
  mid: 'For every value below 100, however small, where n is not 3, return "mid".',
  high: 'For every value above 100, however large, return "high".',
};
const RESULT = { micro: 'micro', low: 'low', mid: 'mid', high: 'high' };
// The order each case's operations were PRESENTED in - the ablation's substitute for a derivation.
const PRESENTED = { T3_NESTED: ['mid', 'micro', 'low'], T3_MIXED: ['low', 'high', 'micro'],
  T_CONTAIN: ['small', 'tiny'], T_REVERSE: ['tiny', 'small'], T_DISJOINT: ['tiny', 'big'] };

function reqFor(id) {
  const r = requestedBehaviour(DELTA[id], 'n', { soleParameter: true });
  return { id, domain: r.domain, result: RESULT[id] };
}

function runProgram(program, inputs) {
  const ws = mkdtempSync(join(tmpdir(), 'abl-'));
  writeFileSync(join(ws, 'impl.py'), program + NL, 'utf8');
  writeFileSync(join(ws, 'p.py'), L('import impl',
    ...inputs.map((v, i) => 'print("r' + i + '=" + str(impl.classify(' + v + ')))')), 'utf8');
  try {
    const out = execFileSync('python', ['p.py'], { cwd: ws, encoding: 'utf8', timeout: 15000 });
    const m = new Map();
    inputs.forEach((v, i) => {
      const mm = out.match(new RegExp('^r' + i + '=(.*)$', 'm'));
      m.set(v, mm ? mm[1].trim() : 'MISSING');
    });
    return m;
  } catch (e) { return null; }
}

const origCache = new Map();
const original = (v) => {
  if (!origCache.has(v)) {
    const m = runProgram(SRC_LINES.join(NL), [v]);
    origCache.set(v, m ? m.get(v) : 'ERROR');
  }
  return origCache.get(v);
};

const expand = (code) => {
  const m = String(code).match(/^(if\s.*?:)\s*(return\s.*)$/);
  return m ? '    ' + m[1] + NL + '        ' + m[2] : null;
};

function assemble(order, codes) {
  const body = order.flatMap((id) => expand(codes[id]).split(NL));
  return L(...SRC_LINES.slice(0, INSERT_AFTER + 1), ...body, ...SRC_LINES.slice(INSERT_AFTER + 1));
}

// A sweep dense enough that any live branch fires somewhere. Bounds and their neighbourhoods matter
// most, so they are included explicitly rather than hoping a stride lands on them.
const SWEEP = (() => {
  const vs = new Set();
  for (let v = -100000; v <= 100000; v += 1) { vs.add(v); if (Math.abs(v) > 300) v += 97; }
  for (const b of [-2, -1, 0, 1, 2, 3, 4, 5, 9, 10, 11, 49, 50, 51, 99, 100, 101]) vs.add(b);
  return [...vs];
})();

// THE SECOND HALF OF THE SAME DEFECT. The original ablation recomputed the probe EXPECTATIONS from the
// presented order as well as assembling in it, so the broken program was graded against a broken
// expectation and the probes agreed by construction. That is why probe-fail was 0 and the analytic
// deadness term was the only thing left that could fire.
//
// Ground truth does not move with the treatment. Two requested behaviours whose domains are nested can
// only both be satisfied if the narrower wins where they overlap, whatever order the file is written
// in. So expectations are computed from the DERIVED order always; only the ASSEMBLY changes.
function verify(reqs, derivedOrder, order, codes) {
  const probes = transactionProbes({ requested: reqs, order: derivedOrder, preserved: PRESERVED,
    preservedWins: true, existing: [{ domain: PRESERVED }] }, original);
  const program = assemble(order, codes);
  const res = runProgram(program, probes.map((p) => p.input));
  if (!res) return { verified: false, failures: [{ why: 'did not load' }], dead: [], deadExec: [] };
  const failures = probes.filter((p) => res.get(p.input) !== p.expected);

  const planned = reachability({ requested: reqs, order, preserved: PRESERVED, preservedWins: true });

  // Deadness asked of the artifact: run the assembled program across the sweep and see which results
  // it actually produces.
  const swept = runProgram(program, SWEEP);
  const observed = swept ? new Set([...swept.values()]) : new Set();
  const executed = reachabilityExecuted({ requested: reqs, observed });

  return { failures, dead: planned.dead, deadExec: executed.dead,
    verifiedPlanned: failures.length === 0 && planned.allReachable,
    verified: failures.length === 0 && executed.allReachable };
}

const data = JSON.parse(readFileSync(FILE, 'utf8'));
const tally = {};
for (const [key, cell] of Object.entries(data.cells)) {
  const caseName = cell.case;
  const presented = PRESENTED[caseName];
  if (!presented) continue;
  const derived = cell.order;
  const reqs = presented.map(reqFor);
  if (reqs.some((r) => !r.domain || r.domain.kind === 'unmodelled')) continue;
  const audit = auditResultLabels({ requested: reqs.map((r) => ({ ...r, result: r.result })),
    originalResults: ['three', 'other'] });
  if (!audit.ok) {
    console.log('  REFUSED ' + caseName + ': ' + audit.problems.join('; '));
    continue;
  }
  const t = tally[caseName] = tally[caseName] || { assembled: 0, derivedOk: 0, presentedOk: 0,
    presentedOkPlanned: 0, rescued: 0, agreedDead: 0, presentedProbe: 0, deadNames: {} };
  for (const row of cell.rows) {
    if (!row.assembled || !row.codes) continue;
    t.assembled++;
    if (row.verified) t.derivedOk++;
    const v = verify(reqs, derived, presented, row.codes);
    if (v.verified) t.presentedOk++;
    if (v.verifiedPlanned) t.presentedOkPlanned++;
    const planDead = v.dead.length > 0;
    const execDead = v.deadExec.length > 0;
    if (planDead && !execDead) t.rescued++;
    else if (planDead && execDead) {
      t.agreedDead++;
      for (const d of v.deadExec) t.deadNames[d] = (t.deadNames[d] || 0) + 1;
    }
    if (!execDead && v.failures.length) t.presentedProbe++;
  }
  t.derived = derived; t.presented = presented;
}

console.log('  THE DECIDE ABLATION, RE-AUDITED with deadness measured by EXECUTION');
console.log('  no GPU time: every fragment replayed is already on disk');
console.log('');
let A = 0; let D = 0; let P = 0; let PP = 0; let R = 0;
for (const [name, t] of Object.entries(tally)) {
  console.log('  ' + name);
  console.log('      derived order    ' + t.derived.join(' then '));
  console.log('      presented order  ' + t.presented.join(' then '));
  console.log('      assembled ' + t.assembled + '   verified under DERIVED ' + t.derivedOk);
  console.log('      under PRESENTED   planned-deadness ' + t.presentedOkPlanned
    + '   EXECUTED-deadness ' + t.presentedOk);
  console.log('      RESCUED (plan says dead, execution says alive) ' + t.rescued
    + '   AGREED dead ' + t.agreedDead + '   probe-fail ' + t.presentedProbe);
  if (Object.keys(t.deadNames).length) {
    console.log('      genuinely dead under execution: '
      + Object.entries(t.deadNames).map(([k, n]) => k + ' x' + n).join(', '));
  }
  A += t.assembled; D += t.derivedOk; P += t.presentedOk; PP += t.presentedOkPlanned; R += t.rescued;
}
console.log('');
console.log('  TOTAL  assembled ' + A + '   DERIVED ' + D
  + '   PRESENTED(planned) ' + PP + '   PRESENTED(executed) ' + P + '   rescued ' + R);
console.log('');
console.log('  The rescued count is the number of fragments the original ablation condemned for a');
console.log('  defect their code did not have. If it is 0 the DECIDE row stands as written; if it is');
console.log('  large the row was measuring the plan rather than the program.');
