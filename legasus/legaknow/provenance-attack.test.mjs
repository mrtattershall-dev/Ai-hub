// r4 — ATTACK on provenance after the digest migration. Predictions frozen in
// benchmarks/COMPOSITION_PREREG.md (C8) BEFORE this file existed. Assertions state the PREDICTED DEFECT.
import test from 'node:test';
import assert from 'node:assert';
import { bind, ledger, verifySeal, NOT_ESTABLISHED, digestOf } from './provenance.mjs';

const BYTES = Buffer.from('{"result": 1}');

test('C8-a ATTACK — two bindings over the SAME bytes with DIFFERENT producers: last wins, silently', () => {
  const first = bind({ bytes: BYTES, producedBy: 'LEGASUS_REPLAY_r3', path: 'a.json' });
  const second = bind({ bytes: BYTES, producedBy: 'CPYTHON_DOCTEST', path: 'b.json' });
  assert.equal(first.digest, second.digest);
  const led = ledger([first, second]);
  const found = led.lookup(BYTES);
  // PREDICTED DEFECT: one attribution returned, the other gone, no conflict reported.
  assert.equal(found.producedBy, 'CPYTHON_DOCTEST', 'prediction C8-a: last wins');
  assert.equal(found.contested, undefined);
});

test('C8-b ATTACK — the seal does not cover attribution: mutating producedBy leaves the seal valid', () => {
  const b = bind({ bytes: BYTES, producedBy: 'CPYTHON_DOCTEST', path: 'a.json',
    git: { commit: 'abc' } });
  const led = ledger([b]);
  const sealed = led.seal();
  led.byDigest.get(digestOf(BYTES)).producedBy = 'LEGASUS_REPLAY_r3';
  // PREDICTED DEFECT: the tamper is invisible to the seal.
  assert.equal(verifySeal(led, sealed).ok, true, 'prediction C8-b: seal still verifies');
});

test('C8 CONTROLS — the properties that already hold', () => {
  const b = bind({ bytes: BYTES, producedBy: 'CPYTHON_DOCTEST', path: 'a.json' });
  const led = ledger([b]);
  // same path / changed bytes -> NOT_ESTABLISHED
  assert.equal(led.lookup(Buffer.from('{"result": 2}')).provenance, NOT_ESTABLISHED);
  // different path / identical bytes -> retains
  assert.equal(led.lookup(BYTES).producedBy, 'CPYTHON_DOCTEST');
  // a removed record changes the seal
  const sealed = led.seal();
  const smaller = ledger([]);
  assert.equal(verifySeal(smaller, sealed).ok, false);
  // an undeclared producer is refused at bind
  assert.equal(bind({ bytes: BYTES }).rejected, true);
});
