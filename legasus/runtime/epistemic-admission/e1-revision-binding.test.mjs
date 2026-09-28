// E1 — REVISION BINDING. Authorize against revision A, let the target become revision B, then attempt.
//
//     DENIED    revision-mismatch refusal, and B's BYTES ARE PRESERVED — the refused attempt must not
//               write, and must not "restore" A either. Refusing is not repairing.
//     ALLOWED   the unchanged-revision positive control, without which the denial proves only that
//               something refuses.
//
// The revision is the DIGEST OF THE CURRENT BYTES, read at the execution boundary. An mtime or a version
// label can agree while content differs, which is the failure being guarded against.
//
// THIS IS NOT E9. Here the target changes BEFORE the attempt and the check sees the new bytes. E9 is the
// race where the target changes AFTER a check and before the write. E1 passing establishes nothing
// about E9.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { delegate } from '../../legaknow/calculus.mjs';
import { governedEdit, editAction, revisionOf, OUTCOME, EDIT_FIXTURE } from './governed-edit.mjs';

const REV_A = 'export const value = 1;\n';
const REV_B = 'export const value = 99; // changed underneath us\n';
const PROPOSED = 'export const value = 2;\n';

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

function atRevisionA() {
  const root = mkdtempSync(join(tmpdir(), 'e1-'));
  const fixture = join(root, 'fixture.js');
  writeFileSync(fixture, REV_A);
  // the grant is issued against the bytes as they are NOW
  const authority = delegate({
    from: 'OWNER', grant: EDIT_FIXTURE.requires, to: 'controller',
    context: { repository: 'E1', implementation: 'fixture.js', revision: revisionOf(fixture) },
  });
  return { root, fixture, authority };
}

test('E1-ALLOWED (positive control) — unchanged revision: the edit proceeds to the exact bytes', () => {
  const f = atRevisionA();
  try {
    const r = governedEdit({
      authority: f.authority,
      action: editAction({ target: 'fixture.js', contents: PROPOSED }),
      root: f.root,
    });
    assert.equal(r.outcome, OUTCOME.ACTION_PERMITTED, r.why || '');
    assert.equal(r.effected, true);
    assert.equal(readFileSync(f.fixture, 'utf8'), PROPOSED);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('E1-DENIED — target became revision B: refused as a revision mismatch, and B is PRESERVED', () => {
  const f = atRevisionA();
  try {
    // the world moves after the grant was issued, and nothing tells the authority
    writeFileSync(f.fixture, REV_B);
    const revB = sha(f.fixture);

    const r = governedEdit({
      authority: f.authority,                 // still pinned to revision A
      action: editAction({ target: 'fixture.js', contents: PROPOSED }),
      root: f.root,
    });

    assert.equal(r.outcome, OUTCOME.ACTION_DENIED_REVISION_MISMATCH, r.why || '');
    assert.equal(r.effected, false);
    assert.match(r.why, /Permission granted over one revision is not permission over another/);
    assert.notEqual(r.pinnedRevision, r.currentRevision, 'the refusal names both revisions');

    // B IS PRESERVED: not overwritten with PROPOSED, and not reverted to A either
    assert.equal(sha(f.fixture), revB, "revision B's bytes must survive the refusal");
    assert.equal(readFileSync(f.fixture, 'utf8'), REV_B);
    assert.notEqual(readFileSync(f.fixture, 'utf8'), REV_A, 'a refusal must not restore A');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('E1-CONTROL — the denial is caused by the revision alone', () => {
  // identical authority, identical action, identical root: the ONLY difference between the two runs is
  // whether the file changed underneath. Without this, E1-DENIED could be refusing for another reason.
  const f = atRevisionA();
  try {
    const act = editAction({ target: 'fixture.js', contents: PROPOSED });
    const before = governedEdit({ authority: f.authority, action: act, root: f.root });
    assert.equal(before.outcome, OUTCOME.ACTION_PERMITTED, 'same inputs permit when the revision matches');
  } finally { rmSync(f.root, { recursive: true, force: true }); }

  const g = atRevisionA();
  try {
    writeFileSync(g.fixture, REV_B);
    const act = editAction({ target: 'fixture.js', contents: PROPOSED });
    const after = governedEdit({ authority: g.authority, action: act, root: g.root });
    assert.equal(after.outcome, OUTCOME.ACTION_DENIED_REVISION_MISMATCH,
      'and refuse when only the revision moved');
  } finally { rmSync(g.root, { recursive: true, force: true }); }
});

test('E1-SCOPE — an authority pinning NO revision is unaffected (revision binding is conditional)', () => {
  const root = mkdtempSync(join(tmpdir(), 'e1u-'));
  const fixture = join(root, 'fixture.js');
  try {
    writeFileSync(fixture, REV_A);
    const unpinned = delegate({
      from: 'OWNER', grant: EDIT_FIXTURE.requires, to: 'controller',
      context: { repository: 'E1', implementation: 'fixture.js' },   // no revision
    });
    writeFileSync(fixture, REV_B);        // moves anyway
    const r = governedEdit({
      authority: unpinned,
      action: editAction({ target: 'fixture.js', contents: PROPOSED }),
      root,
    });
    // NOT a defect: a grant that pins no revision makes no claim about one. Recorded so the conditional
    // is deliberate rather than an omission, and so tightening it later is a visible policy change.
    assert.equal(r.outcome, OUTCOME.ACTION_PERMITTED, r.why || '');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
