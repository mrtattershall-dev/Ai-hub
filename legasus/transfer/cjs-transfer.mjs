/**
 * cjs-transfer.mjs - BIND-CJS step 5: point the QUALIFIED, UNCHANGED mechanism
 * (legasus/cjs-preload.mjs @ e41c1e3) at the foreign engine, under the predictions frozen in
 * legasus/BIND-CJS_TRANSFER.md (ef92ab1).
 *
 *   node legasus/transfer/cjs-transfer.mjs <engine-shape.json> <out-dir>
 *
 * Selection is by the frozen mechanical rule, applied here and reported. Scope evidence is the
 * WHOLE executed set from V8 coverage, never just the requested module. Multiplicity is
 * refused, never deduplicated. Nothing in the foreign tree is written.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const MECH = join(ROOT, 'legasus', 'cjs-preload.mjs');
const MUTATE = join(ROOT, 'legasus', 'mutate.mjs');
const [shapeArg, outArg] = process.argv.slice(2);
const SHAPE = JSON.parse(readFileSync(resolve(shapeArg), 'utf8'));
const FROOT = SHAPE.root;
const outDir = resolve(outArg);
mkdirSync(outDir, { recursive: true });

// ---- frozen selection rule (BIND-CJS_TRANSFER.md) -------------------------------------------
const exportsOf = (s) => [...new Set([...s.exportsCjs, ...s.exportsCjsNamed, ...s.exportsEsm])];
const candidates = SHAPE.subjectShapes.filter((s) => exportsOf(s).length > 0 && !s.requires.some((r) => r.startsWith('.')));
const norm = (p) => p.replace(/\\/g, '/').replace(/\.(js|mjs|cjs)$/, '');
const pairs = [];
for (const sub of candidates) {
  for (const t of SHAPE.testShapes) {
    const hit = t.requires.some((r) => r.startsWith('.') && norm(resolve(join(FROOT, dirname(t.file)), r)) === norm(join(FROOT, sub.file)));
    if (!hit) continue;
    const run = SHAPE.runs.find((x) => x.file === t.file);
    pairs.push({ subject: sub.file, witness: t.file, caseLines: run ? run.caseLineCandidates.PASS_FAIL_leading.count : 0, exports: exportsOf(sub) });
  }
}
pairs.sort((a, b) => b.caseLines - a.caseLines || (a.subject < b.subject ? -1 : 1));
const selection = pairs[0] || null;
const selectionRecord = { candidateSubjects: candidates.length, candidatePairs: pairs.length, top: pairs.slice(0, 5), selected: selection,
  limitation: 'subjects with relative requires are excluded: a mutant lives outside the foreign tree and could not resolve them; placing mutants inside the tree is prohibited' };
if (!selection) {
  writeFileSync(join(outDir, 'transfer.json'), JSON.stringify({ status: 'NO_ELIGIBLE_PAIR', selectionRecord }, null, 2));
  console.log('NO_ELIGIBLE_PAIR under the frozen selection rule'); process.exit(3);
}
const subjectPath = join(FROOT, selection.subject);
const witnessPath = join(FROOT, selection.witness);
console.log(`selected subject ${selection.subject} :: witness ${selection.witness} (${selection.caseLines} case lines, ${selection.exports.length} exports)`);

// ---- build the served files (identity copy + first valid mutant), OUTSIDE the foreign tree ---
const mutDir = join(outDir, 'mutants');
rmSync(mutDir, { recursive: true, force: true });
mkdirSync(mutDir, { recursive: true });
const src = readFileSync(subjectPath, 'utf8');
const fnName = selection.exports[0];
const gen = spawnSync(process.execPath, [MUTATE, subjectPath, fnName, mutDir], { cwd: ROOT, encoding: 'utf8' });
let manifest = null;
try { manifest = JSON.parse(readFileSync(join(mutDir, 'mutants.json'), 'utf8')); } catch { /* reported below */ }
const mutants = manifest ? (manifest.mutants || manifest).filter((m) => m.valid) : [];
if (!mutants.length) {
  writeFileSync(join(outDir, 'transfer.json'), JSON.stringify({ status: 'NO_VALID_MUTANT', fnName, selectionRecord, mutateStdout: gen.stdout, mutateStderr: gen.stderr }, null, 2));
  console.log(`NO_VALID_MUTANT for ${selection.subject}::${fnName}`); process.exit(3);
}
const chosenMutant = mutants[0];

