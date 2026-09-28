// BACKWARD-1 — discovery from effect sinks.
//
//     node benchmarks/run-backward.mjs [--root <dir>] [entry ...]
//
// Nothing here names a function, a module or an API of the subject. The only inputs are the frozen
// SINK CLASSES and their runtime module boundaries, which are properties of the Node platform.
//
// ONE CHILD PER ENTRY, AND THE REPORT IS REGISTERED BEFORE THE SUBJECT LOADS.
//
// RUN 1 of TRANSFER-1 failed here. The harness imported every entry into ONE process and registered
// its exit handler AFTERWARDS. All 90 of the hub's test files call process.exit, so the second one
// ended the process before the handler existed: exit 0, no report, and nothing to distinguish that
// from a subject with no effects. The assumption - A SUBJECT DOES NOT TERMINATE THE PROCESS - was
// true of Legasus, whose tests are node:test, and was never stated because nothing had violated it.
//
// So each entry now runs in its own child, the child writes its observations before the subject can
// take the process away, and an entry that exits, hangs or crashes is a COORDINATE rather than a
// silence.
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { readdirSync, statSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { SINK_MODULES, SINK_CLASS, REACHABILITY, STAGE } from '../legasus/legascreen/sink.mjs';

const argv = process.argv.slice(2);
const rootIx = argv.indexOf('--root');
const ROOT = rootIx >= 0 ? resolve(argv[rootIx + 1])
  : resolve(fileURLToPath(new URL('../legasus', import.meta.url)));
const rest = argv.filter((a, i) => i !== rootIx && i !== rootIx + 1);

// The CHILD lives in benchmarks/backward-child.mjs. It used to be a branch here that ended with
// process.exit(0); when that exit was removed so subjects could drain, the branch FELL THROUGH into
// this parent section and every child started a run of its own. A separate file makes that
// unrepresentable rather than forbidden.

const testFiles = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) testFiles(p, out);
    else if (/\.test\.[cm]?js$/.test(p)) out.push(p);
  }
  return out;
};
const ENTRIES = rest.length ? rest : testFiles(ROOT);

// ---------------------------------------------------------------- PARENT: aggregate the children
const reg = resolve(fileURLToPath(new URL('../legasus/legascreen/witness-register.mjs', import.meta.url)));
const child = resolve(fileURLToPath(new URL('./backward-child.mjs', import.meta.url)));
const tmp = mkdtempSync(join(tmpdir(), 'lgs-bw-'));
const cfg = JSON.stringify({ targets: [], sinkModules: SINK_MODULES,
  sinkRoots: [pathToFileURL(ROOT).href] });

const events = [];
// THE INVARIANT BEING DEFENDED: a subject's control over its own lifetime must not control whether
// the observer records that observation's epistemic state, nor whether later observations happen.
const entryOutcome = {
  COMPLETE: 0,                 // loaded to the end AND drained naturally: the only scorable one
  REFUSED: 0,                  // the entry threw on load; observed, and not the observer's failure
  SUBJECT_TERMINATED: 0,       // the subject ended the process mid-load: effects UNESTABLISHED
  DRAIN_INCOMPLETE: 0,         // loaded, but still held the process at the grace bound
  TIMED_OUT: 0,                // the subject never gave the process back at all
  NO_RECORD: 0,                // the child died without writing: the observer learned nothing
};
// Every child this run starts, so none can outlive it. The leak that made this necessary cost two
// other sessions their machine for an hour.
const spawned = [];
// COMPLETE entries are the only ones that may support "this entry caused no effects".
const effectsUnestablished = [];
const PER_ENTRY_MS = Number(process.env.LGS_ENTRY_MS || 90000);

for (let i = 0; i < ENTRIES.length; i++) {
  const out = join(tmp, 'e' + i + '.json');
  const r = spawnSync(process.execPath, ['--import', pathToFileURL(reg).href, child],
    { stdio: ['ignore', 'ignore', 'ignore'], timeout: PER_ENTRY_MS,
      env: { ...process.env, LGS_WITNESS: '1', LGS_ONE: ENTRIES[i], LGS_OUT: out,
        LGS_WITNESS_CONFIG: cfg, PYTHONDONTWRITEBYTECODE: '1' } });
  if (r.pid) spawned.push(r.pid);
  let rec = null;
  if (existsSync(out)) { try { rec = JSON.parse(readFileSync(out, 'utf8')); } catch { rec = null; } }
  if (!rec) {
    if (r.error && String(r.error.code) === 'ETIMEDOUT') entryOutcome.TIMED_OUT++;
    else entryOutcome.NO_RECORD++;
    effectsUnestablished.push(ENTRIES[i]);
    continue;
  }
  events.push(...(rec.events || []));
  // Observations already recorded are real in every case below; what varies is whether the ENTRY
  // finished. Only a natural drain licenses "this entry caused nothing".
  if (rec.phase === 'REFUSED') entryOutcome.REFUSED++;
  else if (rec.phase === 'LOADED' && rec.exitKind === 'NATURAL') entryOutcome.COMPLETE++;
  else if (rec.phase === 'LOADED') {
    entryOutcome.DRAIN_INCOMPLETE++;
    effectsUnestablished.push(ENTRIES[i]);
  } else {
    entryOutcome.SUBJECT_TERMINATED++;
    effectsUnestablished.push(ENTRIES[i]);
  }
}
rmSync(tmp, { recursive: true, force: true });

