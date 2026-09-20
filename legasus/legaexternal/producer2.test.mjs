// r4 — producer #2 (git) against the evidence boundary. Predictions E1-E10 frozen in 087ec67.
//
// Run against the EXISTING adapter first, so that any shape change is DISCOVERED rather than pre-empted.
// If the boundary has to bend, that is the result.
import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runGitProducer, gitIdentity } from './git-producer.mjs';
import { adaptRecord, readapt, UNKNOWN_MAPPING, FOR_PRODUCER } from './adapt.mjs';

const NL = String.fromCharCode(10);

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'gitp-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  g('init', '-q');
  g('config', 'user.email', 'r4@example.invalid');
  g('config', 'user.name', 'r4');
  writeFileSync(join(dir, 'clean.txt'), 'committed content' + NL, 'utf8');
  writeFileSync(join(dir, 'dirty.txt'), 'original' + NL, 'utf8');
  g('add', '.');
  g('commit', '-q', '-m', 'base');
  writeFileSync(join(dir, 'dirty.txt'), 'changed after commit' + NL, 'utf8');
  writeFileSync(join(dir, 'untracked.txt'), 'never added' + NL, 'utf8');
  return dir;
}

const PATHS = ['clean.txt', 'dirty.txt', 'untracked.txt'];

test('E1 — raw producer evidence survives WITHOUT translation into Legasus vocabulary', () => {
  const dir = repo();
  const p = runGitProducer({ repo: dir, paths: PATHS });
  assert.equal(p.ok, true, p.why);
  const natives = p.records.map((r) => r.nativeResult).sort();
  assert.deepEqual(natives, ['TRACKED_CLEAN', 'TRACKED_MODIFIED', 'UNTRACKED']);
  // none of these is a verdict vocabulary borrowed from doctest
  for (const n of natives) assert.ok(!['PASS', 'FAIL', 'OUTPUT_MISMATCH'].includes(n));
  rmSync(dir, { recursive: true, force: true });
});

test('E2 — producer-native identity remains authoritative; no example-ordinal scheme imposed', () => {
  const dir = repo();
  const p = runGitProducer({ repo: dir, paths: PATHS });
  for (const r of p.records) {
    assert.match(r.identity.object, /^[0-9a-f]{40}$/, 'git identity is its own content-addressed oid');
    assert.equal(r.identity.ordinal, undefined, 'no ordinal is invented for a producer that has none');
    assert.equal(r.identity.document, undefined, 'no document is invented either');
  }
  // two DIFFERENT paths with IDENTICAL content share an oid - that is git's identity, and it is correct
  writeFileSync(join(dir, 'copy.txt'), 'committed content' + NL, 'utf8');
  const q = runGitProducer({ repo: dir, paths: ['clean.txt', 'copy.txt'] });
  assert.equal(q.records[0].identity.object, q.records[1].identity.object,
    'identical content IS the same git object; the boundary must not override the producer on identity');
  assert.notEqual(gitIdentity(q.records[0]), 'git|' + q.producerVersion + '|clean.txt');
  rmSync(dir, { recursive: true, force: true });
});

test('E3 — native distinctions survive storage even where Legasus has no equivalent', () => {
  const dir = repo();
  const p = runGitProducer({ repo: dir, paths: PATHS });
  const dirty = p.records.find((r) => r.path === 'dirty.txt');
  assert.equal(dirty.nativeResult, 'TRACKED_MODIFIED');
  assert.equal(dirty.nativeDetails.matchesCommitted, false,
    'worktree-vs-committed divergence has NO doctest analogue and is preserved anyway');
  assert.match(dirty.nativeDetails.committedOid, /^[0-9a-f]{40}$/);
  assert.notEqual(dirty.nativeDetails.worktreeOid, dirty.nativeDetails.committedOid);
  rmSync(dir, { recursive: true, force: true });
});

test('E4 — the adapter cannot create a distinction absent from raw evidence', () => {
  // git reports UNTRACKED without saying WHY. An adapter must not resolve that into "deliberately
  // ignored" versus "forgotten".
  const rec = { path: 'x', nativeResult: 'UNTRACKED', nativeDetails: {},
    identity: { producer: 'git', producerVersion: '2.0', object: 'a'.repeat(40) } };
  const out = adaptRecord(rec);
  assert.equal(out.observability, UNKNOWN_MAPPING,
    'the doctest mapping declares nothing for UNTRACKED, so it is UNKNOWN rather than guessed');
  assert.equal(out.assertion, null);
});

test('E5 — producer failure yields non-knowledge, never reenactment', () => {
  const p = runGitProducer({ repo: join(tmpdir(), 'definitely-not-a-repo-' + Date.now()),
    paths: ['x'] });
  assert.equal(p.ok, false);
  assert.equal(p.producerFailed, true);
  assert.match(p.why, /no evidential force/);
  assert.equal(p.records, undefined, 'a failed producer emits no records to be mistaken for evidence');
});

test('E9 — a malformed producer record is REFUSED, not coerced', () => {
  const malformed = { path: 'x', nativeResult: 'SOMETHING_GIT_NEVER_SAYS',
    identity: { producer: 'git', producerVersion: '2.0', object: 'b'.repeat(40) } };
  const out = adaptRecord(malformed);
  assert.equal(out.observability, UNKNOWN_MAPPING);
  assert.match(out.why, /invented distinction/);
});

