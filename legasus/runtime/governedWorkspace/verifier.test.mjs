// VERIFIER-1 — `validation` becomes an EXECUTED check, independently recorded.
//
// Frozen definition: ./ANCESTRY-1_PREREG.md
//
// WHY THIS IS A PRECONDITION AND NOT A COMPANION. `validation` was recorded at prepare() and executed
// NOWHERE, and `PromotionReceipt.verifierReceiptDigest` cannot be honest until a verifier actually runs.
// A queue that merely consumed the dead field would automate a declaration - the same shape as the
// receipt that reported `Buffer.byteLength(action.contents)` without ever opening the file it wrote.
//
// THE SIGNATURE IS THE GUARANTEE. `runValidation({ root, scope, validation })` receives NOTHING from the
// packet - not its contents - so it cannot grade the declaration against itself.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { delegate } from '../../legaknow/calculus.mjs';
import {
  createWorkspace, runValidation, fileScope, EVENT, PACKET, revisionOf, EDIT_FIXTURE,
} from './workspace.mjs';

const A_ORIGINAL = 'export const a = 1;\n';
const A_PROPOSED = 'export const a = 2;\n';

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'v1-'));
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'a.js'), A_ORIGINAL);
  return { root, a: join(root, 'src', 'a.js'), ws: createWorkspace({ root }) };
}
const grantFor = (root, target) => delegate({
  from: 'OWNER', grant: EDIT_FIXTURE.requires, to: 'controller',
  context: { repository: 'V1', implementation: target, revision: revisionOf(join(root, target)) },
});
const prep = (f, validation, contents = A_PROPOSED) => f.ws.prepare({
  scope: fileScope('src/a.js'), baseRevision: f.ws.revisionOfScope(fileScope('src/a.js')),
  authority: grantFor(f.root, 'src/a.js'), contents, validation, by: 'planner',
});
const verifications = (f) => f.ws.events().filter((e) => e.type === EVENT.VERIFICATION);

