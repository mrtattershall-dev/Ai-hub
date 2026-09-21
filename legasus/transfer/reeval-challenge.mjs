/**
 * reeval-challenge.mjs - BIND-CJS step 7 (legasus/BIND-CJS_REEVAL.md, b40168e).
 *
 *   node legasus/transfer/reeval-challenge.mjs <out-dir>
 *
 * Two REAL runs through the frozen mechanism (uniform replacement, uniform bypass), then three
 * arms CONSTRUCTED by editing only the identity sequence of the real bundle. A bridge control
 * voids the experiment if construction is unfaithful. The classifier under test is the step-5
 * scalar one, reproduced here VERBATIM and applied to every bundle identically.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const MECH = join(ROOT, 'legasus', 'cjs-preload.mjs');    // e41c1e3, unchanged
const FIX = join(HERE, 'reeval-fixture');
const outDir = resolve(process.argv[2] || join(ROOT, 'legasus', 'out', 'reeval'));
mkdirSync(outDir, { recursive: true });

const TARGET = join(FIX, 'target.js');
const MUTANT = join(FIX, 'mutant.js');
const SERVED = { [MUTANT]: 'MUTANT' };

/**
 * THE CLASSIFIER UNDER TEST - the step-5 scalar rule, verbatim. `executed` is the LAST marker
 * identity; `served` the LAST served record for the aimed module. Copied rather than imported
 * so the experiment cannot be accused of having changed it, and so it is legible here.
 */
function scalarClassify(bundle) {
  const { requested, markers, servedRecs } = bundle;
  const served = servedRecs.length ? SERVED[servedRecs[servedRecs.length - 1].servedPath] || 'UNKNOWN' : null;
  const executed = markers.length ? markers[markers.length - 1].loaded : null;
  let state;
  if (!executed) state = 'SUBSTITUTION_UNOBSERVED';
  else if (!served && !requested) state = 'SUBSTITUTION_UNOBSERVED';
  else if (!served && executed === 'SUBJECT') state = 'SUBSTITUTION_UNOBSERVED';
  else if (requested !== served) state = 'IDENTITY_MISMATCH';
  else if (served !== executed) state = 'TRANSPORT_CONTRADICTION';
  else state = 'VALID_INTERVENTION';
  return { state, servedScalar: served, executedScalar: executed };
}