test('E10 — evidence stays interpretable after BOTH the subject and the producer are gone', () => {
  const dir = repo();
  const p = runGitProducer({ repo: dir, paths: PATHS });
  rmSync(dir, { recursive: true, force: true });     // the SUBJECT is gone
  // and nothing here calls git again: only the preserved records and the adapter
  const again = readapt(p.records);
  assert.equal(again.length, 3);
  for (let i = 0; i < again.length; i++) {
    assert.equal(again[i].native.result, p.records[i].nativeResult, 'raw survives verbatim');
    assert.equal(again[i].identity.object, p.records[i].identity.object);
  }
  const twice = readapt(p.records);
  assert.deepEqual(again, twice, 're-adaptation is deterministic');
});

test('E7 — THE ANTI-COLLAPSE CONTROL: at least one distinction stays producer-specific', () => {
  const dir = repo();
  const p = runGitProducer({ repo: dir, paths: PATHS });
  // A content-addressed object id, and worktree-vs-committed divergence, have no doctest counterpart at
  // all. If every producer collapsed to PASS / FAIL / UNKNOWN these could not exist.
  const specific = p.records.filter((r) => /^[0-9a-f]{40}$/.test(r.identity.object)
    && Object.hasOwn(r.nativeDetails, 'matchesCommitted'));
  assert.equal(specific.length, 3, 'producer-specific structure survives for every record');
  const vocab = new Set(p.records.map((r) => r.nativeResult));
  assert.equal([...vocab].some((v) => ['PASS', 'FAIL', 'UNKNOWN'].includes(v)), false,
    'git evidence is NOT expressible in a three-state verdict vocabulary');
  rmSync(dir, { recursive: true, force: true });
});

test('THE STRAIN PRODUCER #2 FOUND — a fabricated coordinate, now absent instead', () => {
  // The boundary hard-coded doctest's `document#ordinal` history. Handed a git record it emitted the
  // literal string "undefined#undefined" - UNKNOWN collapsing into a value, inside the abstraction built
  // to prevent exactly that. Producer #2 found it within minutes of being pointed at the boundary.
  const git = { path: 'x', nativeResult: 'TRACKED_CLEAN', nativeDetails: {},
    identity: { producer: 'git', producerVersion: '2.43', object: 'a'.repeat(40),
      head: 'b'.repeat(40) } };
  const sc = adaptRecord(git).scope;
  assert.equal(Object.hasOwn(sc, 'history'), false,
    'a coordinate the producer cannot establish must be ABSENT, not invented');
  assert.equal(JSON.stringify(sc).includes('undefined'), false);
  assert.equal(sc.implementation, 'a'.repeat(40), 'and git\'s own coordinates ARE carried');
  assert.equal(sc.repository, 'b'.repeat(40));
});

test('E8 — existing doctest evidence and its adaptation remain unchanged', () => {
  const dt = { nativeResult: 'PASS', nativeDetails: { got: 'x' }, want: 'x\n', source: 'f()',
    identity: { producer: 'CPython doctest', producerVersion: '3.13', document: 'm.f', ordinal: 0 } };
  const out = adaptRecord(dt);
  assert.equal(out.scope.history, 'm.f#0', 'doctest still gets its history coordinate');
  assert.equal(out.scope.criterion, 'CPython doctest 3.13');
  assert.equal(out.observability, 'OBSERVED');
  assert.equal(out.assertion, 'HELD');
  assert.equal(out.native.want, 'x\n', 'the unstripped want still survives');
});

test('E6 — a SCOPED Legasus claim legitimately derives from git evidence', () => {
  const dir = repo();
  const p = runGitProducer({ repo: dir, paths: ['clean.txt', 'dirty.txt'] });
  // git's OWN vocabulary, declared rather than borrowed. There is no assertion here, and forcing one
  // would be inventing a distinction the producer never made.
  // Declared for git under FOR_PRODUCER since composition attack W2-g: a mapping states whose
  // vocabulary it translates, and applies to no other producer's records.
  const GIT_MAPPING = {
    [FOR_PRODUCER]: 'git',
    TRACKED_CLEAN: { observability: 'OBSERVED', assertion: null },
    TRACKED_MODIFIED: { observability: 'OBSERVED', assertion: null },
    UNTRACKED: { observability: 'OBSERVED', assertion: null },
    UNREADABLE: { observability: 'PRODUCER_FAILED', assertion: null },
  };
  const adapted = p.records.map((r) => adaptRecord(r, { mapping: GIT_MAPPING }));

  // THE CLAIM: "the copy measured is the copy that was committed" - a real fact Legasus consumes, and
  // the byte-identity half of THE COPY YOU MEASURE MUST BE THE COPY YOU EDITED.
  const clean = adapted.find((a) => a.native.details.matchesCommitted === true);
  const dirtyOne = adapted.find((a) => a.native.details.matchesCommitted === false);
  assert.ok(clean, 'one file matches its committed object');
  assert.ok(dirtyOne, 'and one does not');
  assert.equal(clean.observability, 'OBSERVED');
  assert.equal(clean.assertion, null, 'git establishes identity, NOT an assertion');
  // the claim is SCOPED by git's own coordinates, not by a borrowed history
  assert.match(clean.scope.criterion, /^git /);
  assert.equal(clean.scope.implementation, clean.identity.object);
  assert.equal(Object.hasOwn(clean.scope, 'history'), false);
  rmSync(dir, { recursive: true, force: true });
});