/** Self-identification, using only builtins so it resolves from anywhere. Apparatus, not semantics. */
const marker = (identity) => `\ntry{require('node:fs').appendFileSync(process.env.LEGASUS_PROBE_TRACE,JSON.stringify({loaded:${JSON.stringify(identity)},filename:__filename})+'\\n')}catch(e){}\n`;
const identityCopy = join(mutDir, 'F000-IDENTITY.js');
const markedMutant = join(mutDir, 'F001-MUTANT.js');
writeFileSync(identityCopy, src + marker('F000_IDENTITY'));
writeFileSync(markedMutant, readFileSync(chosenMutant.file, 'utf8') + marker('F001_MUTANT'));
const LEGASUS_FILES = { [identityCopy]: 'F000_IDENTITY', [markedMutant]: 'F001_MUTANT' };

// ---- conditions -----------------------------------------------------------------------------
const NEVER = join(FROOT, 'THIS-PATH-IS-REQUIRED-BY-NOTHING.js');
const conditions = [
  { id: 'F-A', requested: markedMutant, map: [{ from: subjectPath, to: markedMutant }], expect: 'VALID_INTERVENTION' },
  { id: 'F-B', requested: identityCopy, map: [{ from: subjectPath, to: identityCopy }], expect: 'VALID_INTERVENTION' },
  { id: 'F-C', requested: markedMutant, map: [{ from: NEVER, to: markedMutant }], expect: 'SUBSTITUTION_UNOBSERVED' },
  { id: 'F-G', requested: null, map: [], expect: 'SUBSTITUTION_UNOBSERVED' },
];

