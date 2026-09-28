// THE COMMIT ABLATION, on real files in a real directory.
//
// The transaction is faithful to what LegaCore already models - a provider and a consumer:
//
//   op1   creates limits.py containing LIMIT = 10          a PROVIDER. Independently valid code.
//   op2   inserts a guard into impl.py that uses LIMIT     the CONSUMER. Made to fail verification.
//
// op1 IS THE NASTY CONTROL. It is good code. If anybody had asked for it alone it would be a fine
// change. Nobody did - it belongs to a transaction that did not complete, and persisting it is
// therefore wrong. Without that, rollback would be the trivial claim "we removed the broken thing".
//
// The declared writable surface is BOTH files, so the manifest catches a creation that was not undone
// as well as a modification that was not restored.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTransaction, stateManifest, manifestString, checkRestored } from './transactional.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);
const SURFACE = ['impl.py', 'limits.py'];

const BASE = L('def classify(n):', '    if n == 3:', '        return "three"', '    return "other"');

function freshRoot() {
  const root = mkdtempSync(join(tmpdir(), 'commit-'));
  writeFileSync(join(root, 'impl.py'), BASE + NL, 'utf8');
  return root;
}

const opProvider = { id: 'op1-create-limits',
  apply: (root) => writeFileSync(join(root, 'limits.py'), 'LIMIT = 10' + NL, 'utf8') };

const opConsumer = (guard) => ({ id: 'op2-insert-guard',
  apply: (root) => {
    const lines = readFileSync(join(root, 'impl.py'), 'utf8').split(NL);
    lines.splice(3, 0, '    ' + guard, '        return "small"');
    writeFileSync(join(root, 'impl.py'), L('from limits import LIMIT', ...lines), 'utf8');
  } });

// Stands in for LegaVerify. It returns a verdict; the commit stage never computes one.
const verdict = (ok) => () => ok;

test('CONTROL 1 — a complete transaction persists exactly the verified candidate', () => {
  const root = freshRoot();
  const before = manifestString(stateManifest(root, SURFACE));
  const r = runTransaction({ root, surface: SURFACE,
    operations: [opProvider, opConsumer('if n < LIMIT:')], verify: verdict(true), atomic: true });
  assert.equal(r.committed, true);
  assert.equal(r.stateUnchanged, false, 'a successful transaction must change the state');
  assert.ok(existsSync(join(root, 'limits.py')), 'the provider file must persist');
  assert.match(readFileSync(join(root, 'impl.py'), 'utf8'), /if n < LIMIT:/);
  assert.notEqual(manifestString(stateManifest(root, SURFACE)), before);
  rmSync(root, { recursive: true, force: true });
});

test('CONTROL 2 — op1 succeeds, op2 fails: state returns byte-for-byte to S0', () => {
  const root = freshRoot();
  const before = manifestString(stateManifest(root, SURFACE));
  const r = runTransaction({ root, surface: SURFACE,
    operations: [opProvider, opConsumer('if n > LIMIT:')], verify: verdict(false), atomic: true });
  assert.equal(r.committed, false);
  assert.equal(r.stateUnchanged, true);
  assert.equal(manifestString(stateManifest(root, SURFACE)), before);
  assert.equal(existsSync(join(root, 'limits.py')), false,
    'the created provider file must be gone - a creation that is not undone is partial persistence');
  assert.equal(readFileSync(join(root, 'impl.py'), 'utf8'), BASE + NL, 'byte-for-byte, not merely valid');
  rmSync(root, { recursive: true, force: true });
});

test('CONTROL 3 — assembly succeeds but final verification fails: state returns to S0', () => {
  const root = freshRoot();
  const before = manifestString(stateManifest(root, SURFACE));
  const r = runTransaction({ root, surface: SURFACE,
    operations: [opProvider, opConsumer('if n < LIMIT:')], verify: verdict(false), atomic: true });
  assert.equal(r.committed, false);
  assert.equal(manifestString(stateManifest(root, SURFACE)), before);
  rmSync(root, { recursive: true, force: true });
});

test('CONTROL 4 — THE ABLATION: with rollback disabled the independently good op1 remains', () => {
  const root = freshRoot();
  const before = manifestString(stateManifest(root, SURFACE));
  const r = runTransaction({ root, surface: SURFACE,
    operations: [opProvider, opConsumer('if n > LIMIT:')], verify: verdict(false), atomic: false });
  assert.equal(r.committed, false);
  assert.equal(r.stateUnchanged, false, 'the experiment must be able to DETECT partial persistence');
  assert.ok(existsSync(join(root, 'limits.py')),
    'op1 - good code, belonging to a transaction that did not complete - is still on disk');
  assert.equal(readFileSync(join(root, 'limits.py'), 'utf8'), 'LIMIT = 10' + NL,
    'and it is the valid change, which is exactly what makes persisting it wrong');
  assert.notEqual(manifestString(stateManifest(root, SURFACE)), before);
  rmSync(root, { recursive: true, force: true });
});

