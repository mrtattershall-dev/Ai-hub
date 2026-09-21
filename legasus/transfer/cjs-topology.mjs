/**
 * cjs-topology.mjs - BIND-CJS step 6: does intervention identity stay coherent across the whole
 * process topology of ONE foreign witness? (legasus/BIND-CJS_TOPOLOGY.md, c39b02f)
 *
 *   node legasus/transfer/cjs-topology.mjs <engine-shape.json> <out-dir>
 *
 * Execution identity is recorded as a SET over processes and never reduced to a scalar before
 * it is recorded. Two classifiers are applied to the SAME evidence: the step-5 scalar one,
 * UNCHANGED, and the frozen topology denial. Their agreement or disagreement is the measurement.
 * No new state name is invented here.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const MECH = join(ROOT, 'legasus', 'cjs-preload.mjs');   // e41c1e3, unchanged
const MUTATE = join(ROOT, 'legasus', 'mutate.mjs');
const [shapeArg, outArg] = process.argv.slice(2);
const SHAPE = JSON.parse(readFileSync(resolve(shapeArg), 'utf8'));
const FROOT = SHAPE.root;
const outDir = resolve(outArg);
mkdirSync(outDir, { recursive: true });

// Frozen by the preregistration: this witness, this subject.
const WITNESS = 'experiments/025_behavior_corpus/harness_test.js';
const SUBJECT = 'experiments/025_behavior_corpus/adapters.js';
const witnessPath = join(FROOT, WITNESS);
const subjectPath = join(FROOT, SUBJECT);
const subjectUrl = pathToFileURL(subjectPath).href;
const subShape = SHAPE.subjectShapes.find((s) => s.file === SUBJECT);
const exportNames = [...new Set([...subShape.exportsCjs, ...subShape.exportsCjsNamed, ...subShape.exportsEsm])];

// ---- served files, outside the foreign tree -------------------------------------------------
const mutDir = join(outDir, 'served');
rmSync(mutDir, { recursive: true, force: true });
mkdirSync(mutDir, { recursive: true });
const src = readFileSync(subjectPath, 'utf8');
/** Declared instrument change: pid and ppid, because per-process identity is the object of study. */
const marker = (id) => `\ntry{require('node:fs').appendFileSync(process.env.LEGASUS_PROBE_TRACE,JSON.stringify({loaded:${JSON.stringify(id)},pid:process.pid,ppid:process.ppid,argv1:process.argv[1],filename:__filename})+'\\n')}catch(e){}\n`;
const identityCopy = join(mutDir, 'T000-IDENTITY.js');
writeFileSync(identityCopy, src + marker('T000_IDENTITY'));
const SERVED = { [identityCopy]: 'T000_IDENTITY' };

let mutantPath = null;
for (const name of exportNames) {
  const d = join(mutDir, `mut-${name}`);
  mkdirSync(d, { recursive: true });
  const g = spawnSync(process.execPath, [MUTATE, subjectPath, name, d], { cwd: ROOT, encoding: 'utf8' });
  let man = null;
  try { man = JSON.parse(readFileSync(join(d, 'mutants.json'), 'utf8')); } catch { continue; }
  const valid = (man.mutants || man).filter((m) => m.valid);
  if (!valid.length) continue;
  mutantPath = join(mutDir, 'T001-MUTANT.js');
  writeFileSync(mutantPath, readFileSync(valid[0].file, 'utf8') + marker('T001_MUTANT'));
  SERVED[mutantPath] = 'T001_MUTANT';
  console.log(`mutant available: ${valid[0].id} ${valid[0].family} on ${name} - ${valid[0].describe}`);
  break;
}
if (!mutantPath) console.log(`no valid mutant for any exported name (${exportNames.join(', ')}) - proceeding on the identity copy, as preregistered`);

