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

let targets = [];
let storeUrl = '';

export async function initialize(data) {
  targets = (data && data.targets) || [];
  storeUrl = (data && data.storeUrl) || '';
}

export async function load(url, context, nextLoad) {
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
