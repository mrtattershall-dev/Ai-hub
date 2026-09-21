/**
 * proc-challenge.mjs - BIND-CJS step 8 (legasus/BIND-CJS_PROCESS.md, ac47a21).
 *
 *   node legasus/transfer/proc-challenge.mjs <out-dir>
 *
 * Four constructed worlds. Raw evidence recorded at full cardinality with units named. Two
 * columns of verdict: the step-5 scalar classifier verbatim, and a NAIVE UNIFORMITY rule
 * included solely as a foil for X2. Neither is adopted; no distinction is named.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const MECH = join(ROOT, 'legasus', 'cjs-preload.mjs');   // e41c1e3, unchanged
const FIX = join(HERE, 'proc-fixture');
const outDir = resolve(process.argv[2] || join(ROOT, 'legasus', 'out', 'proc'));
mkdirSync(outDir, { recursive: true });
const TARGET = join(FIX, 'target.js');
const MUTANT = join(FIX, 'mutant.js');
const SERVED = { [MUTANT]: 'MUTANT' };
const MECH_URL = pathToFileURL(MECH).href;

/** THE CLASSIFIER UNDER TEST - step 5, verbatim: last marker, last served record. */
function scalarClassify(requested, markers, servedRecs) {
  const served = servedRecs.length ? SERVED[servedRecs[servedRecs.length - 1].servedPath] || 'UNKNOWN' : null;
  const executed = markers.length ? markers[markers.length - 1].loaded : null;
  if (!executed) return 'SUBSTITUTION_UNOBSERVED';
  if (!served && !requested) return 'SUBSTITUTION_UNOBSERVED';
  if (!served && executed === 'SUBJECT') return 'SUBSTITUTION_UNOBSERVED';
  if (requested !== served) return 'IDENTITY_MISMATCH';
  if (served !== executed) return 'TRANSPORT_CONTRADICTION';
  return 'VALID_INTERVENTION';
}

/** THE FOIL for X2, not a proposal: every observed execution identity must equal the request. */
function naiveUniformity(requested, markers) {
  if (!markers.length) return 'SUBSTITUTION_UNOBSERVED';
  const ids = new Set(markers.map((m) => m.loaded));
  if (!requested) return ids.has('SUBJECT') && ids.size === 1 ? 'SUBSTITUTION_UNOBSERVED' : 'NOT_UNIFORM';
  return ids.size === 1 && ids.has(requested) ? 'VALID_INTERVENTION' : 'NOT_UNIFORM';
}

const worlds = [
  { id: 'P-A', child: 'none', stranger: false, why: 'parent alone, under the mechanism' },
  { id: 'P-B', child: 'plain', stranger: false, why: 'descendant WITHOUT the mechanism (--import is not inherited)' },
  { id: 'P-C', child: 'inherit', stranger: false, why: 'descendant WITH the mechanism, via NODE_OPTIONS' },
  { id: 'P-D', child: 'none', stranger: true, why: 'an INDEPENDENT process, not a descendant of the witness' },
  // Amendment P-1: P-B's contradiction is TERMINAL by construction, so step 7's positional
  // finding - not the representation's soundness - is what falsified X1. Here the witness
  // re-loads after the child returns, making the sequence M, S, M.
  { id: 'P-E', child: 'plain', stranger: false, reload: true, why: 'descendant without the mechanism, then the witness RE-LOADS - contradiction no longer last' },
];

