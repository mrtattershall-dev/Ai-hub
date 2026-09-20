// r4 — INVESTIGATING A HAZARD I INTRODUCED TONIGHT, before assuming it is harmless.
//
// The producer #3 repair made the admitted-dimension set MUTABLE MODULE STATE. That was accepted with a
// reason - threading a registry through every caller leaves the default path unwired, which is the defect
// being repaired - but "accepted with a reason" is not "shown to be safe", and the difference between
// those two is most of this project.
//
// THE FOURTH CONDITION IS WHY THIS RAN. If admission state leaks, some of the 456 green tests may be
// green for the wrong reason, which changes what may be claimed about the suite. That is an outcome that
// changes entitlement, so the investigation is justified rather than merely available.
import test from 'node:test';
import assert from 'node:assert';
import { scope, covers, joinConflicts, admitScopeDimension, scopeDimensions, resetScopeDimensions,
  UNADMITTED, DIMENSIONS } from './justification.mjs';
import { RELEVANCE, ARGUED_FROM } from './admissibility.mjs';

const ENTRY = (name) => ({ name, side: 'CONTEXT', relevance: RELEVANCE.COMPARISON_ENTITLEMENT,
  argument: 'declared for this leak investigation, argued from the module design rather than from any'
    + ' observed discrepancy',
  arguedFrom: ARGUED_FROM.DESIGN, establishedAt: 'registry-leak investigation' });

test('L1 — the module starts from the six, with no admission carried in from anywhere else', () => {
  // This runs FIRST in this file and does NOT reset beforehand, deliberately: if another test file in the
  // same process had admitted something, this is where it would show.
  assert.deepEqual(scopeDimensions().sort(), [...DIMENSIONS].sort());
});

test('L2 — an admission IS visible to every later caller in the same module instance', () => {
  resetScopeDimensions();
  assert.equal(admitScopeDimension(ENTRY('leakProbe')).admitted, true);
  assert.equal(scopeDimensions().includes('leakProbe'), true);
  assert.equal(scope({ leakProbe: 'x' }).leakProbe, 'x', 'it is now a real dimension');
  // the hazard is REAL and this is the proof of it, not a reassurance
  resetScopeDimensions();
});

test('L3 — resetScopeDimensions actually restores the exact base set', () => {
  resetScopeDimensions();
  admitScopeDimension(ENTRY('a1'));
  admitScopeDimension(ENTRY('a2'));
  assert.equal(scopeDimensions().length, DIMENSIONS.length + 2);
  resetScopeDimensions();
  assert.deepEqual(scopeDimensions().sort(), [...DIMENSIONS].sort());
  // and a coordinate that was PROMOTED goes back to being carried, not lost
  const s = scope({ a1: 'v' });
  assert.equal(s.a1, undefined);
  assert.equal(s[UNADMITTED].a1, 'v', 'demoted back to UNADMITTED rather than dropped');
});

test('L4 — admitting the same dimension twice does not duplicate it', () => {
  resetScopeDimensions();
  admitScopeDimension(ENTRY('dup'));
  const once = scopeDimensions().length;
  const again = admitScopeDimension(ENTRY('dup'));
  assert.equal(again.admitted, true);
  assert.equal(again.alreadyActive, true);
  assert.equal(scopeDimensions().length, once, 'idempotent, not accumulating');
  resetScopeDimensions();
});

test('L5 — THE ACTUAL LEAK RISK: a test that THROWS while a dimension is admitted', () => {
  // This is the realistic failure. Every test in producer3.test.mjs that admits calls reset at the END,
  // so an assertion failure BEFORE that line leaves the dimension admitted for every subsequent test in
  // the same file. Reproduced here deliberately.
  resetScopeDimensions();
  try {
    admitScopeDimension(ENTRY('escaped'));
    throw new Error('simulated assertion failure before the reset line');
  } catch (e) { /* swallowed, exactly as the test runner would record a failure and move on */ }

  assert.equal(scopeDimensions().includes('escaped'), true,
    'CONFIRMED: the dimension survives the failure and leaks into whatever runs next');

  // and the consequence is not cosmetic - a later comparison silently changes its answer
  const a = scope({ criterion: 'c', escaped: 'A' });
  const b = scope({ criterion: 'c', escaped: 'B' });
  assert.equal(joinConflicts(a, b).length, 1, 'a join that WOULD have succeeded is now refused');
  assert.equal(covers(a, b).ok, false);

  resetScopeDimensions();
  assert.equal(joinConflicts(scope({ criterion: 'c', escaped: 'A' }),
    scope({ criterion: 'c', escaped: 'B' })).length, 0, 'and back to comparable once reset');
});

test('L6 — the leak CANNOT cross a module instance, which is what bounds the blast radius', async () => {
  resetScopeDimensions();
  admitScopeDimension(ENTRY('perInstance'));
  assert.equal(scopeDimensions().includes('perInstance'), true);

  // a fresh module instance, loaded with a cache-busting query, starts from the base set
  const fresh = await import('./justification.mjs?leakprobe=' + Date.now());
  assert.equal(fresh.scopeDimensions().includes('perInstance'), false,
    'module state is per-instance; node --test also runs each FILE in its own process');
  assert.deepEqual(fresh.scopeDimensions().sort(), [...DIMENSIONS].sort());
  resetScopeDimensions();
});

// ---------------------------------------------------------------------------------------------------
// L7/L8 — A SECOND HAZARD, found by ASKING THE QUESTION DIRECTLY rather than by building a fourth
// producer to ask it. Law 7's fourth condition cuts both ways: an expensive investigation is not
// justified when a cheaper operation targets the SAME distinction, and "would a producer #4 alias its
// coordinate onto a declared dimension?" is answerable in four lines.
//
// The answer was YES, in my own repair, and it is L2 exactly: authority transferred by changing the
// referent - here, by nothing more than two strings being equal.

test('L7 — a carried coordinate whose NAME collides with a declared dimension is NOT promoted', () => {
  resetScopeDimensions();
  // a producer coordinate named `history` that means something else entirely
  const s = scope({ criterion: 'x', [UNADMITTED]: { history: 'HTTP request log' } });
  assert.equal(s.history, null,
    'the declared dimension stays UNESTABLISHED - a name match is not an admission');
  assert.equal(s[UNADMITTED].history, 'HTTP request log', 'and the coordinate is still recorded');

  // the control: the SAME value reaching scope() as a declared coordinate DOES establish the dimension,
  // so L7 is not passing merely because nothing can ever set history
  assert.equal(scope({ history: 'm.f#0' }).history, 'm.f#0');
});

test('L8 — a GENUINELY foreign name still promotes once the gate admits it', () => {
  resetScopeDimensions();
  const carried = { criterion: 'x', [UNADMITTED]: { collectionCohort: 'A B' } };
  assert.equal(scope(carried).collectionCohort, undefined, 'before admission: carried, not promoted');

  assert.equal(admitScopeDimension(ENTRY('collectionCohort')).admitted, true);
  assert.equal(scope(carried).collectionCohort, 'A B',
    'after admission: promoted, because the gate said so and not because a string matched');
  resetScopeDimensions();
});
