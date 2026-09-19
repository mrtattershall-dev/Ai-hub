// LEGAREWARD — and the tests that matter are the ones where the intuitive metric is WRONG.
//
// A preference stage earns its authority the same way every rejecting stage in this project has had to:
// by proving it can recognize legitimate alternatives. So the suite is built around pairs where the
// obvious heuristic - shorter is better, canonical spelling is better - would get it wrong, and the
// required answer is often NO PREFERENCE rather than a winner.
import test from 'node:test';
import assert from 'node:assert';
import { measure, DIMENSIONS } from './metrics.mjs';
import { compare, mayReplaceChampion, paretoFrontier, VERDICT } from './dominance.mjs';

const cand = (code, opts = {}) => ({
  code, verified: opts.verified !== false,
  metrics: measure({ code, placementsLegal: opts.legal || 1, placementsCorrect: opts.correct ?? (opts.legal || 1) }),
});

test('RUNTIME PARITY — equivalent spellings must not differ on runtime cost', () => {
  // THE BUG THIS PINS. The first version of the runtime proxy counted `in` as ONE comparison, so the
  // membership spelling looked cheaper than the or-chain doing identical work. A measurement error
  // pointing at the canonical form is an accidental oracle, and it would have let this stage demote a
  // legitimate alternative on the strength of a bug.
  const membership = cand('n in (2, 4, 6, 8)');
  const orChain = cand('n == 2 or n == 4 or n == 6 or n == 8');
  assert.equal(membership.metrics.worstCaseTests, 4, '`in` over four literals is four comparisons');
  assert.equal(membership.metrics.worstCaseTests, orChain.metrics.worstCaseTests);
  assert.equal(membership.metrics.distinctLiterals, orChain.metrics.distinctLiterals);
  assert.equal(membership.metrics.placementRobustness, orChain.metrics.placementRobustness);
});

test('DIFFERENT BUT EQUIVALENT — membership DOES dominate, and the reason is recorded', () => {
  // I expected NO PREFERENCE here and was wrong. With the runtime proxy corrected, the two are equal on
  // runtime, literals, duplication and robustness; membership is smaller and carries no boolean
  // connectives. Both are declared dimensions, so this is a dominance on measured properties rather than
  // on resemblance to a canonical spelling - which is what the preregistered question actually asks.
  const membership = cand('n in (2, 4, 6, 8)');
  const orChain = cand('n == 2 or n == 4 or n == 6 or n == 8');
  const r = compare(membership, orChain);
  assert.equal(r.verdict, VERDICT.DOMINATES, JSON.stringify(r));
  assert.deepEqual(r.improves.sort(), ['branchPoints', 'changedChars']);
  assert.ok(r.same.includes('worstCaseTests'), 'and it must NOT be winning on runtime');
});

test('DOMINATION CHANGES THE CHAMPION, NOT ADMISSIBILITY — this is what stops it being an oracle', () => {
  // The or-chain is verified. It stays verified, stays legal, and stays available. Preference decides
  // which candidate is promoted; it has no authority to make a proven-correct realization inadmissible.
  // 45 measured transactions realize the contract that way and every one of them was correct.
  const membership = cand('n in (2, 4, 6, 8)');
  const orChain = cand('n == 2 or n == 4 or n == 6 or n == 8');
  assert.equal(orChain.verified, true, 'domination must not touch the verdict PROVE gave');
  const r = compare(membership, orChain);
  assert.equal(r.verdict, VERDICT.DOMINATES);
  // Nothing in this module can mark a verified candidate rejected, and nothing removes it from the pool.
  assert.equal(orChain.verified, true);
  assert.ok(!('rejected' in orChain), 'preference has no vocabulary for rejection, by construction');
});

test('the vector is not keyed to the membership spelling — either form can win', () => {
  // If `in` were secretly privileged, no non-membership candidate could ever dominate a membership one.
  const wasteful = cand('n in (4, 6) and n in (4, 6)');
  const plainer = cand('n == 4 or n == 6');
  const r = compare(plainer, wasteful);
  assert.equal(r.verdict, VERDICT.DOMINATES,
    'a non-membership form must be able to dominate a membership one on measured grounds');
  assert.ok(r.improves.includes('duplicatedTerms'));
});

test('SHORTER BUT WORSE — duplication makes the shorter candidate lose a dimension', () => {
  const shortDuplicated = cand('n > 0 and n > 0 and n < 9');
  const longerClean = cand('n > 0 and n < 9 and n != 4 and n != 5');
  const r = compare(shortDuplicated, longerClean);
  assert.notEqual(r.verdict, VERDICT.DOMINATES,
    'fewer characters must not win while carrying a duplicated term');
  assert.ok(shortDuplicated.metrics.duplicatedTerms > longerClean.metrics.duplicatedTerms);
});

