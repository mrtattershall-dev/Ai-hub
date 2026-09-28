// THE THREE CONSERVATION LAWS, plus the adapter law. If these survive serious attempts to break them
// they matter more than any module name.
//
//   1  Authority cannot be created by destroying information.        (monotonicity.test.mjs)
//   2  Authority cannot be transferred by changing the referent.
//   3  Authority cannot authorize its own expansion.
//   4  Adapters may not invent distinctions their source does not support.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { transfer, reinterpret, scopedClaim, bridgeTransfers, referentDelta, BRIDGE, POLARITY }
  from './referent.mjs';
import { surfaceAuthority, mayApply, judgesOf, DOMAIN, AUTHORIZATION } from './escalation.mjs';
import { illegalRefinement } from './monotonicity.mjs';
import { OBSERVABILITY } from './observation.mjs';

const R = (o) => ({ subject: 'farm.plant', criterion: 'PURPOSE1', observer: 'witness-r1',
  scope: 'S41', ...o });

// ---------------------------------------------------------------- LAW 2

test('LAW 2 — a moved referent with NO bridge is STALE, not "probably still fine"', () => {
  const t = transfer({ from: R(), to: R({ criterion: 'PURPOSE2' }) });
  assert.equal(t.ok, false);
  assert.equal(t.verdict, 'STALE');
  assert.deepEqual(t.moved, ['criterion']);
  assert.match(t.blocked[0].why, /is not evidence about another/);
});

test('LAW 2 — an unmoved referent transfers freely, or the law is a wall', () => {
  const t = transfer({ from: R(), to: R() });
  assert.equal(t.ok, true);
  assert.deepEqual(t.moved, []);
});

test('LAW 2 — TRANSFER IS POLARITY-DEPENDENT, which is the part that is easy to get wrong', () => {
  // NARROWED: the new criterion is stricter. Failing the looser implies failing the stricter, so a
  // NEGATIVE result carries. Passing the looser says nothing about the stricter.
  assert.equal(bridgeTransfers(BRIDGE.NARROWED, POLARITY.NEGATIVE), true);
  assert.equal(bridgeTransfers(BRIDGE.NARROWED, POLARITY.POSITIVE), false);
  // EXPANDED: the new criterion is looser. Exactly the reverse.
  assert.equal(bridgeTransfers(BRIDGE.EXPANDED, POLARITY.POSITIVE), true);
  assert.equal(bridgeTransfers(BRIDGE.EXPANDED, POLARITY.NEGATIVE), false);
  assert.equal(bridgeTransfers(BRIDGE.PRESERVED, POLARITY.POSITIVE), true);
  assert.equal(bridgeTransfers(BRIDGE.PRESERVED, POLARITY.NEGATIVE), true);
  for (const p of Object.values(POLARITY)) {
    assert.equal(bridgeTransfers(BRIDGE.REPLACED, p), false);
    assert.equal(bridgeTransfers(BRIDGE.UNKNOWN, p), false);
  }

  // And end to end: a PASS under a looser criterion does not become a PASS under a stricter one.
  const strictened = transfer({ from: R(), to: R({ criterion: 'PURPOSE2' }),
    polarity: POLARITY.POSITIVE, bridges: { criterion: BRIDGE.NARROWED } });
  assert.equal(strictened.ok, false);
  assert.equal(strictened.verdict, 'INCOMPARABLE');
  const failure = transfer({ from: R(), to: R({ criterion: 'PURPOSE2' }),
    polarity: POLARITY.NEGATIVE, bridges: { criterion: BRIDGE.NARROWED } });
  assert.equal(failure.ok, true);
});

test('LAW 2 — "merely known to be different" is UNKNOWN and carries nothing', () => {
  const t = transfer({ from: R(), to: R({ criterion: 'PURPOSE2' }),
    bridges: { criterion: BRIDGE.UNKNOWN } });
  assert.equal(t.ok, false);
});

test('LAW 2 — THE PURPOSE PROTECTION: past progress is not upgraded by changing the constitution', () => {
  // The claim remains TRUE about its own referent. What is refused is rereading it.
  const claim = scopedClaim({ proposition: 'the project advanced S41 -> S42',
    referent: R(), polarity: POLARITY.POSITIVE, evidence: ['witness w1'] });
  assert.equal(claim.rejected, undefined);

  const reread = reinterpret(claim, R({ criterion: 'PURPOSE2' }), {});
  assert.equal(reread.ok, false);
  assert.match(reread.why, /REMAINS TRUE about its own referent/);

  // With an authorised EXPANDED refinement, a positive claim does carry across.
  const ok = reinterpret(claim, R({ criterion: 'PURPOSE2' }), { criterion: BRIDGE.EXPANDED });
  assert.equal(ok.ok, true);
  assert.equal(ok.claim.transferredVia[0].relation, BRIDGE.EXPANDED);
});

test('LAW 2 — a claim that cannot say what it is about is refused at construction', () => {
  const bad = scopedClaim({ proposition: 'it got better', referent: { subject: 'x' } });
  assert.equal(bad.rejected, true);
  assert.match(bad.why, /cannot be told apart from a claim about something else/);
  assert.deepEqual(referentDelta(R(), R({ observer: 'witness-r2' })), ['observer']);
});

// ---------------------------------------------------------------- LAW 3

