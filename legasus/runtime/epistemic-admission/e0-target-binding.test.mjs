// E0 — DOES AUTHORIZATION CONTROL AN ACTUAL EFFECT?
//
// Two INDEPENDENT trials, each from IDENTICAL fixtures, differing in ONE structured field.
//
//     ALLOWED   the owner-issued grant changes fixture.js to the exact expected bytes; OTHER.js unchanged
//     DENIED    only action.target changes, to OTHER.js; the specific target-mismatch refusal is
//               required, and BOTH files remain byte-identical to their pre-attempt state
//
// The decisive evidence is the permitted write OCCURRING and the forbidden write NOT OCCURRING through
// THE SAME execution path. Byte digests on both files in both trials are what make this a real-effect
// test rather than a verdict test — a returned refusal proves nothing about the disk.
//
// NOT ESTABLISHED BY THIS FILE, stated so the result cannot be read wider than it is:
//     E9 the check-then-change RACE. governedEdit resolves once and writes immediately, which narrows
//        the window and does not close it. E0 passing establishes NOTHING about race protection.
//     E4 single use    NOT EVALUATED — no single-use policy is declared for this operation
//     E5 allowance     NOT EVALUATED — no finite allowance is declared for this operation
//     Those two are neither passing nor vacuously satisfied. They are undecided policy.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { delegate } from '../../legaknow/calculus.mjs';
import { governedEdit, editAction, OUTCOME, EDIT_FIXTURE } from './governed-edit.mjs';

const FIXTURE_BEFORE = 'export const value = 1;\n';
const OTHER_BEFORE = 'export const other = "untouched";\n';
const EXPECTED_AFTER = 'export const value = 2;\n';

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

// IDENTICAL fixtures for every trial. Each trial gets its own root so the two are independent.
function freshFixtures() {
  const root = mkdtempSync(join(tmpdir(), 'e0-'));
  writeFileSync(join(root, 'fixture.js'), FIXTURE_BEFORE);
  writeFileSync(join(root, 'OTHER.js'), OTHER_BEFORE);
  return { root, fixture: join(root, 'fixture.js'), other: join(root, 'OTHER.js') };
}

// The SAME authority in both trials: owner-issued, pinned to fixture.js.
const grantFor = () => delegate({
  from: 'OWNER',
  grant: EDIT_FIXTURE.requires,
  to: 'controller',
  context: { repository: 'E0', implementation: 'fixture.js' },
});

test('E0-ALLOWED — the grant produces the exact expected bytes in fixture.js, and OTHER.js is untouched',
  () => {
    const f = freshFixtures();
    const beforeFixture = sha(f.fixture);
    const beforeOther = sha(f.other);
    try {
      const r = governedEdit({
        authority: grantFor(),
        action: editAction({ target: 'fixture.js', contents: EXPECTED_AFTER }),
        root: f.root,
      });

      assert.equal(r.outcome, OUTCOME.ACTION_PERMITTED, r.why || '');
      assert.equal(r.effected, true, 'the effect must actually have happened');

      // EXACT BYTES, not "changed"
      assert.equal(readFileSync(f.fixture, 'utf8'), EXPECTED_AFTER);
      assert.notEqual(sha(f.fixture), beforeFixture, 'fixture.js must have changed');

      // the unrelated file is untouched
      assert.equal(sha(f.other), beforeOther, 'OTHER.js must be byte-identical');
      assert.equal(readFileSync(f.other, 'utf8'), OTHER_BEFORE);

      // the record names what was authorized, and it traces to the independent root
      assert.equal(r.authorizedTarget, 'fixture.js');
      assert.equal(r.consumed[0].from, 'OWNER');
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

test('E0-DENIED — changing ONLY the target refuses with a target mismatch, and BOTH files are unchanged',
  () => {
    const f = freshFixtures();
    const beforeFixture = sha(f.fixture);
    const beforeOther = sha(f.other);
    try {
      const r = governedEdit({
        authority: grantFor(),                                  // identical authority
        action: editAction({ target: 'OTHER.js', contents: EXPECTED_AFTER }),  // ONLY this differs
        root: f.root,
      });

      // the SPECIFIC refusal, not merely a refusal
      assert.equal(r.outcome, OUTCOME.ACTION_DENIED_SCOPE_MISMATCH, r.why || '');
      assert.equal(r.permitted, false);
      assert.equal(r.effected, false);
      assert.equal(r.authorizedTarget, 'fixture.js');
      assert.equal(r.requestedTarget, 'OTHER.js');
      assert.match(r.why, /A grant over one target is not a grant over another/);

      // THE DECISIVE ASSERTION: the forbidden write did not occur, and nothing else moved either
      assert.equal(sha(f.other), beforeOther, 'OTHER.js must be byte-identical — no forbidden write');
      assert.equal(sha(f.fixture), beforeFixture, 'fixture.js must be byte-identical — no side effect');
      assert.equal(readFileSync(f.other, 'utf8'), OTHER_BEFORE);
      assert.equal(readFileSync(f.fixture, 'utf8'), FIXTURE_BEFORE);
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

test('E0-CONTROL — the two trials differ in exactly one field, so the refusal is caused by the target',
  () => {
    // Without this, E0-DENIED could be refusing for some unrelated reason and still look like a pass.
    const a = editAction({ target: 'fixture.js', contents: EXPECTED_AFTER });
    const b = editAction({ target: 'OTHER.js', contents: EXPECTED_AFTER });
    assert.equal(a.operation, b.operation);
    assert.equal(a.contents, b.contents);
    assert.notEqual(a.target, b.target);
    const diffs = Object.keys(a).filter((k) => a[k] !== b[k]);
    assert.deepEqual(diffs, ['target'], 'exactly one field differs: ' + diffs.join(', '));
  });

test('E0-STRUCTURAL — a path escaping the declared root is refused before any authorization', () => {
  const f = freshFixtures();
  const outside = join(f.root, '..', 'escaped.js');
  try {
    const r = governedEdit({
      authority: grantFor(),
      action: editAction({ target: '../escaped.js', contents: 'x' }),
      root: f.root,
    });
    assert.equal(r.outcome, OUTCOME.ACTION_DENIED_TARGET_ESCAPES_ROOT, r.why || '');
    assert.equal(r.effected, false);
    assert.equal(existsSync(outside), false, 'nothing was written outside the root');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