const results = [];
for (const w of worlds) {
  const trace = join(outDir, `${w.id}.marks.jsonl`);
  const log = join(outDir, `${w.id}.mechanism.jsonl`);
  rmSync(trace, { force: true }); rmSync(log, { force: true });
  const baseEnv = { ...process.env, LEGASUS_PROBE_TRACE: trace, LEGASUS_CJS_LOG: log,
    LEGASUS_CJS_MAP: JSON.stringify([{ from: TARGET, to: MUTANT }]),
    LEGASUS_FIXTURE_CHILD: w.child, LEGASUS_ROLE: 'witness', LEGASUS_FIXTURE_RELOAD: w.reload ? '1' : '0',
    // 'inherit' passes the mechanism down through NODE_OPTIONS; 'plain' deletes it in the child.
    NODE_OPTIONS: `--import ${MECH_URL}` };
  const r = spawnSync(process.execPath, ['--import', MECH_URL, join(FIX, 'witness.js')], { cwd: FIX, env: baseEnv, encoding: 'utf8', timeout: 60_000 });

  // P-D: an independent process spawned by THIS DRIVER, not by the witness. Same trace stream,
  // different lineage. It receives no mechanism and no NODE_OPTIONS.
  let strangerOut = null;
  if (w.stranger) {
    const env = { ...process.env, LEGASUS_PROBE_TRACE: trace, LEGASUS_ROLE: 'stranger' };
    delete env.NODE_OPTIONS; delete env.LEGASUS_CJS_MAP; delete env.LEGASUS_CJS_LOG;
    const s = spawnSync(process.execPath, [join(FIX, 'loader.js')], { cwd: FIX, env, encoding: 'utf8', timeout: 30_000 });
    strangerOut = { exit: s.status, stdout: (s.stdout || '').trim() };
  }

  const read = (p) => { try { return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
  const markers = read(trace);
  const servedRecs = read(log).filter((m) => m.event === 'served' && m.requestedFrom === TARGET);

  // Raw evidence at full cardinality, units named (processes != evaluations != resolutions).
  const byPid = {};
  for (const m of markers) (byPid[m.pid] ??= { pid: m.pid, ppid: m.ppid, role: m.role, loads: [] }).loads.push(m.loaded);
  const procs = Object.values(byPid);
  const witnessPid = (markers.find((m) => m.role === 'witness') || {}).pid || null;
  const cardinality = { markerRecords: markers.length, distinctPids: procs.length,
    resolutionsServed: servedRecs.length, distinctIdentities: [...new Set(markers.map((m) => m.loaded))] };

  const scalar = scalarClassify('MUTANT', markers, servedRecs);
  const naive = naiveUniformity('MUTANT', markers);
  // The minimum frozen expectation, evaluated ONLY where lineage is observable and unambiguous.
  const descendantRanOriginal = procs.some((p) => p.ppid === witnessPid && p.loads.includes('SUBJECT'));
  results.push({ id: w.id, why: w.why, witnessPid, processes: procs, cardinality,
    scalarState: scalar, naiveUniformityState: naive,
    descendantExecutedOriginal: descendantRanOriginal,
    violatesMinimumExpectation: descendantRanOriginal && scalar === 'VALID_INTERVENTION',
    witness: { exit: r.status, cases: ((r.stdout || '').match(/^(PASS|FAIL) /gm) || []).length, stdoutTail: (r.stdout || '').trim().split('\n').slice(-3).join(' | ').slice(0, 200) },
    stranger: strangerOut });
  const x = results[results.length - 1];
  console.log(`  ${x.id} procs=${x.cardinality.distinctPids} ids=[${x.cardinality.distinctIdentities.join(',')}] scalar=${x.scalarState.padEnd(20)} naive=${x.naiveUniformityState.padEnd(22)} descendantRanOriginal=${x.descendantExecutedOriginal} ${x.violatesMinimumExpectation ? '<< VIOLATES the minimum frozen expectation' : ''}`);
  for (const p of x.processes) console.log(`        pid ${p.pid} ppid ${p.ppid} role=${p.role} loads=[${p.loads.join(',')}]`);
}

const PB = results.find((r) => r.id === 'P-B');
const PD = results.find((r) => r.id === 'P-D');
const PE = results.find((r) => r.id === 'P-E');
// Amendment P-1: X1 is rescored over BOTH P-B and P-E. P-B's contradiction is terminal by
// construction; P-E moves it off the end, which is where step 7 says the erasure lives.
const X1 = PB.violatesMinimumExpectation || (PE && PE.violatesMinimumExpectation);
const X2 = PB.scalarState === PD.scalarState && PB.naiveUniformityState === PD.naiveUniformityState;
const scoring = {
  X1: X1 ? 'CONFIRMED (rescored under amendment P-1) - the scalar certified VALID_INTERVENTION while a descendant executed the original' : 'FALSIFIED over both P-B and P-E',
  X2: X2 ? `CONFIRMED - P-B and P-D receive the same verdict from BOTH the current representation (${PB.scalarState}) and the foil (${PB.naiveUniformityState}); neither distinguishes an escaped descendant from a stranger`
    : `FALSIFIED - scalar: ${PB.scalarState} vs ${PD.scalarState}; foil: ${PB.naiveUniformityState} vs ${PD.naiveUniformityState}`,
  X3: 'deliberately unpredicted; raw lineage (pid, ppid, role, argv) recorded in full, no distinction named',
};
writeFileSync(join(outDir, 'proc.json'), JSON.stringify({ at: new Date().toISOString(), node: process.version,
  mechanism: 'legasus/cjs-preload.mjs @ e41c1e3, unchanged', classifier: 'step-5 scalar, verbatim',
  foil: 'naive uniformity - a FOIL for X2, not a proposal', results, scoring }, null, 2));
console.log(`\nX1 ${scoring.X1}\nX2 ${scoring.X2}`);
console.log(`-> ${join(outDir, 'proc.json')}`);
