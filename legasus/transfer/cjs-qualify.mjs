/**
 * cjs-qualify.mjs - BIND-CJS step 2: run the seven preregistered conditions
 * (legasus/BIND-CJS_QUALIFICATION.md, c45aab6) against the candidate mechanism
 * legasus/cjs-preload.mjs, on a SYNTHETIC fixture whose answers are known in advance.
 *
 *   node legasus/transfer/cjs-qualify.mjs <out-dir>
 *
 * The state function is the frozen one. `executed` comes only from the loaded file's own
 * self-identification; `served` only from the mechanism's log. They are compared, never
 * merged. The foreign engine is not used here - developing the mechanism against the
 * transfer target would contaminate the transfer.
 */
import { writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const FIX = join(HERE, 'cjs-qual');
const MECH = join(ROOT, 'legasus', 'cjs-preload.mjs');
const outDir = resolve(process.argv[2] || join(ROOT, 'legasus', 'out', 'bind-cjs'));
mkdirSync(outDir, { recursive: true });

const P = (f) => join(FIX, f);
// The fixture's path <-> identity table. The driver knows it; neither the mechanism nor the
// witness does.
const IDENTITY = {
  [P('target.js')]: 'TARGET', [P('target.M0.js')]: 'TARGET_M0', [P('target.M1.js')]: 'TARGET_M1',
  [P('target.M2.js')]: 'TARGET_M2', [P('decoy.js')]: 'DECOY', [P('decoy.M.js')]: 'DECOY_M',
};
const SUBJECT_IDENTITIES = new Set(['TARGET', 'DECOY']);

/** The frozen state function. Order matters and is the order in the preregistration. */
function classify({ requested, served, executed, scope }) {
  if (!executed) return 'SUBSTITUTION_UNOBSERVED';
  if (!served && SUBJECT_IDENTITIES.has(executed)) return 'SUBSTITUTION_UNOBSERVED';
  if (requested !== served) return 'IDENTITY_MISMATCH';
  if (served !== executed) return 'TRANSPORT_CONTRADICTION';
  for (const [ident, seen] of Object.entries(scope || {})) if (seen !== ident) return 'SCOPE_VIOLATION';
  return 'VALID_INTERVENTION';
}

const NEVER_REQUIRED = P('target.NOT-REQUIRED-BY-ANY-WITNESS.js');
const conditions = [
  { id: 'Q-A', why: 'normal substitution', requested: P('target.M1.js'), map: [{ from: P('target.js'), to: P('target.M1.js') }], expect: 'VALID_INTERVENTION', expectWitnessExit: 1 },
  { id: 'Q-B', why: 'identity substitution', requested: P('target.M0.js'), map: [{ from: P('target.js'), to: P('target.M0.js') }], expect: 'VALID_INTERVENTION', expectWitnessExit: 0 },
  // The map names a path no witness requires, so the hook never fires: a genuine bypass, not a
  // disabled-mechanism simulation. The witness then PASSES against the original.
  { id: 'Q-C', why: 'total bypass', requested: P('target.M1.js'), map: [{ from: NEVER_REQUIRED, to: P('target.M1.js') }], expect: 'SUBSTITUTION_UNOBSERVED', expectWitnessExit: 0 },
  // The driver records a request for M1 while the mechanism is configured with M2: a mechanism
  // that served the wrong thing. No corruption flag exists inside the mechanism.
  { id: 'Q-D', why: 'wrong substitution', requested: P('target.M1.js'), map: [{ from: P('target.js'), to: P('target.M2.js') }], expect: 'IDENTITY_MISMATCH', expectWitnessExit: null },
  { id: 'Q-E', why: 'scope preservation (target substituted, decoy must not be)', requested: P('target.M1.js'), map: [{ from: P('target.js'), to: P('target.M1.js') }], scopeExpect: { DECOY: true }, expect: 'VALID_INTERVENTION', expectWitnessExit: 1 },
  { id: 'Q-F', why: 'scope negative (decoy substituted, target must not be)', requested: P('decoy.M.js'), map: [{ from: P('decoy.js'), to: P('decoy.M.js') }], scopeExpect: { TARGET: true }, expect: 'VALID_INTERVENTION', expectWitnessExit: 1 },
  { id: 'Q-G', why: 'no request at all', requested: null, map: [], expect: 'SUBSTITUTION_UNOBSERVED', expectWitnessExit: 0 },
  // Amendment Q-1: SCOPE_VIOLATION had no producing condition, so it was not a control.
  // Substitute BOTH modules while declaring the decoy out of scope.
  { id: 'Q-H', why: 'live scope violation (must fire)', requested: P('target.M1.js'),
    map: [{ from: P('target.js'), to: P('target.M1.js') }, { from: P('decoy.js'), to: P('decoy.M.js') }],
    scopeExpect: { DECOY: true }, expect: 'SCOPE_VIOLATION', expectWitnessExit: 1 },
];

// Amendment Q-1: classifier must-fire checks. Hand-built triples, one per state. These are
// checks of the STATE FUNCTION, never observations of the mechanism, and are reported as such.
// TRANSPORT_CONTRADICTION belongs here because an honest mechanism cannot produce it.
const CLASSIFIER_CHECKS = [
  { name: 'valid', input: { requested: 'TARGET_M1', served: 'TARGET_M1', executed: 'TARGET_M1', scope: {} }, expect: 'VALID_INTERVENTION' },
  { name: 'executed absent', input: { requested: 'TARGET_M1', served: 'TARGET_M1', executed: null, scope: {} }, expect: 'SUBSTITUTION_UNOBSERVED' },
  { name: 'bypass', input: { requested: 'TARGET_M1', served: null, executed: 'TARGET', scope: {} }, expect: 'SUBSTITUTION_UNOBSERVED' },
  { name: 'wrong mutant', input: { requested: 'TARGET_M1', served: 'TARGET_M2', executed: 'TARGET_M2', scope: {} }, expect: 'IDENTITY_MISMATCH' },
  { name: 'claim contradicts observation', input: { requested: 'TARGET_M1', served: 'TARGET_M1', executed: 'TARGET_M2', scope: {} }, expect: 'TRANSPORT_CONTRADICTION' },
  { name: 'scope violated', input: { requested: 'TARGET_M1', served: 'TARGET_M1', executed: 'TARGET_M1', scope: { DECOY: 'DECOY_M' } }, expect: 'SCOPE_VIOLATION' },
];

const results = [];
for (const c of conditions) {
  const trace = join(outDir, `qual.${c.id}.marks.jsonl`);
  const log = join(outDir, `qual.${c.id}.mechanism.jsonl`);
  rmSync(trace, { force: true }); rmSync(log, { force: true });
  const env = { ...process.env, LEGASUS_PROBE_TRACE: trace, LEGASUS_CJS_LOG: log, LEGASUS_CJS_MAP: JSON.stringify(c.map) };
  const r = spawnSync(process.execPath, ['--import', pathToFileURL(MECH).href, P('witness.js')],
    { cwd: FIX, env, encoding: 'utf8', timeout: 30_000 });

  const marks = readLines(trace);            // executed identities, from inside the process
  const mech = readLines(log);               // the mechanism's CLAIM
  const servedRecs = mech.filter((m) => m.event === 'served');
  const requested = c.requested ? IDENTITY[c.requested] : null;
  const loaded = marks.map((m) => m.loaded);
  const aimedFamily = (requested || 'TARGET').startsWith('DECOY') ? 'DECOY' : 'TARGET';
  const aimedSubjectPath = aimedFamily === 'DECOY' ? P('decoy.js') : P('target.js');
  // `served` is what the mechanism claims it answered THE REQUIRE THIS CONDITION AIMED AT with.
  // Keyed to that module, never "the last substitution in the run": a run that substitutes more
  // than one module would otherwise attribute another module's substitution to this request,
  // which reads as IDENTITY_MISMATCH and hides a genuine SCOPE_VIOLATION. Found by Q-H, the
  // control added in amendment Q-1; runs with a single substitution could not expose it.
  const aimed = servedRecs.filter((m) => m.requestedFrom === aimedSubjectPath);
  const served = aimed.length ? IDENTITY[aimed[aimed.length - 1].servedPath] || `UNKNOWN(${aimed[aimed.length - 1].servedPath})` : null;
  const executed = loaded.filter((x) => x.startsWith(aimedFamily)).slice(-1)[0] || null;
  const scope = {};
  for (const ident of Object.keys(c.scopeExpect || {})) scope[ident] = loaded.filter((x) => x.startsWith(ident.split('_')[0])).slice(-1)[0] || null;

  const state = classify({ requested, served, executed, scope });
  const caseLines = ((r.stdout || '').match(/^(PASS|FAIL) /gm) || []).map((s) => s.trim());
  const witnessOk = c.expectWitnessExit === null || r.status === c.expectWitnessExit;
  results.push({ id: c.id, why: c.why, requested, served, executed, scope, loadedSequence: loaded,
    state, expected: c.expect, match: state === c.expect,
    witnessExit: r.status, expectedWitnessExit: c.expectWitnessExit, witnessOk, cases: caseLines,
    mechanismRecords: mech.length, stderrTail: (r.stderr || '').trim().split('\n').slice(-2).join(' | ').slice(0, 300) });
}

function readLines(p) { try { return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } }

const classifierChecks = CLASSIFIER_CHECKS.map((c) => ({ ...c, got: classify(c.input), match: classify(c.input) === c.expect }));
const statesProduced = new Set([...results.map((x) => x.state), ...classifierChecks.map((c) => c.got)]);
const ALL_STATES = ['VALID_INTERVENTION', 'SUBSTITUTION_UNOBSERVED', 'IDENTITY_MISMATCH', 'TRANSPORT_CONTRADICTION', 'SCOPE_VIOLATION'];
const unproduced = ALL_STATES.filter((s) => !statesProduced.has(s));

const allStates = results.every((x) => x.match);
const allWitness = results.every((x) => x.witnessOk);
const allClassifier = classifierChecks.every((c) => c.match);
const verdict = allStates && allWitness && allClassifier && !unproduced.length
  ? { status: 'QUALIFIED', reason: 'every preregistered condition produced its preregistered state, every constrained witness outcome matched, every classifier state was demonstrated to be producible, and no frozen state went unproduced' }
  : { status: 'NOT_QUALIFIED', reason: `state mismatches: ${results.filter((x) => !x.match).map((x) => `${x.id} got ${x.state} wanted ${x.expected}`).join('; ') || 'none'}; witness mismatches: ${results.filter((x) => !x.witnessOk).map((x) => `${x.id} exit ${x.witnessExit} wanted ${x.expectedWitnessExit}`).join('; ') || 'none'}; classifier mismatches: ${classifierChecks.filter((c) => !c.match).map((c) => `${c.name} got ${c.got} wanted ${c.expect}`).join('; ') || 'none'}; states never produced: ${unproduced.join(', ') || 'none'}` };

writeFileSync(join(outDir, 'qualification.json'), JSON.stringify({ at: new Date().toISOString(), node: process.version,
  mechanism: 'legasus/cjs-preload.mjs (module.registerHooks, synchronous in-thread)', fixture: FIX, results,
  classifierChecks, statesProduced: [...statesProduced], unproducedStates: unproduced, verdict }, null, 2));

for (const x of results) console.log(`  ${x.id} ${x.match && x.witnessOk ? 'ok  ' : 'MISS'} req=${String(x.requested).padEnd(9)} served=${String(x.served).padEnd(9)} exec=${String(x.executed).padEnd(9)} -> ${x.state.padEnd(24)} (wanted ${x.expected}) exit=${x.witnessExit} loaded=[${x.loadedSequence.join(',')}]`);
for (const c of classifierChecks) console.log(`  CLF ${c.match ? 'ok  ' : 'MISS'} ${c.name.padEnd(30)} -> ${c.got} (wanted ${c.expect})`);
console.log(`  states demonstrated producible: ${[...statesProduced].join(', ')}${unproduced.length ? ` | NEVER PRODUCED: ${unproduced.join(', ')}` : ''}`);
console.log(`VERDICT: ${verdict.status} - ${verdict.reason}`);
console.log(`-> ${join(outDir, 'qualification.json')}`);
process.exit(verdict.status === 'QUALIFIED' ? 0 : 3);