test('CONTROL 5 — the hard-failure invariant fires on any non-exact restore', () => {
  // Witnessed directly rather than by arranging a real rollback failure. A guard whose ability to fire
  // can only be shown by breaking the thing it guards is a guard whose firing is assumed.
  const before = [{ path: 'impl.py', exists: true, sha256: 'aaa' },
    { path: 'limits.py', exists: false, sha256: null }];
  const exact = [{ path: 'impl.py', exists: true, sha256: 'aaa' },
    { path: 'limits.py', exists: false, sha256: null }];
  const leftBehind = [{ path: 'impl.py', exists: true, sha256: 'aaa' },
    { path: 'limits.py', exists: true, sha256: 'bbb' }];
  const contentDrift = [{ path: 'impl.py', exists: true, sha256: 'zzz' },
    { path: 'limits.py', exists: false, sha256: null }];

  assert.equal(checkRestored({ atomic: true, committed: false, before, after: exact }).ok, true);
  assert.equal(checkRestored({ atomic: true, committed: false, before, after: leftBehind }).ok, false,
    'a file the rollback failed to delete must be caught');
  assert.equal(checkRestored({ atomic: true, committed: false, before, after: contentDrift }).ok, false,
    'a file restored to the wrong bytes must be caught');
  assert.deepEqual(checkRestored({ atomic: true, committed: false, before, after: leftBehind }).changed,
    ['limits.py'], 'and it must name which path');
  // It must NOT fire on a committed transaction or in ablated mode - those are supposed to change state.
  assert.equal(checkRestored({ atomic: true, committed: true, before, after: leftBehind }).ok, true);
  assert.equal(checkRestored({ atomic: false, committed: false, before, after: leftBehind }).ok, true);
});

test('DOCUMENTED LIMITATION — anything outside the declared surface is invisible to both', () => {
  const root = freshRoot();
  // The surface omits limits.py, so op1 creates a file the manifest never looks at and the rollback
  // was never told to remove. The transaction reports the state unchanged, and within the surface it
  // IS unchanged - the promise about the writable surface is the caller's to keep, not this stage's.
  const r = runTransaction({ root, surface: ['impl.py'],
    operations: [opProvider, opConsumer('if n > LIMIT:')], verify: verdict(false), atomic: true });
  assert.equal(r.committed, false);
  assert.equal(r.stateUnchanged, true, 'unchanged WITHIN THE DECLARED SURFACE');
  assert.ok(existsSync(join(root, 'limits.py')),
    'and the undeclared file survives - stated here so it is documented rather than discovered later');
  rmSync(root, { recursive: true, force: true });
});

test('an operation that THROWS is also a failed transaction, and rolls back the same way', () => {
  const root = freshRoot();
  const before = manifestString(stateManifest(root, SURFACE));
  const exploding = { id: 'op2-throws', apply: () => { throw new Error('boom'); } };
  const r = runTransaction({ root, surface: SURFACE, operations: [opProvider, exploding],
    verify: verdict(true), atomic: true });
  assert.equal(r.committed, false);
  assert.equal(r.stateUnchanged, true);
  assert.equal(existsSync(join(root, 'limits.py')), false);
  assert.equal(manifestString(stateManifest(root, SURFACE)), before);
  rmSync(root, { recursive: true, force: true });
});

test('the manifest distinguishes creation, modification and absence', () => {
  const root = freshRoot();
  const m0 = stateManifest(root, SURFACE);
  assert.equal(m0.find((e) => e.path === 'limits.py').exists, false);
  assert.equal(m0.find((e) => e.path === 'impl.py').exists, true);
  writeFileSync(join(root, 'limits.py'), 'LIMIT = 10' + NL, 'utf8');
  const m1 = stateManifest(root, SURFACE);
  assert.equal(m1.find((e) => e.path === 'limits.py').exists, true);
  assert.notEqual(manifestString(m0), manifestString(m1));
  writeFileSync(join(root, 'impl.py'), BASE + NL + '# a comment' + NL, 'utf8');
  assert.notEqual(manifestString(m1), manifestString(stateManifest(root, SURFACE)),
    'a modification with the same path and existence must still change the manifest');
  rmSync(root, { recursive: true, force: true });
});

test('COMMIT never computes a verdict - it is handed one', () => {
  const root = freshRoot();
  let asked = 0;
  runTransaction({ root, surface: SURFACE, operations: [opProvider],
    verify: () => { asked++; return true; }, atomic: true });
  assert.equal(asked, 1, 'the verdict is requested exactly once and never second-guessed');
  rmSync(root, { recursive: true, force: true });
});