test('V-1 (positive control) — a declared check the bytes SATISFY records a PASSING verdict', () => {
  const f = setup();
  try {
    const r = f.ws.commit(prep(f, { kind: 'expect-contains', needle: 'a = 2' }).id);
    assert.equal(r.committed, true, r.why || '');
    assert.equal(readFileSync(f.a, 'utf8'), A_PROPOSED);

    // the verdict is ITS OWN EVENT, not a field inferred from the commit
    const vs = verifications(f);
    assert.equal(vs.length, 1, 'exactly one verification event was recorded');
    assert.equal(vs[0].verdict, 'PASS');
    assert.ok(vs[0].verifierReceiptDigest, 'and it carries the digest a receipt may cite');
    // and the receipt cites THAT digest, not one of its own invention
    assert.equal(r.event.verifierReceiptDigest, vs[0].verifierReceiptDigest);
    assert.equal(r.event.verified, true);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('V-2 — a declared check the bytes VIOLATE FAILS: the check can fail, and nothing promotes', () => {
  const f = setup();
  try {
    // the write lands exactly as written; the CLAIM about it is false
    const r = f.ws.commit(prep(f, { kind: 'expect-contains', needle: 'a = 99' }).id);

    assert.equal(r.committed, false, 'a false claim about the effect is not verified progress');
    assert.equal(r.reason, PACKET.VALIDATION_FAILED);
    assert.equal(r.effected, true, 'and it must NOT pretend the write did not happen');
    assert.equal(readFileSync(f.a, 'utf8'), A_PROPOSED, 'refusing is not repairing: the bytes stay');

    assert.equal(verifications(f)[0].verdict, 'FAIL');
    // THE THREE FACTS STAY SEPARATE: authorised, effected, not verified. No promotion receipt exists.
    assert.equal(f.ws.events().filter((e) => e.type === EVENT.ACTION_COMMITTED).length, 0);
    assert.equal(f.ws.receipts().size, 0, 'and nothing later can cite it as an ancestor');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('V-2b — a failed check QUARANTINES the scope: it may not become a base revision', () => {
  const f = setup();
  try {
    f.ws.commit(prep(f, { kind: 'expect-contains', needle: 'a = 99' }).id);
    // a second, entirely well-formed proposal against the damaged scope
    const again = f.ws.prepare({
      scope: fileScope('src/a.js'), baseRevision: f.ws.revisionOfScope(fileScope('src/a.js')),
      authority: grantFor(f.root, 'src/a.js'), contents: 'export const a = 4;\n', by: 'planner',
    });
    const r2 = f.ws.commit(again.id);
    assert.equal(r2.committed, false);
    assert.equal(r2.reason, PACKET.SCOPE_UNVERIFIED);
    assert.equal(r2.effected, false, 'and the second attempt wrote nothing');
    assert.equal(readFileSync(f.a, 'utf8'), A_PROPOSED);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('V-3 — the verdict follows DISK, not the declaration: change the bytes and it flips', () => {
  const f = setup();
  try {
    const validation = { kind: 'expect-contains', needle: 'a = 2' };
    const r = f.ws.commit(prep(f, validation).id);
    assert.equal(r.verification.verdict, 'PASS');

    // nothing about the packet changed. Only the world did.
    writeFileSync(f.a, 'export const a = 7; // someone else\n');
    const again = f.ws.verify({ scope: fileScope('src/a.js'), validation });

    assert.equal(again.verdict, 'FAIL',
      'a check grading the packet contents could never flip here; one reading disk must');
    assert.notEqual(again.verifierReceiptDigest, r.verification.verifierReceiptDigest,
      'and the digest moves with what was observed, so a stale pass cannot be re-cited');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('V-3b — re-verification alone does NOT quarantine: it observes the world, not an effect', () => {
  const f = setup();
  try {
    const validation = { kind: 'expect-contains', needle: 'a = 2' };
    f.ws.commit(prep(f, validation).id);
    writeFileSync(f.a, 'export const a = 7;\n');
    const v = f.ws.verify({ scope: fileScope('src/a.js'), validation });
    assert.equal(v.verdict, 'FAIL');

    // A failing observation is not a damaged effect. Conflating them would let any observer freeze any
    // scope, which is a workspace-wide stop button wearing a quarantine's name.
    const next = f.ws.prepare({
      scope: fileScope('src/a.js'), baseRevision: f.ws.revisionOfScope(fileScope('src/a.js')),
      authority: grantFor(f.root, 'src/a.js'), contents: 'export const a = 8;\n', by: 'planner',
    });
    const r = f.ws.commit(next.id);
    assert.equal(r.reason === PACKET.SCOPE_UNVERIFIED, false,
      'an observed failure must not quarantine: only a failed check on bytes a commit wrote does');
    assert.equal(r.committed, true, r.why || '');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('V-CONTROL — a packet declaring NO validation is unaffected; verification is not universal', () => {
  const f = setup();
  try {
    const r = f.ws.commit(prep(f, undefined).id);
    assert.equal(r.committed, true, r.why || '');
    assert.equal(verifications(f).length, 0, 'no verdict was invented for a check nobody declared');
    // and the absence is recorded AS absence, never as a pass
    assert.equal(r.event.verifierReceiptDigest, null);
    assert.equal(r.event.verified, null,
      'null, not true: a receipt must not claim verification that never happened');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('V-UNIT — the verifier never receives the contents, and an unknown kind FAILS', () => {
  const f = setup();
  try {
    // called directly with (root, scope, validation) and nothing else: the signature is the guarantee
    const pass = runValidation({ root: f.root, scope: fileScope('src/a.js'),
      validation: { kind: 'expect-bytes', bytes: A_ORIGINAL } });
    assert.equal(pass.verdict, 'PASS');

    const fail = runValidation({ root: f.root, scope: fileScope('src/a.js'),
      validation: { kind: 'expect-bytes', bytes: A_PROPOSED } });
    assert.equal(fail.verdict, 'FAIL', 'the bytes on disk are A_ORIGINAL; the declaration is wrong');

    // an unimplemented branch that silently passed would be the `[].every()` shape
    const unknown = runValidation({ root: f.root, scope: fileScope('src/a.js'),
      validation: { kind: 'expect-the-moon' } });
    assert.equal(unknown.verdict, 'FAIL');
    assert.match(unknown.detail, /unrecognised validation kind/);

    // a missing file is a FAIL, not a throw and not a vacuous pass
    const gone = runValidation({ root: f.root, scope: fileScope('src/nope.js'),
      validation: { kind: 'expect-contains', needle: 'anything' } });
    assert.equal(gone.verdict, 'FAIL');
    assert.equal(gone.observedRevision, null);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
