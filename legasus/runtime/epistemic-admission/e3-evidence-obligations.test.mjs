// E3 — EVIDENCE OBLIGATIONS, scoped to the OPERATION CONTRACT.
//
// The contract under test (EDIT_FIXTURE_EVIDENCED) declares one obligation. Four cases:
//
//     VALID          admitted evidence about this target at this revision  -> permitted
//     MISSING        no evidence supplied                                  -> refused BEFORE writing
//     WRONG TARGET   evidence about a different file                       -> refused BEFORE writing
//     WRONG REVISION evidence about this file at different bytes           -> refused BEFORE writing
//
// Every refusal is checked for the ABSENCE OF THE WRITE, not merely for a returned verdict.
//
// AND THE SCOPE CONTROL MATTERS AS MUCH AS THE REFUSALS: evidence is not a universal precondition. An
// operation whose contract declares NO obligation must be unaffected — otherwise this turns every
// authorized action into an evidence-gated one, which is a policy nobody declared.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { delegate, observe, isAuthority } from '../../legaknow/calculus.mjs';
import { observation, OBSERVABILITY } from '../../legaknow/observation.mjs';

// A REAL observation, built through the constructor that demands complete provenance. My first version of
// this file passed a bare { subject } literal; observe() REFUSED it, so no evidence token ever existed and
// E3-MISSING passed for the wrong reason. The positive control is what exposed that.
const seen = (subject) => observation({ status: OBSERVABILITY.OBSERVED, value: 'parsed',
  subject, producer: 'e3-harness', procedure: 'read+parse', attribution: 'file', context: 'E3' });
import { governedEdit, editAction, revisionOf, OUTCOME,
  EDIT_FIXTURE, EDIT_FIXTURE_EVIDENCED } from './governed-edit.mjs';

const BEFORE = 'export const value = 1;\n';
const OTHER_BEFORE = 'export const other = 0;\n';
const PROPOSED = 'export const value = 2;\n';
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'e3-'));
  const fixture = join(root, 'fixture.js');
  const other = join(root, 'OTHER.js');
  writeFileSync(fixture, BEFORE);
  writeFileSync(other, OTHER_BEFORE);
  const rev = revisionOf(fixture);
  const authority = delegate({
    from: 'OWNER', grant: EDIT_FIXTURE_EVIDENCED.requires, to: 'controller',
    context: { repository: 'E3', implementation: 'fixture.js', revision: rev },
  });
  const goodEvidence = observe({
    observation: seen('fixture.js'), procedure: 'read+parse',
    context: { repository: 'E3', implementation: 'fixture.js', revision: rev },
  });
  return { root, fixture, other, rev, authority, goodEvidence };
}

const run = (s, evidence) => governedEdit({
  authority: s.authority,
  action: editAction({ target: 'fixture.js', contents: PROPOSED, evidence }),
  root: s.root,
  contract: EDIT_FIXTURE_EVIDENCED,
});

test('E3-FIXTURE — the evidence the other cases rely on is actually MINTED, not refused', () => {
  const s = setup();
  try {
    // without this, every refusal below could be passing because no evidence can exist at all
    assert.equal(isAuthority(s.goodEvidence), true,
      'observe() refused: ' + (s.goodEvidence && s.goodEvidence.why));
    assert.equal(s.goodEvidence.kind, 'EPISTEMIC');
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});

test('E3-VALID (positive control) — admitted evidence about this target and revision permits the write',
  () => {
    const s = setup();
    try {
      const r = run(s, [s.goodEvidence]);
      assert.equal(r.outcome, OUTCOME.ACTION_PERMITTED, r.why || '');
      assert.equal(r.effected, true);
      assert.equal(readFileSync(s.fixture, 'utf8'), PROPOSED);
    } finally { rmSync(s.root, { recursive: true, force: true }); }
  });

test('E3-MISSING — no evidence: refused before writing', () => {
  const s = setup();
  const before = sha(s.fixture);
  try {
    const r = run(s, []);
    assert.equal(r.outcome, OUTCOME.ACTION_DENIED_UNADMITTED_EVIDENCE, r.why || '');
    assert.equal(r.effected, false);
    assert.match(r.why, /none was supplied/);
    assert.equal(sha(s.fixture), before, 'the write must not have happened');
    assert.equal(readFileSync(s.fixture, 'utf8'), BEFORE);
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});

test('E3-WRONG-TARGET — evidence about another file cannot satisfy the obligation', () => {
  const s = setup();
  const before = sha(s.fixture);
  try {
    const aboutOther = observe({
      observation: seen('OTHER.js'), procedure: 'read+parse',
      context: { repository: 'E3', implementation: 'OTHER.js', revision: s.rev },
    });
    const r = run(s, [aboutOther]);
    assert.equal(r.outcome, OUTCOME.ACTION_DENIED_UNADMITTED_EVIDENCE, r.why || '');
    assert.equal(r.effected, false);
    assert.deepEqual(r.wrongTarget, ['OTHER.js'], 'the refusal names what the evidence was about');
    assert.equal(sha(s.fixture), before);
    assert.equal(sha(s.other), createHash('sha256').update(OTHER_BEFORE).digest('hex'));
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});

test('E3-WRONG-REVISION — evidence about this file at other bytes cannot satisfy the obligation', () => {
  const s = setup();
  try {
    const stale = observe({
      observation: seen('fixture.js'), procedure: 'read+parse',
      context: { repository: 'E3', implementation: 'fixture.js', revision: 'deadbeef'.repeat(8) },
    });
    const r = run(s, [stale]);
    assert.equal(r.outcome, OUTCOME.ACTION_DENIED_UNADMITTED_EVIDENCE, r.why || '');
    assert.equal(r.effected, false);
    assert.equal(r.staleRevisionCount, 1, 'the refusal counts the stale item');
    assert.equal(readFileSync(s.fixture, 'utf8'), BEFORE, 'no write occurred');
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});

test('E3-SCOPE — a contract declaring NO obligation is unaffected: evidence is not universal', () => {
  const s = setup();
  try {
    const r = governedEdit({
      authority: s.authority,
      action: editAction({ target: 'fixture.js', contents: PROPOSED }),   // no evidence at all
      root: s.root,
      contract: EDIT_FIXTURE,                                            // declares none
    });
    assert.equal(r.outcome, OUTCOME.ACTION_PERMITTED, r.why || '');
    assert.equal(readFileSync(s.fixture, 'utf8'), PROPOSED);
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});

test('E3-NON-VACUITY — a NORMATIVE token cannot be passed off as the required EPISTEMIC evidence', () => {
  const s = setup();
  const before = sha(s.fixture);
  try {
    // the authority itself has the right context; only its KIND is wrong. If the obligation check read
    // context alone, this would satisfy it — and permission would be laundering itself as evidence.
    const r = run(s, [s.authority]);
    assert.equal(r.outcome, OUTCOME.ACTION_DENIED_UNADMITTED_EVIDENCE, r.why || '');
    assert.equal(r.effected, false);
    assert.equal(sha(s.fixture), before);
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});
