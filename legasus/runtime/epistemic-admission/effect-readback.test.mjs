// EFFECT VERIFICATION — does the receipt describe what LANDED, or what was HANDED IN?
//
//   node --test legasus/runtime/epistemic-admission/effect-readback.test.mjs
//
// This is not one of the pre-declared E-numbers; it is a separate obligation, found from outside.
// in-toto's documentation warns that its link metadata records the artifacts a CALLER DECLARES, so a
// caller can omit a file it actually changed. The same shape existed one layer down here: `bytesAfter`
// was `Buffer.byteLength(action.contents)` — the length of the intention — and nothing ever opened the
// file it had just written.
//
// It is not theoretical for this project. `core.autocrlf` once made a RESTORED file git-normalised
// rather than byte-exact. A write that lands transformed would have produced a receipt claiming the
// right byte count over different bytes on disk, and every downstream check that trusted the receipt
// would have agreed with it.
//
// THE POINT OF THE `deps.readBack` SEAM IS FALSIFIABILITY. A verification that cannot be made to fail
// is decoration, and there is no other way to exercise a filesystem that transforms bytes on write.
// The default is the real filesystem; only these tests pass anything else.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { delegate } from '../../legaknow/calculus.mjs';
import { governedEdit, editAction, revisionOf, OUTCOME, EDIT_FIXTURE } from './governed-edit.mjs';

const BEFORE = 'export const value = 1;\n';
const PROPOSED = 'export const value = 2;\nexport const extra = 3;\n';
const sha = (b) => createHash('sha256').update(b).digest('hex');

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'readback-'));
  const fixture = join(root, 'fixture.js');
  writeFileSync(fixture, BEFORE);
  const authority = delegate({
    from: 'OWNER', grant: EDIT_FIXTURE.requires, to: 'controller',
    context: { repository: 'RB', implementation: 'fixture.js', revision: revisionOf(fixture) },
  });
  return { root, fixture, authority };
}

const run = (s, deps) => governedEdit({
  authority: s.authority,
  action: editAction({ target: 'fixture.js', contents: PROPOSED }),
  root: s.root,
  ...(deps ? { deps } : {}),
});

// ══ POSITIVE CONTROL — an honest filesystem verifies ══════════════════════════════════════════════
test('READBACK-VALID (positive control) — a normal write reads back identical and is verified', () => {
  const s = setup();
  try {
    const r = run(s);
    assert.equal(r.outcome, OUTCOME.ACTION_PERMITTED, r.why || '');
    assert.equal(r.effectVerified, true, r.effectMismatch || '');
    assert.equal(r.revisionAfter, r.intendedRevision, 'what landed is what was intended');
    // and it really came from disk, not from the input: an independent read agrees
    assert.equal(r.revisionAfter, revisionOf(s.fixture));
    assert.equal(r.bytesAfter, readFileSync(s.fixture).length);
    assert.equal(r.effectMismatch, undefined, 'no mismatch is reported when there is none');
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});

test('READBACK-BEFORE — the receipt also records the revision that was replaced', () => {
  const s = setup();
  try {
    const expected = sha(Buffer.from(BEFORE));
    const r = run(s);
    assert.equal(r.revisionBefore, expected, 'the bytes that were there before are named, not just counted');
    assert.notEqual(r.revisionBefore, r.revisionAfter);
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});

// ══ THE NEGATIVE — a filesystem that transforms on write ══════════════════════════════════════════
// This is the autocrlf case, made reproducible. The write succeeds; the bytes on disk are not the bytes
// intended; the OLD receipt would have reported bytesAfter = the intention and said nothing at all.
test('READBACK-TRANSFORMED — bytes that land different are DETECTED, and named', () => {
  const s = setup();
  try {
    const crlf = { readBack: (p) => Buffer.from(readFileSync(p, 'utf8').replace(/\n/g, '\r\n'), 'utf8') };
    const r = run(s, crlf);

    assert.equal(r.effected, true, 'the write did happen');
    assert.equal(r.outcome, OUTCOME.ACTION_PERMITTED,
      'and the outcome stays PERMITTED - the write was authorised and it occurred; claiming otherwise would be a second lie');
    assert.equal(r.effectVerified, false, 'but the effect is NOT verified');
    assert.ok(r.effectMismatch, 'and the mismatch is reported rather than left for a reader to notice');
    assert.match(r.effectMismatch, /intended [0-9a-f]{12}, on disk [0-9a-f]{12}/,
      'naming both digests, so the discrepancy is inspectable: ' + r.effectMismatch);
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});

test('READBACK-LENGTH — bytesAfter comes from the read-back, not from the input', () => {
  const s = setup();
  try {
    const crlf = { readBack: (p) => Buffer.from(readFileSync(p, 'utf8').replace(/\n/g, '\r\n'), 'utf8') };
    const r = run(s, crlf);
    const intended = Buffer.byteLength(PROPOSED);
    assert.notEqual(r.bytesAfter, intended,
      'the old implementation returned exactly this number and could not have differed');
    assert.equal(r.bytesAfter, intended + 2, 'two newlines became two CRLFs');
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});

test('READBACK-TRUNCATED — a short write is caught too, not only a transformed one', () => {
  const s = setup();
  try {
    const half = { readBack: (p) => readFileSync(p).subarray(0, 5) };
    const r = run(s, half);
    assert.equal(r.effectVerified, false);
    assert.equal(r.bytesAfter, 5, 'the receipt reports what was read, however little that was');
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});

// ══ THE SEAM MUST NOT BE A BACK DOOR ══════════════════════════════════════════════════════════════
test('READBACK-NOT-A-BYPASS — a lying reader cannot manufacture a verified receipt', () => {
  const s = setup();
  try {
    // A reader that returns the intended bytes regardless of what is on disk. It can make
    // effectVerified true - and it changes NOTHING about authorisation, and the file on disk is still
    // whatever governedEdit actually wrote. The seam reports the effect; it never grants one.
    const liar = { readBack: () => Buffer.from(PROPOSED) };
    const r = run(s, liar);
    assert.equal(r.effectVerified, true, 'a lying reader can only flatter the receipt');
    assert.equal(readFileSync(s.fixture, 'utf8'), PROPOSED,
      'and the bytes on disk are still the ones the executor wrote, through the same resolved target');
    assert.equal(r.resolvedTarget, join(s.root, 'fixture.js'),
      'the seam does not touch target binding');
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});

test('READBACK-REFUSED — a refused action produces no read-back fields at all', () => {
  const s = setup();
  try {
    const r = governedEdit({
      authority: s.authority,
      action: editAction({ target: 'OTHER.js', contents: PROPOSED }),
      root: s.root,
    });
    assert.equal(r.permitted, false);
    assert.equal(r.effectVerified, undefined, 'nothing landed, so there is nothing to verify');
    assert.equal(r.revisionAfter, undefined);
  } finally { rmSync(s.root, { recursive: true, force: true }); }
});
