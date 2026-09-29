/**
 * authorityScope.test.mjs — W6a, the ALGEBRAIC world, exactly as preregistered.
 *
 *   node server/authorityScope.test.mjs
 *
 * W6a attacks the relation, not the controller: `attenuate(attenuate(S,A),B) ⊆ attenuate(S,A)`, plus
 * the property the whole hypothesis rests on — that no request can produce authority the parent did
 * not hold.
 *
 * WHAT W6a IS NOT EVIDENCE FOR, stated here because the preregistration's Amendment 1 requires it:
 * passing this says NOTHING about whether authority composes in the live path. A function with the
 * right algebra, installed by a mechanism that overwrites shared state, still loses the property.
 * That is W6b/W9's job and it is a different experiment.
 *
 * THE MUST-FIRE CONTROL IS THE POINT. `brokenAttenuate` unions instead of intersecting. Every
 * property below is run against it too, and the non-amplification properties MUST FAIL for it. A
 * property suite that passes for both implementations would be measuring nothing - which is the
 * shape of an assertion that cannot fail, and this repo has shipped that mistake before.
 */
import { attenuate, normalizeScope } from './authorityScope.mjs';

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) { pass++; console.log('  ok    ' + what); } else { fail++; console.log('  FAIL  ' + what); } };

const subset = (xs, ys) => xs.every((x) => ys.includes(x));
const D = (have, asked) => attenuate(have, asked).delegated;

// The saboteur: same signature, union semantics. Nothing else about it differs.
const brokenAttenuate = (have, asked) => {
  const h = normalizeScope(have), a = asked == null ? [] : normalizeScope(asked);
  return { delegated: [...new Set([...h, ...a])] };
};
const BD = (have, asked) => brokenAttenuate(have, asked).delegated;

// ── deterministic cases from the brief ───────────────────────────────────────────────────────────
console.log('W6a — the attenuation relation');

ok(D(['a.py'], ['a.py', 'b.py', 'c.py', 'd.py', 'everything']).join(',') === 'a.py',
  'A LIE BUYS NOTHING: parent {a}, request {a,b,c,d,everything} -> {a}');
ok(D([], ['a.py']).length === 0, 'empty parent, request {a} -> nothing');
ok(D(['a.py', 'b.py'], ['a.py']).join(',') === 'a.py', 'parent {a,b}, request {a} -> {a} (narrowing works)');
ok(D(['a.py'], ['b.py']).length === 0, 'parent {a}, request {b} -> nothing');
ok(D(['a.py', 'b.py'], null).join(',') === 'a.py,b.py', 'no request -> the parent set passes unchanged');
ok(attenuate(['a.py', 'b.py'], null).leastAuthority === false,
  'and that crossing REPORTS leastAuthority false rather than pretending otherwise');
ok(attenuate(['a.py'], ['a.py', 'b.py']).refusedFromRequest.join(',') === 'b.py',
  'the overreach is recorded in refusedFromRequest, not silently dropped');

// spelling: one path must not become two, and a traversal must not smuggle a new member in
ok(D(['a.py'], ['./a.py']).join(',') === 'a.py', 'spelling: ./a.py matches a.py');
ok(D(['dir/a.py'], ['dir\\a.py']).join(',') === 'dir/a.py', 'spelling: backslashes normalise');
ok(D(['a.py'], ['  a.py  ']).join(',') === 'a.py', 'spelling: surrounding space normalises');
ok(D(['a.py'], ['../a.py']).length === 0, 'a traversing request matches nothing it was not given');

// ── randomized search for a counterexample ──────────────────────────────────────────────────────
const POOL = ['a.py', 'b.py', 'c.py', 'd.js', 'sub/e.py', 'sub/f.mjs', 'g.txt', '../h.py', './a.py', 'a.py '];
const pick = () => POOL.filter(() => Math.random() < 0.5);
const maybe = () => (Math.random() < 0.15 ? null : pick());

let ampFail = 0, compFail = 0, monoFail = 0, brokenAmpFail = 0;
const TRIALS = 4000;
for (let i = 0; i < TRIALS; i++) {
  const S = pick(), A = maybe(), B = maybe();
  const first = D(S, A);
  // P2, one step: nothing appears that the parent did not hold
  if (!subset(first, normalizeScope(S))) ampFail++;
  // W6a as written: composition cannot restore what the first step removed
  if (!subset(D(first, B), first)) compFail++;
  // monotone in the request: asking for less never yields more
  if (A && B) {
    const narrower = normalizeScope(B).filter((p) => normalizeScope(A).includes(p));
    if (!subset(D(S, narrower), D(S, A))) monoFail++;
  }
  // the saboteur must be caught by the SAME check
  if (!subset(BD(S, A), normalizeScope(S))) brokenAmpFail++;
}

ok(ampFail === 0, 'NON-AMPLIFICATION over ' + TRIALS + ' random inputs: 0 counterexamples');
ok(compFail === 0, 'COMPOSITION (W6a) over ' + TRIALS + ' random inputs: attenuate∘attenuate ⊆ attenuate, 0 counterexamples');
ok(monoFail === 0, 'MONOTONE in the request over ' + TRIALS + ' random inputs: 0 counterexamples');

// ── the must-fire control ───────────────────────────────────────────────────────────────────────
console.log('');
console.log('  must-fire control — the same properties against a UNION implementation');
ok(brokenAmpFail > 0,
  'the union implementation IS caught amplifying (' + brokenAmpFail + ' of ' + TRIALS
  + ' random inputs), so the check above can fail');
ok(!subset(BD(['a.py'], ['b.py']), ['a.py']),
  'and caught on the brief\'s own case: union gives {a,b} where the parent held only {a}');
ok(BD(['a.py'], ['a.py', 'b.py', 'everything']).length === 3,
  'the saboteur hands over everything asked for - exactly the failure attenuation must prevent');

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
console.log('');
console.log('W6a is evidence about the FUNCTION. It is not evidence that authority composes in the');
console.log('live path - see STEP5 prereg Amendment 1. W9 is that experiment.');
process.exit(fail ? 1 : 0);