test('LONGER BUT BETTER — robustness outweighs nothing, but it does prevent domination', () => {
  // The self-defending guard is longer and survives more legal placements. It must NOT be dominated by
  // the shorter one, and it must not silently dominate either - they trade off.
  const plain = cand('n < 10', { legal: 4, correct: 1 });
  const selfDefending = cand('n < 10 and n != 3', { legal: 4, correct: 4 });
  const r = compare(selfDefending, plain);
  assert.equal(r.verdict, VERDICT.NO_PREFERENCE, JSON.stringify(r));
  assert.ok(r.aBetter.includes('placementRobustness'));
  assert.ok(r.bBetter.includes('changedChars'));
  // Under an objective that declares robustness protected, the shorter one may NOT take the champion.
  const m = mayReplaceChampion(plain, selfDefending, { protectedDims: ['placementRobustness'] });
  assert.equal(m.replace, false);
});

test('STYLE ONLY — semantically identical spellings are EQUIVALENT, and neither replaces the other', () => {
  const a = cand('n < 10');
  const b = cand('n < 10');
  const r = compare(a, b);
  assert.equal(r.verdict, VERDICT.EQUIVALENT);
  assert.equal(mayReplaceChampion(a, b).replace, false, 'no reason to churn the champion');
});

test('A GENUINE IMPROVEMENT is recognized — the guard must not refuse everything', () => {
  // The negative control for the preference stage itself. One that never prefers anything would pass
  // every test above and be useless.
  const wasteful = cand('n > 0 and n > 0 and n < 9 and n < 9', { legal: 4, correct: 2 });
  const clean = cand('n > 0 and n < 9', { legal: 4, correct: 4 });
  const r = compare(clean, wasteful);
  assert.equal(r.verdict, VERDICT.DOMINATES, JSON.stringify(r));
  assert.equal(mayReplaceChampion(clean, wasteful).replace, true);
});

test('CORRECTNESS IS A PRECONDITION, not a dimension', () => {
  const correct = cand('n < 10');
  const wrong = cand('n < 5', { verified: false });
  const r = compare(correct, wrong);
  assert.equal(r.verdict, VERDICT.INCOMPARABLE);
  assert.match(r.why, /not on the frontier/);
  assert.equal(mayReplaceChampion(wrong, correct).replace, false);
  assert.equal(paretoFrontier([correct, wrong]).length, 1, 'unverified candidates are not on it at all');
});

test('a protected dimension blocks replacement even when everything else improves', () => {
  const champion = cand('n < 10 and n != 3', { legal: 4, correct: 4 });
  const leaner = cand('n < 10', { legal: 4, correct: 4 });
  // With equal robustness the leaner one genuinely dominates.
  assert.equal(mayReplaceChampion(leaner, champion).replace, true);
  // Drop its robustness and the protection must stop it, even though it is shorter and simpler.
  const leanerFragile = cand('n < 10', { legal: 4, correct: 2 });
  const m = mayReplaceChampion(leanerFragile, champion, { protectedDims: ['placementRobustness'] });
  assert.equal(m.replace, false);
  assert.equal(m.verdict, VERDICT.NO_PREFERENCE);
});

test('every dimension declares a polarity, or it is a preference smuggled in as a measurement', () => {
  for (const [name, d] of Object.entries(DIMENSIONS)) {
    assert.ok(d.polarity === 'lower' || d.polarity === 'higher', name + ' must declare a direction');
    assert.ok(d.why && d.why.length > 10, name + ' must say why that direction is the better one');
  }
});

test('NO PREFERENCE is reachable, common, and never silently resolved', () => {
  // If a realistic mix of verified candidates produced a total order, the stage would be asserting.
  const pool = [cand('n in (2, 4, 6, 8)'), cand('n == 2 or n == 4 or n == 6 or n == 8'),
    cand('n < 10 and n != 3', { legal: 4, correct: 4 }), cand('n < 10', { legal: 4, correct: 1 })];
  const frontier = paretoFrontier(pool);
  assert.ok(frontier.length > 1, 'a frontier of one would mean the vector collapsed to a ranking');
  let noPref = 0;
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      if (compare(pool[i], pool[j]).verdict === VERDICT.NO_PREFERENCE) noPref++;
    }
  }
  assert.ok(noPref > 0, 'NO PREFERENCE must actually occur on real pairs, or it is decoration');
});
