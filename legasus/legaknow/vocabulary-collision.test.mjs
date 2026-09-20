// r4 — A NEW CROSS-MODULE STATE-WORD COLLISION MUST BE ARGUED, NOT DISCOVERED FOUR COMMITS LATER.
//
// Predictions AT-6..AT-8 frozen in benchmarks/ATTAINMENT_PREREG.md before this existed.
//
// THE SESSION'S COUNTEREXAMPLE TO ITS OWN COMPOUNDING CLAIM. Composition attack C4 - a coordinate
// acquiring a declared dimension's authority because two strings matched - was repaired at a31046c.
// Four commits later the C8 repair exported `CONTESTED` from provenance.mjs, colliding with
// ledger.mjs's STATE.CONTESTED, whose LAW 3 meaning carries an obligation ("owes an experiment") -
// and the obligation travelled. Same class, already "mechanized", recurred.
//
// The reason is in the repair: C4's guard is producer-keyed promotion INSIDE justification.mjs. It
// guards one mechanism. The ledger called it a class. MECHANIZING AN INSTANCE DOES NOT MECHANIZE ITS
// CLASS, and this file is the weak, achievable form of the lesson: a NEW collision becomes visible at
// introduction instead of in someone else's review.
//
// WHAT IT DOES NOT DO, so it is never read as more: it classifies nothing. None of the standing
// collisions is a demonstrated defect - they are namespaced by their enum (VALIDITY.INVALID vs
// LIFECYCLE.INVALID) and no obligation has been shown to travel. What made CONTESTED dangerous was
// that the word carried an OBLIGATION, and which words carry obligations is not mechanically
// derivable - the same hand-authored boundary instruments.mjs records. This surfaces a new collision
// FOR ARGUMENT.
import test from 'node:test';
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';

const DIR = 'legasus/legaknow';

// Every exported state WORD and the modules that own it: `export const X = 'lit'` and the string
// members of an exported object constant.
export function collisions(extra = {}) {
  const owner = new Map();
  const add = (word, file) => {
    const s = owner.get(word) || owner.set(word, new Set()).get(word);
    s.add(file);
  };
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.mjs') && !x.includes('.test.'))) {
    const src = readFileSync(DIR + '/' + f, 'utf8');
    for (const m of src.matchAll(/export const \w+ = '([^']+)'/g)) add(m[1], f);
    for (const m of src.matchAll(/export const \w+ = \{([^}]*)\}/g)) {
      for (const k of m[1].matchAll(/\w+: '([^']+)'/g)) add(k[1], f);
    }
  }
  for (const [file, words] of Object.entries(extra)) for (const w of words) add(w, file);
  return [...owner.entries()].filter(([, v]) => v.size > 1)
    .map(([word, v]) => ({ word, modules: [...v].sort() })).sort((a, b) => a.word.localeCompare(b.word));
}

// FROZEN INVENTORY. Each of these is accepted as namespaced-and-harmless TODAY, with no obligation
// shown to travel between its owners. A new entry is not a defect; it is a claim to be argued.
const KNOWN = [
  'ASSUMPTION',      // justification NODE vs ledger BASIS
  'INVALID',         // justification VALIDITY vs ledger LIFECYCLE
  'OWNER',           // admissibility ARGUED_FROM vs escalation AUTHORIZATION
  'PROOF',           // justification GENERALIZATION vs ledger BASIS
  'REPLACED',        // pin PIN vs referent BRIDGE
  'SPECIFICATION',   // admissibility ARGUED_FROM vs escalation DOMAIN
  'UNKNOWN',         // instruments SUBSUMPTION vs referent BRIDGE
];

test('AT-6 — the standing collision set is exactly the frozen inventory', () => {
  const found = collisions().map((c) => c.word);
  assert.deepEqual(found, KNOWN,
    'a word now owned by two modules is either new (argue it, then add it here with its reason) or'
    + ' gone (remove it). Either way this line is the place that notices.');
});

test('AT-7 — THE DEMONSTRATED TRUE POSITIVE: the guard fires on the real defect of 58b62aa', () => {
  // Reconstruct exactly what the C8 repair exported, without reintroducing it.
  const withDefect = collisions({ 'provenance.mjs': ['CONTESTED'] });
  const words = withDefect.map((c) => c.word);
  assert.ok(words.includes('CONTESTED'), 'the guard would have fired at the moment it was introduced');
  assert.notDeepEqual(words, KNOWN, 'and the inventory assertion above would have failed');
  const entry = withDefect.find((c) => c.word === 'CONTESTED');
  assert.deepEqual(entry.modules, ['ledger.mjs', 'provenance.mjs'],
    'naming both owners, which is what makes the collision arguable');
});

test('AT-8 — the guard classifies NOTHING, and says so by treating a harmless addition the same way', () => {
  // A genuinely innocuous new collision is reported identically to a dangerous one. The guard cannot
  // tell them apart and does not pretend to; the argument is the human step it forces.
  //
  // THE FIRST VERSION OF THIS CONTROL WAS WRONG and execution caught it. It added 'HELD' to pin.mjs
  // expecting a collision - but HELD is not in this inventory at all (it lives in legaexternal's
  // adapt.mjs, nested one level deeper than this scan reaches), so the addition produced ONE owner
  // and no collision. The control asserted a collision that could not occur and failed for a reason
  // that had nothing to do with the guard. A control must be shown to be able to pass.
  // 'ESTABLISHED' is measured as owned by exactly justification.mjs, so a second owner IS a collision.
  const innocuous = collisions({ 'pin.mjs': ['ESTABLISHED'] });
  const words = innocuous.map((c) => c.word);
  assert.ok(words.includes('ESTABLISHED'), 'a second owner of a one-owner word is a new collision');
  assert.deepEqual(innocuous.find((c) => c.word === 'ESTABLISHED').modules,
    ['justification.mjs', 'pin.mjs']);
  assert.notDeepEqual(words, KNOWN, 'reported exactly as CONTESTED was: as a change, with no verdict');
  // and with nothing added, the guard is silent - it fires on CHANGE, not on existence
  assert.deepEqual(collisions().map((c) => c.word), KNOWN);
});

test('AT-8b — the scan reaches only legaknow, and that limit is asserted rather than assumed', () => {
  // Found by AT-8's first failure: `HELD` is a state word in legaexternal/adapt.mjs and this scan
  // does not see it. The guard's blast radius is one directory and one nesting depth. Recorded here
  // so nobody reads a green inventory as "no collisions anywhere".
  assert.equal(collisions().some((c) => c.word === 'HELD'), false);
  assert.match(readFileSync('legasus/legaexternal/adapt.mjs', 'utf8'), /assertion: 'HELD'/,
    'the word exists outside the scanned set');
});
