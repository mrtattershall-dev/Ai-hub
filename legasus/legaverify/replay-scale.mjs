// REPLAY — how many of the scale experiment's leaks would CONTRACT-DERIVED probes have caught?
//
// The scale window's probe set was hand-built, and its two most valuable probes were there by luck: a
// control happened to catch a hole before an earlier window. Those two caught 17 of the 14B's 18
// semantic leaks. This replays every authorized output that run produced - 677 of them, already on
// disk - through probes derived from the CONTRACT instead, and reports the difference.
//
// It costs no GPU time and it is fully replayable, which is the point: the claim "a contract-derived
// verifier is stronger than a regression-derived one" should be checkable against data that already
// exists rather than argued.
//
// THE HONEST COMPARISON. The hand-built set is not a straw man - it was carefully built, and its
// neighbour probes were added deliberately after a control fired. What this measures is whether
// deriving probes from the obligation finds the same failures WITHOUT anyone having to notice them
// first, and whether it finds any the hand-built set still misses.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contractProbes, checkProbes } from './probes.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

const FILES = process.argv.slice(2);
if (!FILES.length) { console.log('usage: replay-scale.mjs <RESULT json> [...]'); process.exit(1); }

const LABEL = { T10_0: 'zero', T10_3: 'three', T20_5: 'five', T0_N2: 'minus two' };

function sourceFor(preserved, label) {
  return L(
    'def classify(n):',
    '    if n == ' + preserved + ':',
    '        return "' + label + '"',
    '    if n > 10000:',
    '        return "enormous"',
    '    if n > 1000:',
    '        return "huge"',
    '    if n > 100:',
    '        return "large"',
    '    return "other"',
  );
}

// The rows store the accepted fragment with whitespace collapsed. The authorized shape is exactly one
// guard and one return, so re-expanding is unambiguous.
function expand(code) {
  const m = String(code).match(/^(if\s.*?:)\s*(return\s.*)$/);
  if (!m) return null;
  return '    ' + m[1] + NL + '        ' + m[2];
}

function programFor(preserved, label, fragment) {
  const lines = sourceFor(preserved, label).split(NL);
  return L(...lines.slice(0, 3), ...fragment.split(NL), ...lines.slice(3));
}

// One python process per program, answering every probe at once.
function runAll(program, inputs) {
  const ws = mkdtempSync(join(tmpdir(), 'replay-'));
  writeFileSync(join(ws, 'impl.py'), program + NL, 'utf8');
  writeFileSync(join(ws, 'p.py'), L('import impl',
    ...inputs.map((v, i) => 'print("r' + i + '=" + str(impl.classify(' + v + ')))')), 'utf8');
  try {
    const out = execFileSync('python', ['p.py'], { cwd: ws, encoding: 'utf8', timeout: 15000 });
    const map = new Map();
    inputs.forEach((v, i) => {
      const m = out.match(new RegExp('^r' + i + '=(.*)$', 'm'));
      map.set(v, m ? m[1].trim() : 'MISSING');
    });
    return map;
  } catch (e) { return null; }
}

const contractFor = (T, P) => ({
  requested: { kind: 'interval', variable: 'n', lo: -Infinity, hi: T, loOpen: true, hiOpen: true },
  requestedResult: 'small',
  preserved: { kind: 'point', variable: 'n', value: P },
  preservedWins: true,
  existing: [
    { domain: { kind: 'point', variable: 'n', value: P } },
    { domain: { kind: 'interval', lo: 10000, hi: Infinity, loOpen: true, hiOpen: true } },
    { domain: { kind: 'interval', lo: 1000, hi: Infinity, loOpen: true, hiOpen: true } },
    { domain: { kind: 'interval', lo: 100, hi: Infinity, loOpen: true, hiOpen: true } },
  ],
});

const cells = {};
for (const f of FILES) Object.assign(cells, JSON.parse(readFileSync(f, 'utf8')).cells);

const perModel = {};
const newlyCaught = {};
for (const [key, cell] of Object.entries(cells)) {
  const model = key.split('|')[0];
  const P = cell.preserved;
  const T = cell.threshold;
  const label = LABEL[cell.task];
  const original = (() => {
    const src = sourceFor(P, label);
    const cache = new Map();
    return (v) => {
      if (!cache.has(v)) {
        const m = runAll(src, [v]);
        cache.set(v, m ? m.get(v) : 'ERROR');
      }
      return cache.get(v);
    };
  })();
  const probes = contractProbes(contractFor(T, P), original);
  const inputs = probes.map((p) => p.input);

  perModel[model] = perModel[model] || { authorized: 0, handPassed: 0, contractPassed: 0, both: 0 };
  newlyCaught[model] = newlyCaught[model] || {};

  for (const row of cell.rows) {
    if (row.authorized !== true) continue;
    perModel[model].authorized++;
    const frag = expand(row.code);
    if (!frag) continue;
    const results = runAll(programFor(P, label, frag), inputs);
    const contractOk = results
      ? checkProbes(probes, (v) => results.get(v)).passed : false;
    const handOk = row.verified === true;
    if (handOk) perModel[model].handPassed++;
    if (contractOk) perModel[model].contractPassed++;
    if (handOk && contractOk) perModel[model].both++;
    if (handOk && !contractOk) {
      const k = row.code;
      newlyCaught[model][k] = (newlyCaught[model][k] || 0) + 1;
    }
    // THE COUNTERFACTUAL THAT MATTERS. The hand-built set had two probes it only has because a
    // control happened to fire. Recover the version WITHOUT them - the set that would have existed on
    // luck alone - and ask whether the contract-derived probes catch what it would have missed.
    if (!handOk && row.neighbour_error
      && !row.semantic_error && !row.boundary_error && !row.preservation_broken && row.delta_made) {
      perModel[model].onlyNeighbourCaught = (perModel[model].onlyNeighbourCaught || 0) + 1;
      if (!contractOk) perModel[model].contractAlsoCaught = (perModel[model].contractAlsoCaught || 0) + 1;
    }
  }
}

console.log('  REPLAY of the scale experiment through CONTRACT-DERIVED probes');
console.log('  no GPU time: every output replayed is already on disk');
console.log('');
for (const [m, s] of Object.entries(perModel)) {
  console.log('  ' + m.padEnd(21)
    + ' authorized ' + String(s.authorized).padStart(3)
    + '   hand-built probes passed ' + String(s.handPassed).padStart(3)
    + '   contract probes passed ' + String(s.contractPassed).padStart(3)
    + '   newly caught ' + String(s.handPassed - s.both).padStart(3));
  const nc = Object.entries(newlyCaught[m] || {}).sort((a, b) => b[1] - a[1]);
  for (const [code, n] of nc.slice(0, 5)) console.log('      ' + String(n).padStart(3) + 'x  ' + code);
  const only = s.onlyNeighbourCaught || 0;
  const also = s.contractAlsoCaught || 0;
  console.log('      counterfactual: the hand-built set WITHOUT its two lucky probes would have passed '
    + only + ' wrong programs;');
  console.log('                       the contract-derived set catches ' + also + ' of those '
    + (only ? '(' + (100 * also / only).toFixed(0) + '%)' : ''));
}
console.log('');
console.log('  A realization that passes the hand-built set and fails the contract set is a semantic');
console.log('  error nobody had to anticipate. A realization that passes BOTH is correct under an');
console.log('  obligation-derived oracle, which is a stronger statement than passing a probe set that');
console.log('  was written by looking at what models had already got wrong.');
