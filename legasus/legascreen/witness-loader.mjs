// THE LOADER HOOK — how an existing test gets witnessed without being touched.
//
// An ES module namespace is immutable from the outside, so `C.derive = wrapped` is not available and
// an already-written test cannot be intercepted by assignment. Substituting the MODULE is available.
//
// For a configured module, this returns a shim that re-exports the real module and wraps the named
// exports. The test imports what it always imported and calls what it always called.
//
//     existing test  --imports-->  [shim]  --delegates-->  real calculus.mjs
//
// THE SHIM ADDS NO CAPABILITY. It has no constructor of its own; every wrapper calls the real
// function and returns the real value, so a token minted under instrumentation is the same token
// production mints - it is minted BY production. Instrumentation that could produce an authority
// object would be the backdoor this whole line of work refuses.
const RAW = '__lgs=raw';
const SINK = 'lgs-sink:';

let targets = [];
let storeUrl = '';
let sinkModules = {};
let sinkRoots = [];

export async function initialize(data) {
  targets = (data && data.targets) || [];
  storeUrl = (data && data.storeUrl) || '';
  sinkModules = (data && data.sinkModules) || {};
  sinkRoots = ((data && data.sinkRoots) || []).map((r) => String(r));
}

// BACKWARD-1. A runtime module boundary cannot carry a query string the way a file URL can, so the
// bypass is the PARENT: a request coming from inside a generated sink shim resolves to the real
// builtin, and every other request for that specifier resolves to the shim.
// SCOPED TO THE SUBJECT TREE, and that scoping is not optional. The first version redirected `fs`
// for EVERY importer, including Node's own module machinery and the recorder itself: the child
// process then produced no output at all and exited 0 - a silent death, which is the failure class
// this project hunts, committed in the loader that hunts it.
export async function resolve(specifier, context, nextResolve) {
  const parent = String(context.parentURL || '');
  if (!parent || parent.startsWith(SINK) || !Object.hasOwn(sinkModules, specifier)) {
    return nextResolve(specifier, context);
  }
  const inSubject = sinkRoots.some((r) => parent.startsWith(r));
  const isInstrument = parent.includes('/legascreen/');
  if (!inSubject || isInstrument) return nextResolve(specifier, context);
  return { url: SINK + specifier, shortCircuit: true };
}

export async function load(url, context, nextLoad) {
  // A SINK SHIM WRAPS EVERY EXPORT, discovered at load time rather than listed. Nothing here picks
  // the interesting functions, so the mechanism cannot be accused of knowing which ones matter.
  if (url.startsWith(SINK)) {
    const real = url.slice(SINK.length);
    const ns = await import(real);
    const names = Object.keys(ns).filter((n) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n) && n !== 'default');
    const q = (s) => JSON.stringify(s);
    const lines = [
      'import * as __raw from ' + q(real) + ';',
      'import { __sink } from ' + q(storeUrl) + ';',
      'const __c = ' + q(sinkModules[real] || 'UNKNOWN') + ';',
    ];
    for (const n of names) {
      lines.push('export const ' + n + ' = __sink(__c, ' + q(real) + ', ' + q(n) + ', __raw.' + n + ');');
    }
    lines.push('export default __raw.default === undefined ? undefined'
      + ' : __sink(__c, ' + q(real) + ', "default", __raw.default);');
    return { format: 'module', shortCircuit: true, source: lines.join('\n') + '\n' };
  }
  if (url.includes(RAW) || !storeUrl) return nextLoad(url, context);
  const norm = url.replace(/\\/g, '/');
  const t = targets.find((x) => norm.includes(x.match));
  if (!t) return nextLoad(url, context);

  const raw = url + (url.includes('?') ? '&' : '?') + RAW;
  const q = (s) => JSON.stringify(s);
  const lines = [
    'import * as __raw from ' + q(raw) + ';',
    'import { __wrap, __brand } from ' + q(storeUrl) + ';',
    'export * from ' + q(raw) + ';',
  ];
  for (const b of t.brands || []) lines.push('__brand(__raw.' + b + ');');
  for (const n of t.exports || []) {
    lines.push('export const ' + n + ' = __wrap(' + q(t.name + '.' + n) + ', __raw.' + n + ');');
  }
  return { format: 'module', shortCircuit: true, source: lines.join('\n') + '\n' };
}
