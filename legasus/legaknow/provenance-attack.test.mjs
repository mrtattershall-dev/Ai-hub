// r4 — provenance after the digest migration, under attack. Predictions were frozen in
// benchmarks/COMPOSITION_PREREG.md (C8); the PRE-REPAIR run that reproduced both defects is preserved
// in benchmarks/RESULT.composition.md and at b11e51f, where this file asserted the defects. It now
// asserts the repairs and keeps every control.
import test from 'node:test';
import assert from 'node:assert';
import { bind, ledger, verifySeal, NOT_ESTABLISHED, CONTESTED, digestOf } from './provenance.mjs';

const BYTES = Buffer.from('{"result": 1}');

test('C8-a REGRESSION — two bindings over the SAME bytes with DIFFERENT producers are CONTESTED, neither returned', () => {
  const first = bind({ bytes: BYTES, producedBy: 'LEGASUS_REPLAY_r3', path: 'a.json' });
  const second = bind({ bytes: BYTES, producedBy: 'CPYTHON_DOCTEST', path: 'b.json' });
  const led = ledger([first, second]);
  const found = led.lookup(BYTES);
  assert.equal(found.provenance, CONTESTED, 'b11e51f returned the second binding here');
  assert.equal(found.producedBy, undefined);
  assert.deepEqual(found.bindings.map((b) => b.producedBy).sort(), ['CPYTHON_DOCTEST', 'LEGASUS_REPLAY_r3']);
  assert.match(found.why, /last-wins/);
  // a third, different attribution joins the contest; order of arrival does not pick a winner
  const third = bind({ bytes: BYTES, producedBy: 'LEGASUS_r4', path: 'c.json' });
  assert.equal(ledger([third, first, second]).lookup(BYTES).bindings.length, 3);
});

test('C8-a ADMIT CONTROL — the same attribution bound twice is ONE attribution, not a contest', () => {
  const a = bind({ bytes: BYTES, producedBy: 'CPYTHON_DOCTEST', path: 'a.json', git: { commit: 'abc' } });
  const b = bind({ bytes: BYTES, producedBy: 'CPYTHON_DOCTEST', path: 'moved/a.json', git: { commit: 'abc' } });
  const found = ledger([a, b]).lookup(BYTES);
  assert.equal(found.producedBy, 'CPYTHON_DOCTEST');
  assert.equal(found.provenance, undefined);
});

test('C8-b REGRESSION — the seal covers attribution: mutating producedBy or the commit breaks it', () => {
  const b = bind({ bytes: BYTES, producedBy: 'CPYTHON_DOCTEST', path: 'a.json', git: { commit: 'abc' } });
  const led = ledger([b]);
  const sealed = led.seal();
  assert.equal(verifySeal(led, sealed).ok, true, 'untampered verifies');
  led.byDigest.get(digestOf(BYTES)).producedBy = 'LEGASUS_REPLAY_r3';
  assert.equal(verifySeal(led, sealed).ok, false, 'b11e51f verified this tamper');
  led.byDigest.get(digestOf(BYTES)).producedBy = 'CPYTHON_DOCTEST';
  assert.equal(verifySeal(led, sealed).ok, true, 'restored, it verifies again');
  led.byDigest.get(digestOf(BYTES)).git = { commit: 'def' };
  assert.equal(verifySeal(led, sealed).ok, false, 'a moved commit is a changed attribution');
});

test('C8 CONTROLS — the properties that already held', () => {
  const b = bind({ bytes: BYTES, producedBy: 'CPYTHON_DOCTEST', path: 'a.json' });
  const led = ledger([b]);
  assert.equal(led.lookup(Buffer.from('{"result": 2}')).provenance, NOT_ESTABLISHED);
  assert.equal(led.lookup(BYTES).producedBy, 'CPYTHON_DOCTEST');
  const sealed = led.seal();
  assert.equal(verifySeal(ledger([]), sealed).ok, false);
  assert.equal(bind({ bytes: BYTES }).rejected, true);
});