const conditions = [
  { id: 'T-A', requested: identityCopy, map: [{ from: subjectPath, to: identityCopy }] },
  ...(mutantPath ? [{ id: 'T-B', requested: mutantPath, map: [{ from: subjectPath, to: mutantPath }] }] : []),
  { id: 'T-C', requested: null, map: [] },
];

const readLines = (p) => { try { return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };

/** One coverage file per process; the pid is in the filename. Returns per-process evidence. */
function perProcessCoverage(covDir) {
  const out = [];
  let files = [];
  try { files = readdirSync(covDir).filter((f) => f.endsWith('.json')); } catch { return out; }
  const servedUrls = Object.fromEntries(Object.entries(SERVED).map(([p, id]) => [pathToFileURL(p).href, id]));
  for (const f of files) {
    let j;
    try { j = JSON.parse(readFileSync(join(covDir, f), 'utf8')); } catch { out.push({ file: f, unreadable: true }); continue; }
    const m = f.match(/coverage-(\d+)-/);
    const pid = m ? Number(m[1]) : null;
    let ranSubject = false;
    const ranServed = new Set();
    for (const s of j.result || []) {
      if (!s.url || !s.functions) continue;
      const executed = s.functions.some((fn) => fn.ranges && fn.ranges[0] && fn.ranges[0].count > 0);
      if (!executed) continue;
      if (s.url === subjectUrl) ranSubject = true;
      if (servedUrls[s.url]) ranServed.add(servedUrls[s.url]);
    }
    out.push({ file: f, pid, ranSubject, ranServed: [...ranServed], scripts: (j.result || []).length });
  }
  return out;
}

const results = [];
for (const c of conditions) {
  const trace = join(outDir, `topology.${c.id}.marks.jsonl`);
  const log = join(outDir, `topology.${c.id}.mechanism.jsonl`);
  const covDir = join(outDir, 'cov', c.id);
  rmSync(trace, { force: true }); rmSync(log, { force: true }); rmSync(covDir, { recursive: true, force: true });
  mkdirSync(covDir, { recursive: true });
  const before = new Map();
  for (const f of SHAPE.testShapes.concat(SHAPE.subjectShapes)) { const p = join(FROOT, f.file); try { before.set(p, statSync(p).mtimeMs); } catch { /* gone */ } }

  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['--import', pathToFileURL(MECH).href, witnessPath], {
    cwd: FROOT, encoding: 'utf8', timeout: 300_000,
    env: { ...process.env, LEGASUS_PROBE_TRACE: trace, LEGASUS_CJS_LOG: log, LEGASUS_CJS_MAP: JSON.stringify(c.map), NODE_V8_COVERAGE: covDir },
  });
  const ms = Date.now() - t0;
  const touched = [];
  for (const [p, m] of before) { try { if (statSync(p).mtimeMs !== m) touched.push(relative(FROOT, p)); } catch { touched.push(`${relative(FROOT, p)} (vanished)`); } }

  const marks = readLines(trace);
  const mech = readLines(log);
  const cov = perProcessCoverage(covDir);
  const requested = c.requested ? SERVED[c.requested] : null;

  // ---- the execution SET over processes, recorded before any reduction ----------------------
  const procsRanSubject = cov.filter((x) => x.ranSubject).map((x) => x.pid);
  const procsRanServed = cov.filter((x) => x.ranServed.length).map((x) => ({ pid: x.pid, served: x.ranServed }));
  const markerPids = [...new Set(marks.map((m) => m.pid))];
  const parentPid = marks.length ? marks[0].pid : null;
  const executionSet = { totalProcessesWithCoverage: cov.length, processesThatRanOriginal: procsRanSubject.length,
    processesThatRanReplacement: procsRanServed.length, markerProcesses: markerPids.length,
    distinctMarkerIdentities: [...new Set(marks.map((m) => m.loaded))],
    sampleOriginalPids: procsRanSubject.slice(0, 5), sampleReplacement: procsRanServed.slice(0, 5) };

  // ---- classifier 1: the step-5 scalar rule, UNCHANGED --------------------------------------
  const servedRecs = mech.filter((m) => m.event === 'served').filter((m) => m.requestedFrom === subjectPath);
  const servedScalar = servedRecs.length ? SERVED[servedRecs[servedRecs.length - 1].servedPath] || 'UNKNOWN' : null;
  const executedScalar = marks.length ? marks[marks.length - 1].loaded : null;
  let legacyState;
  if (!executedScalar) legacyState = 'SUBSTITUTION_UNOBSERVED';
  else if (!servedScalar && !requested) legacyState = 'SUBSTITUTION_UNOBSERVED';
  else if (requested !== servedScalar) legacyState = 'IDENTITY_MISMATCH';
  else if (servedScalar !== executedScalar) legacyState = 'TRANSPORT_CONTRADICTION';
  else legacyState = 'VALID_INTERVENTION';

  // ---- classifier 2: the frozen topology denial ---------------------------------------------
  const mixed = procsRanSubject.length > 0 && procsRanServed.length > 0;
  const denial = mixed
    ? { denied: true, label: 'VALID_INTERVENTION_DENIED', reason: `mixed execution set: ${procsRanSubject.length} process(es) executed the ORIGINAL while ${procsRanServed.length} executed the requested replacement` }
    : { denied: false, label: null, reason: null };

  results.push({ id: c.id, requested, ms, executionSet, legacyState, denial,
    disagree: legacyState === 'VALID_INTERVENTION' && denial.denied,
    witness: { exit: r.status, caseLines: ((r.stdout || '').match(/^\s*(PASS|FAIL) /gm) || []).length,
      failLines: ((r.stdout || '').match(/^\s*FAIL /gm) || []).length, tail: (r.stdout || '').trim().split('\n').slice(-2).join(' | ').slice(0, 160) },
    mechanismServedRecords: servedRecs.length, foreignFilesTouched: touched });
  const x = results[results.length - 1];
  console.log(`  ${x.id} req=${String(x.requested).padEnd(13)} procs=${String(x.executionSet.totalProcessesWithCoverage).padStart(3)} ranOriginal=${String(x.executionSet.processesThatRanOriginal).padStart(3)} ranReplacement=${String(x.executionSet.processesThatRanReplacement).padStart(3)} markerProcs=${x.executionSet.markerProcesses} | legacy=${x.legacyState.padEnd(24)} denial=${x.denial.denied ? 'DENIED' : '-'} ${x.disagree ? '<< CLASSIFIERS DISAGREE' : ''} exit=${x.witness.exit} cases=${x.witness.caseLines} touched=${x.foreignFilesTouched.length} ${x.ms}ms`);
}

const anyMixed = results.some((x) => x.denial.denied);
const anyDisagree = results.some((x) => x.disagree);
writeFileSync(join(outDir, 'topology.json'), JSON.stringify({ at: new Date().toISOString(), node: process.version,
  mechanism: 'legasus/cjs-preload.mjs @ e41c1e3, unchanged', witness: WITNESS, subject: SUBJECT, exportNames,
  mutantAvailable: Boolean(mutantPath), results,
  scoring: { M1: anyMixed ? 'CONFIRMED (a mixed execution set was observed)' : 'FALSIFIED OR UNEXERCISED - see executionSet',
    M2: anyDisagree ? 'CONFIRMED (the scalar classifier reported VALID_INTERVENTION where the topology denies it)' : 'NOT CONFIRMED - the classifiers did not disagree',
    M3: 'deliberately unpredicted; the raw execution set is recorded for the ontology question' } }, null, 2));
console.log(`M1 mixed execution set: ${anyMixed ? 'OBSERVED' : 'not observed'} | M2 classifiers disagree: ${anyDisagree ? 'YES' : 'no'}`);
console.log(`-> ${join(outDir, 'topology.json')}`);
