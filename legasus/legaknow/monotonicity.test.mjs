// INFORMATION MONOTONICITY — and the four historical defects, re-expressed as one law.
//
// Each of these was found separately, weeks or hours apart, and diagnosed as its own bug. If the law is
// real, each must be detectable as an ILLEGAL COMPRESSION by the same check, with no case-specific code.
import test from 'node:test';
import assert from 'node:assert';
import { informationMonotonicity, illegalCompression, vocabularyMinimality, permissionsOf, ERASURES }
  from './monotonicity.mjs';
import { OBSERVABILITY, evidenceFrom, remediationFor, observation, degrade, PROVENANCE_FIELDS }
  from './observation.mjs';

const obs = (status, extra = {}) => observation({ status, value: 'v', subject: 's', producer: 'p',
  procedure: 'q', attribution: 'a', context: 'c', ...extra });

// The authorised decisions that read an observation. These are the consumers; the vocabulary is only
// justified to the extent that these treat states differently.
const CONSUMERS = [
  { name: 'may be used as evidence', grants: (o) => evidenceFrom(o).ok },
  // ADDED AFTER THE ABLATION REPORTED OBSERVED/EMPTY_OBSERVED AS MERGEABLE. That was a MISSING CONSUMER,
  // not a spurious distinction: a claim of the form "f(x) returns 'foo-bar'" requires OBSERVED, and
  // EMPTY_OBSERVED cannot license it. `evidenceFrom` already computed `empty` for exactly this purpose
  // and the consumer list simply failed to read it. The ablation's value is that it forced the
  // distinction to be JUSTIFIED BY A REAL CONSUMER rather than assumed.
  { name: 'licenses a claim about a produced value',
    grants: (o) => { const e = evidenceFrom(o); return e.ok && !e.empty; } },
  { name: 'says the subject itself misbehaved',
    grants: (o) => (remediationFor(o.status) || {}).kind === 'INSPECT_SUBJECT' },
  { name: 'schedules observer repair',
    grants: (o) => (remediationFor(o.status) || {}).kind === 'REPAIR_OBSERVER' },
  { name: 'schedules a first attempt',
    grants: (o) => (remediationFor(o.status) || {}).kind === 'ATTEMPT_OBSERVATION' },
  { name: 'schedules identity repair',
    grants: (o) => (remediationFor(o.status) || {}).kind === 'REPAIR_IDENTITY' },
  { name: 'schedules prerequisite work',
    grants: (o) => (remediationFor(o.status) || {}).kind === 'ESTABLISH_PREREQUISITE' },
  { name: 'schedules re-acquisition',
    grants: (o) => (remediationFor(o.status) || {}).kind === 'REACQUIRE_EVIDENCE' },
];

test('DEFECT 1 — PRODUCER_FAILED and EMPTY_OBSERVED collapsed into the empty set (run 0)', () => {
  const r = illegalCompression({
    states: [
      { name: 'EMPTY_OBSERVED', value: obs(OBSERVABILITY.EMPTY_OBSERVED, { value: null }) },
      { name: 'PRODUCER_FAILED', value: obs(OBSERVABILITY.PRODUCER_FAILED, { value: null }) },
    ],
    compress: () => [],                       // failSet(null) -> [] ; failSet(real empty) -> []
    consumers: CONSUMERS,
  });
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.consumer === 'may be used as evidence'), JSON.stringify(r));
  assert.match(r.violations[0].why, /destroys an authority-relevant distinction/);
});

test('DEFECT 2 — UNKNOWN and ZERO collapsed by `x || 0` (the history-scope script)', () => {
  const MEASURED_ZERO = { prefix: 0, known: true };
  const NOT_IN_SET = { prefix: undefined, known: false };
  const consumers = [
    { name: 'counts as evidence of an identical subject', grants: (s) => s.known && s.prefix === 0 },
    { name: 'counts as an unexplained case', grants: (s) => !s.known },
  ];
  const r = illegalCompression({
    states: [{ name: 'measured zero', value: MEASURED_ZERO }, { name: 'unknown', value: NOT_IN_SET }],
    compress: (s) => (s.prefix || 0),         // the actual defect, verbatim
    consumers,
  });
  assert.equal(r.ok, false);
  assert.equal(r.violations.length, 2, 'both consumers lose a distinction');
});