// NO CHILD OUTLIVES THE RUN. spawnSync's timeout does not reliably reap on Windows, and an observer
// that leaves processes behind is measuring its own load from then on.
let swept = 0;
for (const pid of spawned) {
  try { process.kill(pid, 0); } catch { continue; }          // already gone
  try { process.kill(pid, 'SIGKILL'); swept++; } catch { /* raced us; fine */ }
}

const { indexTree, testBackdoors, noProductionConsumer, classifyEvent, observability }
  = await import('../legasus/legascreen/ancestry.mjs');
const { discover } = await import('../legasus/legascreen/surface.mjs');

const say = (...a) => console.log(...a);
const index = indexTree(ROOT);
const backdoors = testBackdoors(index);
const noConsumer = noProductionConsumer(index);
const obs = observability(index);
let fwdSurface = { candidates: [] };
try { fwdSurface = discover(ROOT); } catch { /* a subject may defeat static discovery */ }

const rows = events.map((e) => classifyEvent(e, index, backdoors));
const prod = rows.filter((e) => e.reachability === REACHABILITY.PRODUCTION_REACHED);
const tOnly = rows.filter((e) => e.reachability === REACHABILITY.TEST_ONLY);
const holed = rows.filter((e) => e.reachability === REACHABILITY.ANCESTRY_INCOMPLETE);

const privateFns = new Map();
for (const e of prod) {
  for (const p of e.privateOnPath.filter((x) => !x.file.startsWith('legascreen/'))) {
    const k = p.file + '::' + p.fn;
    if (!privateFns.has(k)) privateFns.set(k, new Set());
    privateFns.get(k).add(e.sinkClass);
  }
}
const exportedFns = new Set(prod.flatMap((e) => e.exportedOnPath
  .filter((p) => !p.file.startsWith('legascreen/')).map((p) => p.file + '::' + p.fn)));
const byClass = rows.reduce((m, e) => m.set(e.sinkClass, (m.get(e.sinkClass) || 0) + 1), new Map());

say('');
say('======================================================================');
say('BACKWARD-1   root: ' + ROOT);
say('  entries: ' + ENTRIES.length + '   modules indexed: ' + index.byFile.size);
say('  ENTRY LIFECYCLE (a subject controlling its own lifetime must not control what the');
say('  observer records, nor whether later entries run):');
for (const [k, n] of Object.entries(entryOutcome)) say('      ' + k.padEnd(20) + String(n).padStart(5));
say('      children swept at end of run (must be 0): ' + swept);
  say('      entries whose EFFECTS ARE UNESTABLISHED: ' + effectsUnestablished.length
  + '   (zero effects from these is NOT "no effects")');
say('  SINK CLASSES ARMED (categories, no subject names): ' + Object.keys(SINK_CLASS).length
  + '   runtime boundaries: ' + Object.keys(SINK_MODULES).length);
say('');
say('  ' + STAGE.EFFECT_WITNESSED.padEnd(26) + String(rows.length).padStart(6));
for (const [c, n] of [...byClass].sort((a, b) => b[1] - a[1])) {
  say('      ' + c.padEnd(26) + String(n).padStart(6));
}
say('');
say('  REACHABILITY (test-only accessibility cannot establish production reachability):');
say('      PRODUCTION_REACHED        ' + String(prod.length).padStart(6));
say('      TEST_ONLY                 ' + String(tOnly.length).padStart(6));
say('      ANCESTRY_INCOMPLETE       ' + String(holed.length).padStart(6)
  + '   a hole in the path poisons the claim, it does not empty it');
say('');
say('  WHAT THIS INSTRUMENT CAN SEE AT ALL (the denominator must say):');
for (const [k, n] of Object.entries(obs)) say('      ' + k.padEnd(34) + String(n).padStart(5));
say('');
say('  TEST BACKDOORS DISCOVERED BY STRUCTURE (not named): ' + backdoors.size);
for (const t of [...backdoors].slice(0, 8)) say('      ' + t);
say('  exports with NO PRODUCTION CONSUMER (a fact about the repo, NOT used for reachability): '
  + noConsumer.size);
say('');
say('  ' + STAGE.ANCESTRY_OBSERVED + ' over PRODUCTION_REACHED effects:');
say('      PRIVATE functions on a witnessed effect path   ' + String(privateFns.size).padStart(5));
say('      exported functions on a witnessed effect path  ' + String(exportedFns.size).padStart(5));
for (const [k, cls] of [...privateFns].sort((a, b) => b[1].size - a[1].size).slice(0, 10)) {
  say('          ' + k.padEnd(58) + [...cls].join(','));
}
say('');
const fwd = new Set(fwdSurface.candidates.filter((c) => !c.module.startsWith('legascreen/'))
  .map((c) => c.module + '::' + c.fn));
const bwd = new Set([...privateFns.keys(), ...exportedFns]);
const both = [...bwd].filter((k) => fwd.has(k));
say('  THE TWO SURFACES (intersection is NOT the success metric):');
say('      forward only (brand-seeded)    ' + String([...fwd].filter((k) => !bwd.has(k)).length).padStart(5));
say('      backward only (sink-seeded)    ' + String([...bwd].filter((k) => !fwd.has(k)).length).padStart(5));
say('      INTERSECTION                   ' + String(both.length).padStart(5));
say('');
say('  NOT REACHED BY THIS SLICE: ' + STAGE.SUPPORT_CHARACTERIZED + ', '
  + STAGE.JUSTIFICATION_ESTABLISHED + ', ' + STAGE.SCREENED);
say('  Appearing on a path is PARTICIPATION, not RELEVANCE. Relevance needs perturbation.');
say('======================================================================');
