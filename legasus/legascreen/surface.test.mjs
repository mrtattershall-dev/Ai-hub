// CONTROLS FOR SURFACE-1 — predictions S-1..S-6 in benchmarks/SURFACE_1_PREREG.md.
//
// Every fixture is a throwaway module tree written here, so discovery is tested against shapes I
// control rather than against whatever the repository happens to contain. The run over the real tree
// is benchmarks/RESULT.surface.md.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as substrate from './surface.mjs';
import { discover, instrumentationFor, isInstrument, CAVEAT } from './surface.mjs';

function tree(files) {
  const dir = mkdtempSync(join(tmpdir(), 'lgs-surface-'));
  for (const [rel, src] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, src);
  }
  return dir;
}
const names = (s) => s.candidates.map((c) => c.fn).sort();

test('S-2b MUST FIRE — no brand, no candidates: discovery never falls back to names', () => {
  // Every authority-sounding name in the vocabulary, and not one identity brand. If the mechanism
  // were secretly matching names, this would light up.
  const dir = tree({ 'a.mjs': `
    export function observe(x) { return { authority: x }; }
    export function derive(a, b) { return { entitled: true, grant: [], ancestry: [] }; }
    export function delegate(t) { return t; }
    export function commit(claim) { return claim; }
    const token = (o) => Object.freeze(o);
    export function isAuthority(t) { return !!t; }
  ` });
  try {
    const s = discover(dir);
    assert.equal(s.candidates.length, 0, 'names are not evidence of authority');
    assert.deepEqual(s.brandSites, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('S-3b MUST FIRE — a PRIVATE function that touches the brand is discovered, and marked private', () => {
  const dir = tree({ 'a.mjs': `
    const MINTED = new WeakSet();
    const mint = (o) => { const t = Object.freeze(o); MINTED.add(t); return t; };
    export const isThing = (t) => MINTED.has(t);
    function helper(x) { return mint({ x }); }
    export function make(x) { return helper(x); }
    export function unrelated(a, b) { return a + b; }
  ` });
  try {
    const s = discover(dir);
    assert.deepEqual(names(s), ['helper', 'isThing', 'make', 'mint'],
      'the private mint and the private helper are both on the surface; `unrelated` is not');
    const priv = s.candidates.filter((c) => !c.exported).map((c) => c.fn).sort();
    assert.deepEqual(priv, ['helper', 'mint']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('S-3 — private candidates CANNOT be instrumented, and are returned rather than dropped', () => {
  const dir = tree({ 'a.mjs': `
    const B = new WeakSet();
    const mint = (o) => { B.add(o); return o; };
    export const isB = (t) => B.has(t);
    export function make(x) { return mint({ x }); }
  ` });
  try {
    const inst = instrumentationFor(discover(dir));
    assert.deepEqual(inst.unwrappable.map((c) => c.fn), ['mint']);
    assert.deepEqual(inst.targets[0].exports.sort(), ['isB', 'make']);
    assert.deepEqual(inst.targets[0].brands, ['isB'], 'the brand PREDICATE is discovered, not named');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the surface propagates ACROSS modules, through the import graph', () => {
  const dir = tree({
    'core.mjs': `
      const B = new WeakSet();
      export function make(x) { const t = Object.freeze({ x }); B.add(t); return t; }
      export const isB = (t) => B.has(t);
    `,
    'mid.mjs': `
      import { make } from './core.mjs';
      export function build(x) { return make(x); }
      export function nothing() { return 1; }
    `,
    'far.mjs': `
      import { build } from './mid.mjs';
      export function top(x) { return build(x); }
    `,
  });
  try {
    const s = discover(dir);
    const lv = Object.fromEntries(s.candidates.map((c) => [c.fn, c.level]));
    assert.equal(lv.make, 0);
    assert.equal(lv.build, 1);
    assert.equal(lv.top, 2, 'two hops from the brand, still on the surface');
    assert.equal(lv.nothing, undefined, 'and a function that reaches nothing is not');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('A DYNAMIC IMPORT IS INVISIBLE TO STATIC DISCOVERY, and that is a bound to state', () => {
  // Not a defect being hidden: it is the reason CAVEAT exists. A consumer reached only through
  // `await import(...)` does not appear on the surface at all.
  const dir = tree({
    'core.mjs': `
      const B = new WeakSet();
      export function make(x) { const t = Object.freeze({ x }); B.add(t); return t; }
    `,
    'dyn.mjs': `
      export async function sneaky(x) {
        const m = await import('./core.mjs');
        return m.make(x);
      }
    `,
  });
  try {
    const s = discover(dir);
    assert.deepEqual(names(s), ['make'], 'sneaky is NOT discovered');
    assert.match(CAVEAT, /outside this discovery mechanism may exist/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the instrument does not count itself as repository surface', () => {
  assert.equal(isInstrument({ module: 'legascreen/outcome.mjs' }), true);
  assert.equal(isInstrument({ module: 'legaknow/calculus.mjs' }), false);
});

test('S-1 — the substrate exports no vocabulary of authority names', () => {
  assert.deepEqual(Object.keys(substrate).sort(),
    ['CAVEAT', 'REASON', 'discover', 'instrumentationFor', 'isInstrument']);
  assert.equal(typeof CAVEAT, 'string');
  assert.ok(CAVEAT.length > 80, 'the caveat is exported so a report cannot omit it by forgetting');
});
