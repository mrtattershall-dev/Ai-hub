'use strict';
// =============================================================================
// SANDBOX WORKER — the containment boundary that makes BOUNDED and SAFE MEASURED
// rather than claimed. Every adapter run() executes HERE, in a worker_threads
// Worker, so the main harness can:
//   - kill a non-terminating run() (wall-clock terminate from the main thread)
//   - cap memory (resourceLimits.maxOldGenerationSizeMb -> 'error'/'exit')
//   - observe host ESCAPE via a per-run canary on this worker's real global
// A malicious adapter therefore cannot opt out of the bound: the guarantee comes
// from the harness process boundary, not the adapter's cooperation. (This is the
// point NC-raweval proves.) Compile is also run here so a source that loops the
// PARSER is contained the same way.
//
// The worker requires the corpus + the adapter module by PATH (functions can't
// cross postMessage), looks the behavior up by id, hands the adapter its
// `sourceKey` encoding, runs it against a tripwire view built from the fixture,
// and posts back { ops, reads, usage, canaryDirty } or a compile error list.
// One message in flight at a time; the main thread respawns after any kill.
// =============================================================================

const { parentPort, workerData } = require('worker_threads');
const corpus = require('./corpus.js');

const adapterMod = require(workerData.adapterModulePath);
const adapter = adapterMod.adapters ? adapterMod.adapters[workerData.adapterName] : adapterMod;
if (!adapter) throw new Error(`worker: adapter "${workerData.adapterName}" not found in ${workerData.adapterModulePath}`);

const CANARY_CLEAN = 'clean';

parentPort.on('message', (msg) => {
  try {
    if (msg.kind === 'compile') {
      const beh = corpus.MALFORMED.find(b => b.id === msg.behaviorId)
        || corpus.byId.get(msg.behaviorId);
      const src = beh.sources ? beh.sources[adapter.sourceKey] : beh.source;
      const c = adapter.compile(src);
      parentPort.postMessage({ id: msg.id, phase: 'compile', compileOk: !!c.ok, errors: c.ok ? null : c.errors });
      return;
    }

    // kind === 'run'
    const beh = corpus.byId.get(msg.behaviorId);
    const src = beh.sources[adapter.sourceKey];
    const c = adapter.compile(src);
    if (!c.ok) { parentPort.postMessage({ id: msg.id, phase: 'run', compileOk: false, errors: c.errors }); return; }

    // fresh tripwire view; optional seed-driven shuffle of enumeration order so
    // the harness can probe order-independence (a deterministic rep is invariant).
    const built = corpus.makeView(beh.fixture);
    const view = maybeShuffleView(built.view, msg.seed);

    globalThis.__CANARY__ = CANARY_CLEAN;
    const t0 = now();
    let ops, threw = null;
    try { const r = adapter.run(c.behavior, view, msg.budget); ops = normalizeOps(r); }
    catch (e) { threw = String(e && e.message || e); ops = []; }
    const wallMs = now() - t0;
    const canaryDirty = globalThis.__CANARY__ !== CANARY_CLEAN;
    globalThis.__CANARY__ = CANARY_CLEAN;

    parentPort.postMessage({
      id: msg.id, phase: 'run', compileOk: true,
      ops, reads: [...built.reads], threw, canaryDirty,
      usage: { wallMs, opCount: ops.length, spawnCount: ops.filter(o => o && o.kind === 'createChild').length },
    });
  } catch (e) {
    parentPort.postMessage({ id: msg.id, phase: 'error', fatal: String(e && e.stack || e) });
  }
});

// adapter.run may return {ops} or a bare ops array; normalize to an array.
function normalizeOps(r) {
  if (Array.isArray(r)) return r;
  if (r && Array.isArray(r.ops)) return r.ops;
  return [];
}

// deterministic seeded shuffle (mulberry32) — no Math.random (that would inject
// the very nondeterminism we test for). Wraps allOfType only; identity otherwise.
function maybeShuffleView(view, seed) {
  if (!seed) return view;
  let s = seed >>> 0;
  const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const shuffled = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return Object.freeze({ ...pluck(view), tick: view.tick, allOfType: (t) => shuffled(view.allOfType(t)) });
}
// copy the frozen view's own callable props (spread drops them on a frozen obj in some paths)
function pluck(view) {
  return { field: view.field, typeOf: view.typeOf, nameOf: view.nameOf, parentOf: view.parentOf, childrenOf: view.childrenOf };
}

function now() { const [s, ns] = process.hrtime(); return s * 1000 + ns / 1e6; }
