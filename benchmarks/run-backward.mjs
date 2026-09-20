// BACKWARD-1 — discovery from effect sinks.
//
//     node benchmarks/run-backward.mjs [--root <dir>] [entry ...]
//
// Nothing here names a function, a module or an API of the subject. The only inputs are the frozen
// SINK CLASSES and their runtime module boundaries, which are properties of the Node platform.
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { SINK_MODULES, SINK_CLASS, REACHABILITY, STAGE } from '../legasus/legascreen/sink.mjs';

const argv = process.argv.slice(2);
const rootIx = argv.indexOf('--root');
const ROOT = rootIx >= 0 ? resolve(argv[rootIx + 1])
  : resolve(fileURLToPath(new URL('../legasus', import.meta.url)));
const rest = argv.filter((a, i) => i !== rootIx && i !== rootIx + 1);

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

if (!process.env.LGS_WITNESS) {
  const self = fileURLToPath(import.meta.url);
  const reg = resolve(fileURLToPath(new URL('../legasus/legascreen/witness-register.mjs', import.meta.url)));
  const r = spawnSync(process.execPath,
    ['--import', pathToFileURL(reg).href, self, '--root', ROOT, ...ENTRIES],
    { stdio: 'inherit', env: { ...process.env, LGS_WITNESS: '1', PYTHONDONTWRITEBYTECODE: '1',
      LGS_WITNESS_CONFIG: JSON.stringify({ targets: [], sinkModules: SINK_MODULES, sinkRoots: [pathToFileURL(ROOT).href] }) } });
  process.exit(r.status === null ? 1 : r.status);
}

const { SINKS } = await import('../legasus/legascreen/witness-store.mjs');
const { indexTree, testBackdoors, noProductionConsumer, classifyEvent, observability } = await import('../legasus/legascreen/ancestry.mjs');
const { discover } = await import('../legasus/legascreen/surface.mjs');
const fwdSurface = discover(ROOT);

const say = (...a) => console.log(...a);
let loaded = 0;
for (const e of ENTRIES) {
  try { await import(pathToFileURL(resolve(e)).href); loaded++; } catch { /* a subject may refuse */ }
}

process.on('exit', () => {
  const index = indexTree(ROOT);
  const backdoors = testBackdoors(index);
  const noConsumer = noProductionConsumer(index);
  const events = SINKS.events().map((e) => classifyEvent(e, index, backdoors));

  const prod = events.filter((e) => e.reachability === REACHABILITY.PRODUCTION_REACHED);
  const tOnly = events.filter((e) => e.reachability === REACHABILITY.TEST_ONLY);
  const holed = events.filter((e) => e.reachability === REACHABILITY.ANCESTRY_INCOMPLETE);
  const obs = observability(index);

  const privateFns = new Map();     // file::fn -> effects it participated in
  for (const e of prod) {
    for (const p of e.privateOnPath.filter((x) => !x.file.startsWith('legascreen/'))) {
      const k = p.file + '::' + p.fn;
      if (!privateFns.has(k)) privateFns.set(k, new Set());
      privateFns.get(k).add(e.sinkClass);
    }
  }
  const exportedFns = new Set(prod.flatMap((e) => e.exportedOnPath
    .filter((p) => !p.file.startsWith('legascreen/')).map((p) => p.file + '::' + p.fn)));

  const byClass = events.reduce((m, e) => m.set(e.sinkClass, (m.get(e.sinkClass) || 0) + 1), new Map());

  say('');
  say('======================================================================');
  say('BACKWARD-1   root: ' + ROOT);
  say('  entries loaded: ' + loaded + ' / ' + ENTRIES.length
    + '   modules indexed: ' + index.byFile.size);
  say('  SINK CLASSES ARMED (categories, no subject names): '
    + Object.keys(SINK_CLASS).length + '   runtime boundaries: ' + Object.keys(SINK_MODULES).length);
  say('');
  say('  ' + STAGE.EFFECT_WITNESSED.padEnd(26) + String(events.length).padStart(6));
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
  for (const t of [...backdoors].slice(0, 6)) say('      ' + t);
  say('  exports with NO PRODUCTION CONSUMER (a fact about the repo, NOT used for reachability): ' + noConsumer.size);
  say('');
  say('  ' + STAGE.ANCESTRY_OBSERVED + ' over PRODUCTION_REACHED effects:');
  say('      PRIVATE functions on a witnessed effect path   ' + String(privateFns.size).padStart(5));
  say('      exported functions on a witnessed effect path  ' + String(exportedFns.size).padStart(5));
  const top = [...privateFns].sort((a, b) => b[1].size - a[1].size).slice(0, 8);
  for (const [k, cls] of top) say('          ' + k.padEnd(56) + [...cls].join(','));
  say('');
  // BK-4. The forward surface and the backward surface, and what they share.
  const fwd = new Set(fwdSurface.candidates.filter((c) => !c.module.startsWith('legascreen/'))
    .map((c) => c.module + '::' + c.fn));
  const bwd = new Set([...privateFns.keys(), ...exportedFns]);
  const both = [...bwd].filter((k) => fwd.has(k));
  say('  BK-4 THE TWO SURFACES:');
  say('      forward only (brand-seeded)    ' + String([...fwd].filter((k) => !bwd.has(k)).length).padStart(5));
  say('      backward only (sink-seeded)    ' + String([...bwd].filter((k) => !fwd.has(k)).length).padStart(5));
  say('      INTERSECTION                   ' + String(both.length).padStart(5));
  for (const k of both.slice(0, 5)) say('          ' + k);
  say('');
  say('  NOT REACHED BY THIS SLICE: ' + STAGE.SUPPORT_CHARACTERIZED + ', '
    + STAGE.JUSTIFICATION_ESTABLISHED + ', ' + STAGE.SCREENED);
  say('  Appearing on a path is PARTICIPATION, not RELEVANCE. Relevance needs perturbation.');
  say('======================================================================');
});
