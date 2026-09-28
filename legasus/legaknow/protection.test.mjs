// r4 — protection levels, applied to this project's own C4 pattern with its real evidence.
// Predictions PT-1..PT-6 frozen in benchmarks/PROTECTION_PREREG.md before this file existed.
import test from 'node:test';
import assert from 'node:assert';
import { protection, detector, PROTECTION } from './protection.mjs';
import { SUBSUMPTION } from './instruments.mjs';

// THE REAL CASE. Two incidents of "authority transferred because two strings matched", and the two
// detectors this project actually built, each with the test that demonstrates its reach.
const INCIDENTS = [
  { id: 'C4', where: 'justification.mjs - an UNADMITTED runtime key took an admitted dimension\'s authority' },
  { id: 'C8-word', where: 'provenance.mjs - an exported state word took ledger.mjs LAW 3\'s obligation' },
];
const PRODUCER_KEYED = detector({ name: 'producer-keyed promotion', covers: ['C4'],
  region: 'scope() promotion inside justification.mjs, for coordinates carried under UNADMITTED',
  witness: { demonstrated: true, ref: 'unadmitted-attack.test.mjs C4-a / C4-b' } });
const COLLISION_INVENTORY = detector({ name: 'frozen collision inventory', covers: ['C8-word'],
  region: 'exported state words in legaknow, one directory and one nesting depth (AT-8b)',
  witness: { demonstrated: true, ref: 'vocabulary-collision.test.mjs AT-7, by reconstruction' } });

const real = (opts = {}) => protection({ name: 'same name -> same authority',
  incidents: INCIDENTS, detectors: [PRODUCER_KEYED, COLLISION_INVENTORY], ...opts });

test('PT-1 — the two detectors are DISJOINT: each covers exactly one incident, neither covers both', () => {
  const p = real();
  assert.deepEqual(p.singleDetectorCovering, [], 'no single detector reaches both');
  assert.equal(p.disjoint, true);
  assert.deepEqual(p.regions.map((r) => r.covers), [['C4'], ['C8-word']]);
  assert.match(p.why, /NO SINGLE detector reaches them all/);
});

test('PT-2 — the verdict is MECHANIZED_REGION even at 2/2 observed coverage', () => {
  const p = real();
  assert.equal(p.level, PROTECTION.MECHANIZED_REGION, 'not COVERED_CLASS');
  assert.equal(p.observedCoverage, '2/2', 'reported as a ratio BESIDE the verdict');
  assert.deepEqual(p.uncovered, []);
  assert.match(p.why, /known incidents are a sample/);
});

test('PT-3 — COVERED_CLASS needs coverage established OUTSIDE the detectors, and UNKNOWN is not a yes', () => {
  assert.equal(real().classCoverage, 'UNKNOWN');
  assert.equal(real({ classCoverage: SUBSUMPTION.UNKNOWN }).level, PROTECTION.MECHANIZED_REGION);
  assert.equal(real({ classCoverage: SUBSUMPTION.DOES_NOT_SUBSUME }).level, PROTECTION.MECHANIZED_REGION);
});

test('PT-4 CONTROL — an unwitnessed claim does not raise the verdict, and is named', () => {
  const claimed = detector({ name: 'a claim with no witness', covers: ['C4', 'C8-word'],
    region: 'everywhere, allegedly', witness: null });
  const p = protection({ name: 'x', incidents: INCIDENTS, detectors: [claimed],
    classCoverage: SUBSUMPTION.SUBSUMES });
  assert.equal(p.level, PROTECTION.PATTERN_NAMED, 'a claim is not a region');
  assert.deepEqual(p.uncovered, ['C4', 'C8-word']);
  assert.deepEqual(p.unwitnessed, [{ detector: 'a claim with no witness', claims: ['C4', 'C8-word'] }]);
});

test('PT-5 CONTROL — the other two levels are reachable, so this is not a machine with one answer', () => {
  // PATTERN_NAMED: linked incidents, no detector at all.
  const named = protection({ name: 'x', incidents: INCIDENTS, detectors: [] });
  assert.equal(named.level, PROTECTION.PATTERN_NAMED);
  assert.match(named.why, /Naming makes a recurrence recognizable/);
  // COVERED_CLASS: one witnessed detector reaching every incident, with coverage established outside.
  const whole = detector({ name: 'a detector over the whole pattern', covers: ['C4', 'C8-word'],
    region: 'every route by which a name can carry authority',
    witness: { demonstrated: true, ref: 'a hypothetical demonstration' } });
  const covered = protection({ name: 'x', incidents: INCIDENTS, detectors: [whole],
    classCoverage: SUBSUMPTION.SUBSUMES });
  assert.equal(covered.level, PROTECTION.COVERED_CLASS);
  assert.deepEqual(covered.singleDetectorCovering, ['a detector over the whole pattern']);
  // and full observed coverage WITHOUT the outside claim is still only a region
  assert.equal(protection({ name: 'x', incidents: INCIDENTS, detectors: [whole] }).level,
    PROTECTION.MECHANIZED_REGION);
});

test('PT-6 — dropping a detector names the incident that loses its cover', () => {
  const p = protection({ name: 'x', incidents: INCIDENTS, detectors: [PRODUCER_KEYED] });
  assert.equal(p.level, PROTECTION.MECHANIZED_REGION);
  assert.equal(p.observedCoverage, '1/2');
  assert.deepEqual(p.uncovered, ['C8-word'], 'which is the state this project was in for 20 commits');
});
