// D1..D4 — does a mechanically derived dependency closure fix R-W4 without failing D4?
//
// Predictions frozen in DEPENDENCY-CLOSURE_PREREG.md. No hand-maintained dependency list exists and
// none is introduced if this fails.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fingerprintOf, semanticClosure, definitionsIn, UNRESOLVED } from './fingerprint.mjs';
import { ADMITTED_RULES } from './rules.mjs';

// SYNTHETIC MODULES, so D1-D4 each vary exactly one thing. A three-level chain plus an unrelated
// function that nothing in the chain calls.
const mod = ({ matcher, helper, deep, unrelated }) => ({ path: 'synthetic.mjs', source: `
function deepCompare(a, b) { return ${deep}; }
function resolveWorld(w, ctx) { return ${helper}; }
function unrelatedLogging(x) { return ${unrelated}; }
` });
const BASE = { matcher: 'resolveWorld(w, ctx)', helper: 'deepCompare(w.r, ctx.r)',
  deep: 'a === b', unrelated: 'String(x)' };

const ruleOf = (matcherBody) => ({ name: 'r', version: '1',
  obligations: [{ relation: 'X', satisfiedBy: new Function('w', 'ctx', 'return ' + matcherBody + ';') }] });

function fp(over = {}) {
  const cfg = { ...BASE, ...over };
  const r = fingerprintOf(ruleOf(cfg.matcher), [mod(cfg)]);
  assert.equal(r.ok, true, r.why);
  return r.digest;
}

const BASELINE = fp();

test('the closure, printed so the record carries what it covers', () => {
  const cl = semanticClosure('__m', 'function __m(w, ctx) { return resolveWorld(w, ctx); }',
    [mod(BASE)]);
  assert.equal(cl.ok, true, cl.why);
  console.log('\n  covered: ' + cl.closure.map((c) => c.name).join(' -> '));
  console.log('  grounds: ' + (cl.grounds.join(', ') || '(none)') + '\n');
  assert.deepEqual(cl.closure.map((c) => c.name).sort(), ['__m', 'deepCompare', 'resolveWorld']);
});

test('D1 — changing the MATCHER body moves the fingerprint', () => {
  assert.notEqual(fp({ matcher: 'resolveWorld(ctx, w)' }), BASELINE);
});

test('D2 — matcher unchanged, changing a DIRECTLY CALLED helper moves it', () => {
  assert.notEqual(fp({ helper: 'deepCompare(w.r, ctx.r) && w.d === ctx.d' }), BASELINE);
});

test('D3 — matcher and direct helper unchanged, changing a HELPER-OF-A-HELPER moves it', () => {
  assert.notEqual(fp({ deep: 'a >= b' }), BASELINE,
    'the semantics two calls away are part of what the rule means');
});

test('D4 ANTI-REFUSAL — changing UNRELATED code in the same module does NOT move it', () => {
  assert.equal(fp({ unrelated: 'JSON.stringify(x) + "!"' }), BASELINE,
    'semantic dependency closure, not textual blast radius');
});

test('F-3 — an unresolvable dependency yields FINGERPRINT_UNRESOLVED, never a hash', () => {
  const opaque = { path: 'o.mjs', source: 'import { mystery } from \'some-external-pkg\';\n'
    + 'function resolveWorld(w, ctx) { return mystery(w); }\n' };
  const r = fingerprintOf(ruleOf('resolveWorld(w, ctx)'), [opaque]);
  assert.equal(r.ok, false);
  assert.match(r.why, new RegExp(UNRESOLVED));
  assert.match(r.why, /cannot see into/);
  assert.equal(r.digest, undefined, 'no hash is produced over an incomplete closure');

  // and a name that resolves to nothing at all
  const dangling = { path: 'd.mjs', source: 'function resolveWorld(w) { return nowhere(w); }\n' };
  const r2 = fingerprintOf(ruleOf('resolveWorld(w, ctx)'), [dangling]);
  assert.equal(r2.ok, false);
  assert.match(r2.why, /resolves to no definition, import or global/);
});

test('node: builtins and globals are admitted GROUND, not unresolved', () => {
  const m = { path: 'g.mjs', source: 'import { createHash } from \'node:crypto\';\n'
    + 'function resolveWorld(w) { return createHash(\'sha256\').update(String(w)); }\n' };
  const r = fingerprintOf(ruleOf('resolveWorld(w, ctx)'), [m]);
  assert.equal(r.ok, true, r.why);
  assert.ok(r.digest);
});

// ---------------------------------------------------------------------------------------------------
// F-2 — the real registry. This is the R-W4 case itself.

// The kernel is included. What `isAuthority` MEANS is part of what the rule means, and treating
// legaknow as unexaminable ground would be "admitted ground that can change silently" - the defect
// this whole line removes. Reading it is not modifying it; C-4 and L-4 still assert it is
// byte-unchanged.
const REAL = [
  ...['rules.mjs', 'authority-store.mjs'].map((f) => ({ path: f,
    source: readFileSync(new URL('./' + f, import.meta.url), 'utf8') })),
  ...['calculus.mjs', 'observation.mjs'].map((f) => ({ path: 'legaknow/' + f,
    source: readFileSync(new URL('../../legaknow/' + f, import.meta.url), 'utf8') })),
];

test('F-2 — the real closure reaches the world check inside resolveEvidenceRoot', () => {
  const rule = ADMITTED_RULES['universal-from-exhaustive-coverage'];
  const r = fingerprintOf(rule, REAL);
  assert.equal(r.ok, true, r.why);
  console.log('  real closure covers: ' + r.covered.join(', '));
  assert.ok(r.covered.includes('resolveEvidenceRoot'),
    'the function the old digest could not see is now inside the fingerprint');
});

test('F-2 — changing `extent >= required` to `===` MOVES the real fingerprint', () => {
  // The exact change R-W4 proved invisible. Every declaration string is unchanged.
  const rule = ADMITTED_RULES['universal-from-exhaustive-coverage'];
  const before = fingerprintOf(rule, REAL);
  const mutated = REAL.map((m) => (m.path !== 'authority-store.mjs' ? m : { ...m,
    source: m.source.replace('c.examined < ctx.requiredExtent', 'c.examined !== ctx.requiredExtent') }));
  assert.notEqual(mutated[1].source, REAL[1].source, 'the mutation applied');
  const after = fingerprintOf(rule, mutated);
  assert.equal(after.ok, true, after.why);
  assert.notEqual(after.digest, before.digest,
    'R-W4 REPAIRED: a semantic change one call away now moves the rule identity');
});

test('F-4 — an irrelevant dependency DOES churn the fingerprint, predicted and not solved', () => {
  // A logging helper cannot affect the decision, and a call-closure builder includes it anyway.
  // Predicted in the prereg. Whether "transitively called" is too broad should be established by
  // observing churn, not designed around in advance.
  const withLog = { matcher: 'logIt(w) || resolveWorld(w, ctx)' };
  const m = (unrelated) => ({ path: 's.mjs', source: `
function deepCompare(a, b) { return a === b; }
function resolveWorld(w, ctx) { return deepCompare(w.r, ctx.r); }
function logIt(x) { return ${unrelated}; }
` });
  const a = fingerprintOf(ruleOf(withLog.matcher), [m('false')]);
  const b = fingerprintOf(ruleOf(withLog.matcher), [m('false /* changed message */ || false')]);
  assert.equal(a.ok, true); assert.equal(b.ok, true);
  assert.notEqual(a.digest, b.digest,
    'PREDICTED: the fingerprint churns on a change that cannot affect the decision');
});