const subjectUrl = pathToFileURL(subjectPath).href;
const readLines = (p) => { try { return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };

function executedUrls(covDir) {
  const urls = new Set();
  let files = [];
  try { files = readdirSync(covDir).filter((f) => f.endsWith('.json')); } catch { return { urls: [...urls], covFiles: 0 }; }
  for (const f of files) {
    try {
      const j = JSON.parse(readFileSync(join(covDir, f), 'utf8'));
      for (const s of j.result || []) if (s.url && s.functions && s.functions.some((fn) => fn.ranges && fn.ranges[0] && fn.ranges[0].count > 0)) urls.add(s.url);
    } catch { /* unreadable coverage file */ }
  }
  return { urls: [...urls], covFiles: files.length };
}

const results = [];
for (const c of conditions) {
  const trace = join(outDir, `transfer.${c.id}.marks.jsonl`);
  const log = join(outDir, `transfer.${c.id}.mechanism.jsonl`);
  const covDir = join(outDir, 'cov', c.id);
  rmSync(trace, { force: true }); rmSync(log, { force: true }); rmSync(covDir, { recursive: true, force: true });
  mkdirSync(covDir, { recursive: true });
  const before = new Map();
  for (const f of SHAPE.testShapes.concat(SHAPE.subjectShapes)) { const p = join(FROOT, f.file); try { before.set(p, statSync(p).mtimeMs); } catch { /* gone */ } }

  const env = { ...process.env, LEGASUS_PROBE_TRACE: trace, LEGASUS_CJS_LOG: log, LEGASUS_CJS_MAP: JSON.stringify(c.map), NODE_V8_COVERAGE: covDir };
  const r = spawnSync(process.execPath, ['--import', pathToFileURL(MECH).href, witnessPath], { cwd: FROOT, env, encoding: 'utf8', timeout: 180_000 });

  const touched = [];
  for (const [p, m] of before) { try { if (statSync(p).mtimeMs !== m) touched.push(relative(FROOT, p)); } catch { touched.push(`${relative(FROOT, p)} (vanished)`); } }

  const marks = readLines(trace);
  const mech = readLines(log);
  const servedRecs = mech.filter((m) => m.event === 'served');
  const requested = c.requested ? LEGASUS_FILES[c.requested] : null;
  const aimed = servedRecs.filter((m) => m.requestedFrom === subjectPath);
  const served = aimed.length ? LEGASUS_FILES[aimed[aimed.length - 1].servedPath] || `UNKNOWN(${aimed[aimed.length - 1].servedPath})` : null;
  const loaded = marks.map((m) => m.loaded);
  const executed = loaded.length ? loaded[loaded.length - 1] : null;

  const { urls, covFiles } = executedUrls(covDir);
  const legasusExecuted = Object.entries(LEGASUS_FILES).filter(([p]) => urls.includes(pathToFileURL(p).href)).map(([, id]) => id);
  const subjectExecuted = urls.includes(subjectUrl);
  const unauthorized = legasusExecuted.filter((id) => id !== requested);
  // P-F2: more than one substitution of the same path, or subject AND substitute both executing.
  const multiplicity = aimed.length > 1 || (requested && subjectExecuted && legasusExecuted.includes(requested)) || new Set(loaded).size > 1;

  let state;
  if (multiplicity) state = 'INTERVENTION_MULTIPLICITY';
  else if (!executed) state = 'SUBSTITUTION_UNOBSERVED';
  else if (!served && !requested) state = 'SUBSTITUTION_UNOBSERVED';
  else if (requested !== served) state = 'IDENTITY_MISMATCH';
  else if (served !== executed) state = 'TRANSPORT_CONTRADICTION';
  else if (unauthorized.length) state = 'SCOPE_VIOLATION';
  else state = 'VALID_INTERVENTION';
  // A bypass leaves no marker at all: executed is absent, which the first rules already catch.
  if (!requested && !served && !executed) state = 'SUBSTITUTION_UNOBSERVED';

  const caseLines = ((r.stdout || '').match(/^\s*(PASS|FAIL) /gm) || []).length;
  const failLines = ((r.stdout || '').match(/^\s*FAIL /gm) || []).length;
  results.push({ id: c.id, requested, served, executed, state, expected: c.expect, match: state === c.expect,
    scope: { executedScriptUrls: urls.length, coverageFiles: covFiles, legasusFilesExecuted: legasusExecuted, unauthorized, subjectAlsoExecuted: subjectExecuted },
    multiplicity: { servedRecordsForSubject: aimed.length, distinctMarkerIdentities: [...new Set(loaded)], flagged: multiplicity },
    witness: { exit: r.status, caseLines, failLines, tail: (r.stdout || '').trim().split('\n').slice(-2).join(' | ').slice(0, 200) },
    foreignFilesTouched: touched, mechanismRecords: mech.length });
  const x = results[results.length - 1];
  console.log(`  ${x.id} ${x.match ? 'ok  ' : 'MISS'} req=${String(x.requested).padEnd(13)} served=${String(x.served).padEnd(13)} exec=${String(x.executed).padEnd(13)} -> ${x.state.padEnd(26)} (wanted ${x.expected}) exit=${x.witness.exit} cases=${x.witness.caseLines}/${x.witness.failLines}F scripts=${x.scope.executedScriptUrls} legasus=[${x.scope.legasusFilesExecuted.join(',')}] touched=${x.foreignFilesTouched.length}`);
}

const allMatch = results.every((x) => x.match);
const noTouch = results.every((x) => x.foreignFilesTouched.length === 0);
const verdict = allMatch && noTouch
  ? { status: 'TRANSFER_ESTABLISHED', reason: 'the unchanged qualified mechanism produced every preregistered state on the foreign subject, and no foreign file was modified' }
  : { status: 'TRANSFER_FAILED', reason: `state mismatches: ${results.filter((x) => !x.match).map((x) => `${x.id} got ${x.state} wanted ${x.expected}`).join('; ') || 'none'}; foreign files touched: ${results.flatMap((x) => x.foreignFilesTouched).join(', ') || 'none'}` };

writeFileSync(join(outDir, 'transfer.json'), JSON.stringify({ at: new Date().toISOString(), node: process.version,
  mechanism: 'legasus/cjs-preload.mjs @ e41c1e3, unchanged', foreignRoot: FROOT, selectionRecord, fnName,
  mutant: { id: chosenMutant.id, family: chosenMutant.family, describe: chosenMutant.describe }, results, verdict,
  R4: 'UNESTABLISHED - the foreign codebase has no manifest, no test script and no VCS; the invocation used here (`node <witness>`, cwd = foreign root) is this probe\'s choice, not the codebase\'s statement. Substitution success does not establish it.' }, null, 2));

console.log(`VERDICT: ${verdict.status} - ${verdict.reason}`);
console.log(`R8 substitution: ${allMatch ? 'ESTABLISHED for this foreign subject' : 'NOT ESTABLISHED'}   |   R4 invocation: UNESTABLISHED`);
console.log(`-> ${join(outDir, 'transfer.json')}`);
