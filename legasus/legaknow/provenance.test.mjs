// r4 — provenance binding. The expected behaviour of every case was decided BEFORE running.
import test from 'node:test';
import assert from 'node:assert';
import { bind, ledger, verifySeal, digestOf, NOT_ESTABLISHED } from './provenance.mjs';

const A = Buffer.from('{"runs": [1,2,3]}');
const B = Buffer.from('{"runs": [9,9,9]}');
const led = () => ledger([
  bind({ bytes: A, producedBy: 'LEGASUS_REPLAY_r3', path: 'benchmarks/RESULT.json',
    git: { commit: 'abc1234' } }),
]);

test('SAME PATH, CHANGED BYTES — provenance MUST NOT transfer', () => {
  // The defect this replaces: a pathname-keyed sidecar would hand B the attribution earned by A.
  const l = led();
  assert.equal(l.lookup(A).producedBy, 'LEGASUS_REPLAY_r3');
  const got = l.lookup(B);
  assert.equal(got.provenance, NOT_ESTABLISHED);
  assert.match(got.why, /never a licence to attribute it to whatever last occupied its path/);
});

test('DIFFERENT PATH, IDENTICAL BYTES — provenance IS retained, by prior decision', () => {
  // Decided before testing: moving or renaming an artifact does not change what produced it. Without
  // this the property would just mean brittleness.
  const l = led();
  const moved = Buffer.from(A);           // same content, imagined at another location
  const got = l.lookup(moved);
  assert.equal(got.producedBy, 'LEGASUS_REPLAY_r3');
  assert.equal(got.describedPath, 'benchmarks/RESULT.json',
    'the original path survives as DESCRIPTION, and played no part in the lookup');
});

test('MISSING ARTIFACT — provenance does not manufacture evidence', () => {
  const l = led();
  assert.equal(l.lookup(Buffer.from('')).provenance, NOT_ESTABLISHED);
  assert.equal(l.lookup(Buffer.from('anything else')).provenance, NOT_ESTABLISHED);
});

test('A BINDING WITHOUT A DECLARATION IS REFUSED', () => {
  const r = bind({ bytes: A });
  assert.equal(r.rejected, true);
  assert.match(r.why, /manufacture provenance out of nothing/);
  // and a refused binding never enters the ledger
  const l = ledger([r]);
  assert.equal(l.lookup(A).provenance, NOT_ESTABLISHED);
});

test('A MODIFIED SIDECAR IS DETECTABLE', () => {
  const l = led();
  const sealed = l.seal();
  assert.equal(verifySeal(l, sealed).ok, true);

  const tampered = ledger([
    bind({ bytes: A, producedBy: 'LEGASUS_REPLAY_r3' }),
    bind({ bytes: B, producedBy: 'CPYTHON_DOCTEST' }),   // an attribution added later
  ]);
  const v = verifySeal(tampered, sealed);
  assert.equal(v.ok, false);
  assert.match(v.why, /may not be relied upon/);
});

test('HISTORICAL ARTIFACT — the producer binding is reconstructible from content alone', () => {
  // The requirement the retirement exposed: evidence must outlive BOTH its subject and its producer
  // implementation. Neither is present here; only bytes and a ledger.
  const l = led();
  const rediscovered = l.lookup(Buffer.from('{"runs": [1,2,3]}'));
  assert.equal(rediscovered.producedBy, 'LEGASUS_REPLAY_r3');
  assert.equal(rediscovered.git.commit, 'abc1234');
  assert.equal(rediscovered.digest, digestOf(A));
});

test('LIFETIME — evidence validity is determined by recorded conditions, not by either endpoint', () => {
  // subject lifetime != evidence lifetime, and producer lifetime != evidence lifetime. Together they
  // mean a lookup must succeed with nothing available but the bytes and the ledger.
  const l = led();
  const onlyBytes = Buffer.from(A);
  const got = l.lookup(onlyBytes);
  assert.equal(got.producedBy, 'LEGASUS_REPLAY_r3');
  assert.equal(typeof got.describedPath, 'string');
  assert.notEqual(got.provenance, NOT_ESTABLISHED);
});
