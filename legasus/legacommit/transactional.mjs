// LEGACOMMIT — transactional persistence, and the switch that ablates it.
//
// THE DISTINCTION, FROZEN HERE SO THIS STAGE DOES NOT DRIFT INTO BEING A SECOND VERIFIER:
//
//     PROVE   decides whether the candidate DESERVES persistence
//     COMMIT  decides whether persistence is ATOMIC
//
// This module never inspects a program's meaning. It is handed a verdict and is responsible only for
// what the repository looks like afterwards. If it ever starts deciding correctness, it has become
// LegaVerify wearing a different name and the necessity table entry for it is meaningless.
//
// THE CLAIM UNDER TEST is stronger than "we reverted broken code":
//
//     A LOCALLY CORRECT CHANGE IS STILL WRONG TO PERSIST WHEN IT BELONGS TO A TRANSACTION THAT DID
//     NOT COMPLETE.
//
// So the experiment's first operation must be GOOD CODE on its own. Otherwise rollback is trivial and
// proves nothing: of course the broken thing was removed. The interesting state is the one where
// `op1` would have been a perfectly acceptable change had anybody asked for it alone - and nobody did.
//
// THE STATE MANIFEST IS OVER THE DECLARED WRITABLE SURFACE, not over one file. It records path,
// existence, and content hash, so it catches a creation that was not undone, a deletion that was not
// restored, a partial write, and one file rolling back while another does not. Comparing a single hash
// would miss every one of those.
//
// ROLLBACK FAILURE IS A HARD FAILURE. If the restored manifest is anything other than byte-exact, this
// throws. There is no "close enough" for a repository.
//
// AND A LIMITATION THAT MUST BE STATED RATHER THAN DISCOVERED LATER: both the manifest and the rollback
// see ONLY the declared writable surface. A file created outside it is invisible to both - it will not
// appear in the state comparison and it will not be removed by a restore. The surface is a promise the
// caller makes, and this stage cannot check that the promise was kept. A test below asserts that
// limitation explicitly so it is documented behaviour rather than a surprise.
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';

const NL = String.fromCharCode(10);
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

// The canonical state of the declared writable surface. Paths are relative to the root and sorted, so
// two manifests of the same state are byte-identical strings.
export function stateManifest(root, surface) {
  return surface.slice().sort().map((rel) => {
    const abs = join(root, rel);
    if (!existsSync(abs)) return { path: rel, exists: false, sha256: null };
    return { path: rel, exists: true, sha256: sha(readFileSync(abs)) };
  });
}

export const manifestString = (m) => m.map((e) => e.path + ' ' + (e.exists ? e.sha256 : 'ABSENT')).join(NL);

function snapshot(root, surface) {
  const snap = new Map();
  for (const rel of surface) {
    const abs = join(root, rel);
    snap.set(rel, existsSync(abs) ? readFileSync(abs) : null);
  }
  return snap;
}

function restore(root, snap) {
  for (const [rel, bytes] of snap) {
    const abs = join(root, rel);
    if (bytes === null) { if (existsSync(abs)) rmSync(abs, { force: true }); continue; }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, bytes);
  }
}

// Run a transaction over a declared writable surface.
//
//   atomic true   the transaction is all-or-nothing: a failed verification restores the entry state
//   atomic false  THE ABLATION. Operations persist as they are applied and nothing is undone.
//
// `operations` are applied in the order given. `verify` is called once, after all of them, and returns
// a boolean. It is the caller's - LegaVerify's - verdict, not this module's.
export function runTransaction({ root, surface, operations, verify, atomic = true }) {
  const before = stateManifest(root, surface);
  const snap = snapshot(root, surface);
  const applied = [];

  for (const op of operations) {
    try { op.apply(root); applied.push(op.id); } catch (e) {
      // An operation that throws is a failed transaction under either mode; only the aftermath differs.
      if (atomic) restore(root, snap);
      const after = stateManifest(root, surface);
      return finish({ before, after, applied, committed: false, atomic,
        reason: 'operation ' + op.id + ' threw: ' + String(e.message).slice(0, 60) });
    }
  }

  const verified = verify(root);
  if (!verified && atomic) restore(root, snap);
  const after = stateManifest(root, surface);
  return finish({ before, after, applied, committed: verified, atomic,
    reason: verified ? 'verified' : 'verification failed' });
}

// The hard-failure invariant, exported so it can be witnessed directly rather than only through a
// transaction that happens to trigger it. A guard that can only be tested by arranging a real failure
// is a guard whose ability to fire is assumed.
export function checkRestored({ atomic, committed, before, after }) {
  if (!atomic || committed) return { ok: true };
  const b = manifestString(before);
  const a = manifestString(after);
  if (b === a) return { ok: true };
  const changed = before.filter((x, i) => manifestString([x]) !== manifestString([after[i]])).map((x) => x.path);
  return { ok: false, changed };
}

function finish(r) {
  const beforeS = manifestString(r.before);
  const afterS = manifestString(r.after);
  r.stateUnchanged = beforeS === afterS;
  r.changedPaths = r.before.filter((b, i) => manifestString([b]) !== manifestString([r.after[i]]))
    .map((b) => b.path);
  // THE HARD FAILURE. A rollback that does not land byte-exactly on the entry state is not a rollback.
  const restored = checkRestored(r);
  if (!restored.ok) {
    throw new Error('ROLLBACK DID NOT RESTORE THE ENTRY STATE - changed: ' + restored.changed.join(', ')
      + '. There is no close enough for a repository.');
  }
  return r;
}

export { NL };