test('DEFECT 3 — two code objects collapsed onto one source coordinate', () => {
  const moduleStmt = { module: 'm', line: 1, code: 'module-codeobj' };
  const fnBody = { module: 'm', line: 1, code: 'function-codeobj' };
  const consumers = [
    { name: 'licenses a claim about the function body', grants: (s) => s.code === 'function-codeobj' },
  ];
  const r = illegalCompression({
    states: [{ name: 'def statement', value: moduleStmt }, { name: 'function body', value: fnBody }],
    compress: (s) => s.module + ':' + s.line,   // the aliasing identity
    consumers,
  });
  assert.equal(r.ok, false);

  // CONTROL: the fingerprinted identity does NOT merge them, and is therefore a legal representation.
  const legal = illegalCompression({
    states: [{ name: 'def statement', value: moduleStmt }, { name: 'function body', value: fnBody }],
    compress: (s) => s.module + '|' + s.code + ':' + s.line,
    consumers,
  });
  assert.equal(legal.ok, true);
});

test('DEFECT 4 — evidence at S0 and S1 collapsed into "the evidence" (stale doctests)', () => {
  const atS0 = { example: 'Specifier(">=1.2.3")', state: 'S0' };
  const atS1 = { example: 'Specifier(">= 2.2.3")', state: 'S1' };
  const consumers = [
    { name: 'may be compared against the S1 corpus', grants: (s) => s.state === 'S1' },
  ];
  const r = illegalCompression({
    states: [{ name: 'mined at S0', value: atS0 }, { name: 'present at S1', value: atS1 }],
    compress: () => 'the evidence',
    consumers,
  });
  assert.equal(r.ok, false);
});

test('A LEGAL COMPRESSION IS ACCEPTED — the law is not a ban on compression', () => {
  // Two states that differ in something no consumer reads. Discarding it is legal, and must be.
  const a = { status: OBSERVABILITY.OBSERVED, cosmetic: 'red' };
  const b = { status: OBSERVABILITY.OBSERVED, cosmetic: 'blue' };
  const r = illegalCompression({
    states: [{ name: 'red', value: a }, { name: 'blue', value: b }],
    compress: (s) => s.status,
    consumers: [{ name: 'reads only status', grants: (s) => s.status === OBSERVABILITY.OBSERVED }],
  });
  assert.equal(r.ok, true, 'a compression that preserves every authority-relevant distinction is fine');
});

test('THE METAMORPHIC LAW — erasing ANY provenance field never gains a permission', () => {
  // No correct answer is needed for any case. Only one thing must never happen.
  let checked = 0;
  for (const status of Object.values(OBSERVABILITY)) {
    for (const field of PROVENANCE_FIELDS) {
      const r = informationMonotonicity({ rich: obs(status), erase: (o) => degrade(o, field),
        consumers: CONSUMERS, label: ERASURES.DROP_ATTRIBUTION });
      assert.equal(r.ok, true, r.why || '');
      checked++;
    }
  }
  assert.equal(checked, Object.values(OBSERVABILITY).length * PROVENANCE_FIELDS.length);
});

test('THE LAW CATCHES A REAL VIOLATION — it is not vacuously satisfied', () => {
  // A deliberately broken consumer that treats missing provenance as permission. If the check could not
  // catch this, every pass above would be meaningless.
  const optimistic = [{ name: 'trusts anything it cannot question',
    grants: (o) => o.subject === null || evidenceFrom(o).ok }];
  const r = informationMonotonicity({ rich: obs(OBSERVABILITY.PRODUCER_FAILED),
    erase: (o) => degrade(o, 'subject'), consumers: optimistic });
  assert.equal(r.ok, false);
  assert.deepEqual(r.gained, ['trusts anything it cannot question']);
  assert.match(r.why, /Authority was manufactured out of information loss/);
});

test('VOCABULARY MINIMALITY — is the eight-state ontology load-bearing, or merely tidy?', () => {
  const r = vocabularyMinimality({ values: Object.values(OBSERVABILITY), consumers: CONSUMERS,
    asState: (v) => obs(v) });
  // This is an honest question and the answer is recorded rather than asserted: any pair that no consumer
  // distinguishes is a DESCRIPTIVE distinction, and either the vocabulary is too large or a consumer is
  // missing.
  assert.equal(r.minimal, true,
    'mergeable pairs (no consumer distinguishes them): '
    + JSON.stringify(r.mergeable.map((m) => m.a + '/' + m.b)));
  assert.equal(r.loadBearing, 28, 'all 8-choose-2 pairs are distinguished by some authorised consumer');
  assert.equal(r.mergeable.length, 0);
});

test('permissionsOf treats a THROWING consumer as granting nothing', () => {
  const p = permissionsOf({}, [{ name: 'explodes', grants: () => { throw new Error('x'); } }]);
  assert.equal(p[0].granted, false, 'a consumer that cannot answer has NOT granted permission');
});
