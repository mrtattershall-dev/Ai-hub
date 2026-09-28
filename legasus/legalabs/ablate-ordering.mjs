// THE ABLATION — is DECIDE's ordering load-bearing, or is it decoration that happens to agree?
//
// R4 and T3 both returned P(correct | assembled) = 1.000 with ZERO probe failures and ZERO dead
// operations, across two and three operations and three capacities. The transaction verifier has never
// fired in anger, and 343 authorized fragments in T3 contained NOT ONE domain other than the requested
// one. My preregistered prediction that it would fire at 1.5B is falsified.
//
// That leaves two readings, and they are not the same claim:
//
//   A  the ordering is doing real work, and the verifier is a safety net that correctly never fires
//   B  the ordering is decoration; these transactions would have been fine in any order
//
// A perfect score cannot distinguish them. An ABLATION can, and it costs no GPU time: the fragments
// are already on disk. Re-assemble the SAME model outputs in PRESENTATION order instead of the derived
// order and re-verify. Same fragments, same verifier, same probes - one stage disabled.
//
// This is the first live exercise the transaction verifier has ever had. If it stays silent here too,
// reading B survives and the ordering machinery has no measured value.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transactionProbes, reachability } from '../legaverify/transaction.mjs';
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

function verify(reqs, order, codes) {
  const probes = transactionProbes({ requested: reqs, order, preserved: PRESERVED,
    preservedWins: true, existing: [{ domain: PRESERVED }] }, original);
  const res = runProgram(assemble(order, codes), probes.map((p) => p.input));
  if (!res) return { verified: false, failures: [{ why: 'did not load' }], dead: [] };
  const failures = probes.filter((p) => res.get(p.input) !== p.expected);
  const reach = reachability({ requested: reqs, order, preserved: PRESERVED, preservedWins: true });
  return { verified: failures.length === 0 && reach.allReachable, failures, dead: reach.dead };
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
  const t = tally[caseName] = tally[caseName] || { assembled: 0, derivedOk: 0, presentedOk: 0,
    presentedDead: 0, presentedProbe: 0, deadNames: {} };
  for (const row of cell.rows) {
    if (!row.assembled || !row.codes) continue;
    t.assembled++;
    if (row.verified) t.derivedOk++;
    const v = verify(reqs, presented, row.codes);
    if (v.verified) t.presentedOk++;
    else if (v.dead.length) { t.presentedDead++; for (const d of v.dead) t.deadNames[d] = (t.deadNames[d] || 0) + 1; }
    else t.presentedProbe++;
  }
  t.derived = derived; t.presented = presented;
}

console.log('  ABLATION - the SAME model outputs, re-assembled in PRESENTATION order');
console.log('  no GPU time: every fragment replayed is already on disk');
console.log('');
let A = 0; let D = 0; let P = 0;
for (const [name, t] of Object.entries(tally)) {
  console.log('  ' + name);
  console.log('      derived order    ' + t.derived.join(' then '));
  console.log('      presented order  ' + t.presented.join(' then '));
  console.log('      assembled ' + t.assembled
    + '   verified under DERIVED ' + t.derivedOk
    + '   verified under PRESENTED ' + t.presentedOk
    + '   dead-op ' + t.presentedDead + '   probe-fail ' + t.presentedProbe);
  if (Object.keys(t.deadNames).length) {
    console.log('      operations killed by the presentation order: '
      + Object.entries(t.deadNames).map(([k, n]) => k + ' x' + n).join(', '));
  }
  A += t.assembled; D += t.derivedOk; P += t.presentedOk;
}
console.log('');
console.log('  TOTAL  assembled ' + A + '   verified under DERIVED ' + D
  + '   verified under PRESENTED ' + P);
console.log('');
console.log('  A verifier that stays silent under the ablation would show the ordering is decoration.');
console.log('  One that fires here and nowhere else shows it is load-bearing, and gives the');
console.log('  transaction verifier the live evidence a perfect score cannot supply.');