test('LAW 3 — the judging graph, and it is not a total order', () => {
  assert.ok(judgesOf(DOMAIN.SUBJECT).includes(DOMAIN.EVIDENCE));
  assert.ok(judgesOf(DOMAIN.SUBJECT).includes(DOMAIN.CRITERION));
  assert.ok(judgesOf(DOMAIN.SUBJECT).includes(DOMAIN.APPARATUS));
  assert.equal(judgesOf(DOMAIN.SUBJECT).includes(DOMAIN.SUBJECT), false);
  // APPARATUS judges EVIDENCE without being judged by SPECIFICATION.
  assert.ok(judgesOf(DOMAIN.EVIDENCE).includes(DOMAIN.APPARATUS));
});

test('LAW 3 — an implementation-only change is permitted', () => {
  const s = surfaceAuthority({ path: 'packaging/utils.py', line: '    return value.lower()' });
  assert.deepEqual(s.affects, [DOMAIN.SUBJECT]);
  assert.equal(mayApply({ grantedOver: [DOMAIN.SUBJECT], affects: s.affects }).ok, true);
});

test('LAW 3 — THE DOCTEST CASE: editing a `>>>` line reaches into what judges you', () => {
  const s = surfaceAuthority({ path: 'packaging/specifiers.py', insideDocstring: true,
    line: '        >>> Specifier(">=1.2.3").contains("1.2.3")' });
  assert.ok(s.affects.includes(DOMAIN.EVIDENCE));
  const r = mayApply({ grantedOver: [DOMAIN.SUBJECT], affects: s.affects });
  assert.equal(r.ok, false);
  assert.equal(r.verdict, 'AUTHORITY_ESCALATION');
  assert.ok(r.escalating.includes(DOMAIN.EVIDENCE));
  assert.match(r.why, /self-ratification/);
});

test('LAW 3 — the expected-output line is SPECIFICATION, and is also refused', () => {
  const s = surfaceAuthority({ path: 'packaging/specifiers.py', insideDocstring: true,
    line: '        False' });
  assert.ok(s.affects.includes(DOMAIN.SPECIFICATION));
  assert.equal(mayApply({ grantedOver: [DOMAIN.SUBJECT], affects: s.affects }).ok, false);
});

test('LAW 3 — SELF authorization never suffices; INDEPENDENT does', () => {
  const affects = [DOMAIN.SUBJECT, DOMAIN.EVIDENCE];
  assert.equal(mayApply({ grantedOver: [DOMAIN.SUBJECT], affects,
    authorizedBy: AUTHORIZATION.SELF }).ok, false);
  const owner = mayApply({ grantedOver: [DOMAIN.SUBJECT], affects,
    authorizedBy: AUTHORIZATION.OWNER });
  assert.equal(owner.ok, true, 'a human taking responsibility is a real authorization');
  assert.deepEqual(owner.escalating, [DOMAIN.EVIDENCE]);
});

test('LAW 3 — moving DOWNWARD is not escalation', () => {
  // Granted the criterion, changing the implementation is ordinary work, not a privilege grab.
  const r = mayApply({ grantedOver: [DOMAIN.CRITERION, DOMAIN.SUBJECT], affects: [DOMAIN.SUBJECT] });
  assert.equal(r.ok, true);
});

test('LAW 3 — the real frozen 56: exactly the five specification mutations are refused', () => {
  const candidates = JSON.parse(readFileSync('benchmarks/repoB/candidates.json', 'utf8'));
  const refused = candidates.filter((c) => {
    const line = c.anchorLF;
    const s = surfaceAuthority({ path: 'packaging/' + c.file, insideDocstring: /^\s*>>>/.test(line),
      line });
    return !mayApply({ grantedOver: [DOMAIN.SUBJECT], affects: s.affects }).ok;
  });
  assert.equal(refused.length, 5,
    'refused: ' + refused.map((c) => c.file + '/' + c.fn).join(', '));
  assert.equal(candidates.length - refused.length, 51, 'and the behavioural 51 are permitted');
});

// ---------------------------------------------------------------- LAW 4

test('LAW 4 — an adapter may not invent a distinction its source cannot make', () => {
  // The external system reports only ERROR. Reality was two different things.
  const states = [
    { name: 'observer crashed', source: 'ERROR', truth: OBSERVABILITY.PRODUCER_FAILED },
    { name: 'subject crashed', source: 'ERROR', truth: OBSERVABILITY.SUBJECT_FAILED },
  ];
  const consumers = [{ name: 'schedules observer repair',
    grants: (s) => s === OBSERVABILITY.PRODUCER_FAILED }];

  // A guessing adapter: peeks at the truth the source never exposed.
  const guessing = illegalRefinement({ states, adapt: (s) => s.truth, consumers });
  assert.equal(guessing.ok, false);
  assert.match(guessing.violations[0].why, /INVENTED a distinction its source does not support/);

  // An honest adapter maps an unattributable ERROR to UNATTRIBUTABLE for both.
  const honest = illegalRefinement({ states, adapt: () => OBSERVABILITY.UNATTRIBUTABLE, consumers });
  assert.equal(honest.ok, true);
});

test('LAW 4 — discarding a distinction the source DOES make is still legal', () => {
  // Adapters may lose information; they may not gain it. This is the asymmetry.
  const states = [
    { name: 'assertion failed', source: 'FAIL', truth: 'OUTPUT_MISMATCH' },
    { name: 'never ran', source: 'SKIP', truth: 'NOT_ATTEMPTED' },
  ];
  const r = illegalRefinement({ states, adapt: () => 'BLOCKED',
    consumers: [{ name: 'may be used as evidence', grants: (s) => s === 'OBSERVED' }] });
  assert.equal(r.ok, true);
});
