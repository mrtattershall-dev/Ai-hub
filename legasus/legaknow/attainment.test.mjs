// r4 — which level has been earned. Predictions AT-1..AT-5 frozen in benchmarks/ATTAINMENT_PREREG.md
// BEFORE this file existed. AT-1 is asserted against the REAL entries in quiesce-check, read from
// that file, so the test measures the system rather than a fixture of my own construction.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { evidenceFrontier, contestState, attainment, ATTAINMENT } from './stopping.mjs';

const quiescent = () => contestState({
  frontier: evidenceFrontier({ requiredProducers: ['t'], attempted: ['t'] }), investigations: [] });

// The real frontier's entries, parsed from the check that computes the live verdict.
function liveEntries() {
  const src = readFileSync('benchmarks/quiesce-check.mjs', 'utf8');
  const names = [...src.matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
  const classes = [...src.matchAll(/blockClass: BLOCK\.(\w+)/g)].map((m) => m[1]);
  assert.equal(names.length, classes.length, 'every entry has a block class');
  return names.map((name, i) => ({ name, blockClass: classes[i] }));
}

test('AT-1 — on the REAL frontier, level 1 is earned and level 2 is NOT', () => {
  const entries = liveEntries();
  assert.equal(entries.length, 8, 'eight represented investigations');
  const a = attainment({ contest: quiescent(), entries });
  assert.equal(a.levels[ATTAINMENT.NO_CURRENT_OBJECTIVE], true);
  assert.equal(a.levels[ATTAINMENT.FRONTIER_EXHAUSTED], false);
  assert.equal(a.earned, ATTAINMENT.NO_CURRENT_OBJECTIVE);
  assert.deepEqual(a.unclassified, ['INSTRUMENT_CLASSES_FOR_THE_RIGS'],
    'exactly one question is neither resolved nor blocked');
  assert.match(a.why, /neither resolved nor/);
});

test('AT-2 — level 3 needs coverage established elsewhere, and UNKNOWN is never a quiet yes', () => {
  const blocked = [{ name: 'a', blockClass: 'TERMINAL' }, { name: 'b', blockClass: 'OWNER' }];
  const noCoverage = attainment({ contest: quiescent(), entries: blocked });
  assert.equal(noCoverage.levels[ATTAINMENT.FRONTIER_EXHAUSTED], true);
  assert.equal(noCoverage.levels[ATTAINMENT.NAMED_COVERAGE_EXHAUSTED], false);
  assert.match(noCoverage.why, /coverage over named failure classes is UNKNOWN/);
  assert.equal(attainment({ contest: quiescent(), entries: blocked, coverageEstablished: false })
    .levels[ATTAINMENT.NAMED_COVERAGE_EXHAUSTED], false);
});

test('AT-3 — COMPLETE is refused, not computed', () => {
  const a = attainment({ contest: quiescent(), entries: liveEntries() });
  assert.equal(a.levels[ATTAINMENT.COMPLETE], 'NOT_REPRESENTABLE');
  assert.notEqual(a.levels[ATTAINMENT.COMPLETE], false, 'false would imply the question was evaluated');
  assert.match(a.why, /no finite procedure here establishes/);
});

test('AT-4 CONTROL — a fully blocked frontier DOES earn level 2, and with coverage, level 3', () => {
  const blocked = [{ name: 'a', blockClass: 'TERMINAL' }, { name: 'b', blockClass: 'PLATFORM' }];
  assert.equal(attainment({ contest: quiescent(), entries: blocked }).earned,
    ATTAINMENT.FRONTIER_EXHAUSTED);
  assert.equal(attainment({ contest: quiescent(), entries: blocked, coverageEstablished: true }).earned,
    ATTAINMENT.NAMED_COVERAGE_EXHAUSTED);
  // and an OPEN contest earns nothing at all
  const open = contestState({ frontier: evidenceFrontier({ requiredProducers: ['t'], attempted: ['t'] }),
    investigations: [{ name: 'live', authorized: true, executable: true, targetsDistinction: true,
      canChangeEntitlement: true }] });
  assert.equal(attainment({ contest: open, entries: blocked }).earned, null);
});

test('AT-5 CONTROL — attainment changes no verdict', () => {
  const c = quiescent();
  const before = JSON.stringify({ state: c.state, why: c.why, frontier: c.frontier });
  attainment({ contest: c, entries: liveEntries() });
  assert.equal(JSON.stringify({ state: c.state, why: c.why, frontier: c.frontier }), before);
  assert.equal(c.state, 'QUIESCENT_CONTEST');
});