function realRun(id, map, requested) {
  const trace = join(outDir, `${id}.marks.jsonl`);
  const log = join(outDir, `${id}.mechanism.jsonl`);
  rmSync(trace, { force: true }); rmSync(log, { force: true });
  const r = spawnSync(process.execPath, ['--import', pathToFileURL(MECH).href, join(FIX, 'witness.js')], {
    cwd: FIX, encoding: 'utf8', timeout: 30_000,
    env: { ...process.env, LEGASUS_PROBE_TRACE: trace, LEGASUS_CJS_LOG: log, LEGASUS_CJS_MAP: JSON.stringify(map) },
  });
  const read = (p) => { try { return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
  const markers = read(trace);
  const servedRecs = read(log).filter((m) => m.event === 'served' && m.requestedFrom === TARGET);
  return { id, provenance: 'REAL RUN', requested, markers, servedRecs,
    witness: { exit: r.status, cases: ((r.stdout || '').match(/^(PASS|FAIL) /gm) || []).length, fails: ((r.stdout || '').match(/^FAIL /gm) || []).length } };
}

console.log('real runs through the frozen mechanism:');
const RA = realRun('R-A', [{ from: TARGET, to: MUTANT }], 'MUTANT');
const RE = realRun('R-E', [], null);
for (const b of [RA, RE]) console.log(`  ${b.id} sequence=[${b.markers.map((m) => m.loaded).join(',')}] servedRecs=${b.servedRecs.length} witness exit=${b.witness.exit} cases=${b.witness.cases}`);

/** Construct an arm by editing ONLY the identity sequence of R-A's real bundle. */
function construct(id, sequence) {
  if (RA.markers.length !== sequence.length) throw new Error(`R-A produced ${RA.markers.length} markers; cannot construct a ${sequence.length}-element sequence faithfully`);
  const markers = RA.markers.map((m, i) => ({ ...m, loaded: sequence[i] }));
  return { id, provenance: 'CONSTRUCTED from R-A (identity sequence only)', requested: RA.requested, markers, servedRecs: RA.servedRecs, witness: RA.witness };
}

const M = 'MUTANT', S = 'SUBJECT';
const bridge = construct('BRIDGE', [M, M, M, M, M]);
const RB = construct('R-B', [M, M, S, M, M]);
const RC = construct('R-C', [M, M, M, M, S]);
const RD = construct('R-D', [S, M, M, M, M]);

const bridgeOk = scalarClassify(bridge).state === scalarClassify(RA).state;
console.log(`\nbridge control: constructed-uniform -> ${scalarClassify(bridge).state}; real R-A -> ${scalarClassify(RA).state}; ${bridgeOk ? 'PASS' : 'FAIL - experiment void'}`);

const arms = [RA, RB, RC, RD, RE];
const expectations = { 'R-A': { mustNotBe: null }, 'R-B': { mustNotBe: 'VALID_INTERVENTION' }, 'R-C': { mustNotBe: 'VALID_INTERVENTION' }, 'R-D': { mustNotBe: 'VALID_INTERVENTION' }, 'R-E': { mustBe: 'SUBSTITUTION_UNOBSERVED' } };
const results = arms.map((b) => {
  const c = scalarClassify(b);
  const seq = b.markers.map((m) => m.loaded);
  const distinct = [...new Set(seq)];
  const e = expectations[b.id];
  const violates = e.mustNotBe ? c.state === e.mustNotBe : e.mustBe ? c.state !== e.mustBe : false;
  return { id: b.id, provenance: b.provenance, requested: b.requested, sequence: seq, distinctIdentities: distinct,
    uniform: distinct.length === 1, evaluations: seq.length, scalarState: c.state, executedScalar: c.executedScalar,
    servedScalar: c.servedScalar, expectation: e, violatesExpectation: violates,
    informationDiscarded: seq.length > 1 && distinct.length > 1 ? `${seq.length} observations, ${distinct.length} distinct identities, classifier consumed 1 (the last)` : null };
});

for (const r of results) console.log(`  ${r.id} [${r.sequence.join(',')}] -> ${r.scalarState.padEnd(24)} ${r.violatesExpectation ? '<< VIOLATES the frozen expectation' : ''}`);

const C1 = results.find((r) => r.id === 'R-B').scalarState === 'VALID_INTERVENTION';
const C2 = results.find((r) => r.id === 'R-C').scalarState !== 'VALID_INTERVENTION';
const C3 = results.find((r) => r.id === 'R-D').scalarState === 'VALID_INTERVENTION';
const scoring = bridgeOk
  ? { C1: C1 ? 'CONFIRMED - a mid-sequence contradiction is erased' : 'FALSIFIED - the scalar did not report VALID_INTERVENTION for R-B',
      C2: C2 ? 'CONFIRMED - a terminal contradiction is caught' : 'FALSIFIED - R-C was also VALID_INTERVENTION',
      C3: C3 ? 'CONFIRMED' : 'FALSIFIED',
      positionalDependence: C1 && C2 ? 'ISOLATED - the same contradiction changes the verdict by its position alone' : 'not isolated' }
  : { void: 'bridge control failed; no constructed arm may be read' };

writeFileSync(join(outDir, 'reeval.json'), JSON.stringify({ at: new Date().toISOString(), node: process.version,
  classifier: 'step-5 scalar rule, verbatim', mechanism: 'legasus/cjs-preload.mjs @ e41c1e3, unchanged',
  bridgeControl: { passed: bridgeOk, constructedUniform: scalarClassify(bridge).state, realUniform: scalarClassify(RA).state },
  results, scoring }, null, 2));
console.log(`\nC1 ${scoring.C1 || scoring.void}\nC2 ${scoring.C2 || ''}\npositional dependence: ${scoring.positionalDependence || 'n/a'}`);
console.log(`-> ${join(outDir, 'reeval.json')}`);
