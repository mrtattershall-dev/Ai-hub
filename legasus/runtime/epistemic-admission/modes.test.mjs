// T0..T8 — what would SATISFY this consumer's obligation, as distinct from whether everything
// relevant has been exposed. Predictions frozen in REQUIREMENT-MODES_PREREG.md.
//
// The default is NOT one of the three modes and never had a name. T1 pins it.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { adapt } from './adapter.mjs';
import { admit, STATE } from './admission.mjs';
import { store, relationClaim } from './authority-store.mjs';
import { journalEntry } from './replay.mjs';
import { merge, replayMerged, outcomeFor, MODE } from './merge.mjs';

const load = (n) => JSON.parse(readFileSync(new URL('./natural/' + n + '.json', import.meta.url), 'utf8'));
const REL2 = load('REL2'), ORD2 = load('ORD2');
const cov = (c) => c.derivation.alternatives[0].relation_witnesses.find((w) => w.relation === 'COVERAGE');
const NEED = relationClaim('COVERAGE', cov(ORD2).subject, cov(ORD2).object);

function supplier(ref, mutate = (c) => c) {
  const st = store();
  const c = mutate(structuredClone(REL2));
  admit(c, { authorityStore: st });
  const out = adapt(c, { authorityStore: st });
  const filed = st.admitToken(out.token, { fromCertificate: c.provenance.run_id });
  const e = journalEntry({ ref: filed.ref, store: st, certificate: c, consumed: [] }).entry;
  e.ref = ref;
  return e;
}
function consumer(ref, rootRef = 'auth:9:gone', mutate = (c) => c) {
  const st = store();
  const rel = structuredClone(REL2);
  admit(rel, { authorityStore: st });
  const filed = st.admitToken(adapt(rel, { authorityStore: st }).token, { fromCertificate: 'seed' });
  const o = mutate(structuredClone(ORD2));
  const w = cov(o);
  w.evidence_root = filed.ref;
  const out = adapt(o, { authorityStore: st });
  const f2 = st.admitToken(out.token, { fromCertificate: o.provenance.run_id });
  const e = journalEntry({ ref: f2.ref, store: st, certificate: o,
    consumed: [{ relation: 'COVERAGE', subject: w.subject, object: w.object, ref: rootRef }] }).entry;
  e.ref = ref;
  return e;
}
// A whole history in ONE origin, so the designated address actually resolves.
function history(relRef, ordRef) {
  const st = store();
  const rel = structuredClone(REL2);
  admit(rel, { authorityStore: st });
  const f = st.admitToken(adapt(rel, { authorityStore: st }).token, { fromCertificate: 'REL' });
  const e1 = journalEntry({ ref: f.ref, store: st, certificate: rel, consumed: [] }).entry;
  e1.ref = relRef;
  const o = structuredClone(ORD2);
  const w = cov(o);
  w.evidence_root = f.ref;
  const f2 = st.admitToken(adapt(o, { authorityStore: st }).token, { fromCertificate: 'ORD' });
  const e2 = journalEntry({ ref: f2.ref, store: st, certificate: o,
    consumed: [{ relation: 'COVERAGE', subject: w.subject, object: w.object, ref: relRef }] }).entry;
  e2.ref = ordRef;
  return [e1, e2];
}
const J = (entries) => ({ entries });
const src = (origin, ...entries) => ({ origin, journal: J(entries) });
const play = (sources, modes) => replayMerged(merge(sources).merged,
  { authorityStore: store(), witnessModes: modes });
const EX = { COVERAGE: MODE.EXISTENTIAL };
const DES = { COVERAGE: MODE.DESIGNATED };
const COMP = { COVERAGE: MODE.COMPLETE };
const shape = (r) => (r.outcomes || []).map((o) => [o.origin, o.ref, o.state, o.minted,
  (o.bound || []).join(','), (o.supply || []).map((s) => s.origin + '/' + s.by).join(',')]
  .join('|')).sort();

test('T0 — the eligibility probe is observationally inert', () => {
  // A trial calls adapt(), which calls derive(), which MINTS. Discarding the token is not by itself
  // proof that nothing was left behind, so this is measured rather than argued.
  const st = store();
  const rel = structuredClone(REL2);
  admit(rel, { authorityStore: st });
  const filed = st.admitToken(adapt(rel, { authorityStore: st }).token, { fromCertificate: 'REL' });
  const before = { size: st.size(), validity: st.validityOf(filed.ref),
    record: JSON.stringify(st.recordOf(filed.ref)) };

  const trial = structuredClone(ORD2);
  cov(trial).evidence_root = filed.ref;
  for (let i = 0; i < 25; i++) {
    const out = adapt(trial, { authorityStore: st });
    assert.deepEqual(out.bound, ['COVERAGE'], 'the probe answers the same way every time');
  }
  assert.equal(st.size(), before.size, 'no store entry was added by 25 trials');
  assert.equal(st.validityOf(filed.ref), before.validity, 'no validity changed');
  assert.equal(JSON.stringify(st.recordOf(filed.ref)), before.record, 'no record changed');

  // and candidate ORDER does not change the admission
  const b = supplier('auth:1:b');
  const elsewhere = supplier('auth:1:c', (x) => {
    x.measurement.observation.context.repository = 'another-repository';
    return x;
  });
  const fwd = play([src('A', consumer('auth:2:a')), src('B', b), src('C', elsewhere)]);
  const rev = play([src('A', consumer('auth:2:a')), src('C', elsewhere), src('B', b)]);
  assert.deepEqual(shape(fwd), shape(rev), 'probing order must not change what is admitted');
});

test('T1 — with no mode declared the default is byte-for-byte what it was', () => {
  // The default is a hybrid nobody named: the designated address within its own origin, else
  // candidates by claim requiring exactly ONE eligible, else refuse.
  const withNothing = play([src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b')),
    src('C', supplier('auth:1:c'))]);
  const withEmpty = play([src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b')),
    src('C', supplier('auth:1:c'))], {});
  assert.deepEqual(shape(withNothing), shape(withEmpty));
  const a = outcomeFor(withNothing, 'A', 'auth:2:a');
  assert.equal(a.minted, false, 'two eligible supports still refuse under the default');
  assert.match(a.why, /MULTIPLE ELIGIBLE SUPPORTS/);
  assert.equal(a.mode, undefined, 'and no mode is invented where none was declared');

  // the other half of the default: a single eligible support DOES satisfy by claim fallback
  const one = outcomeFor(play([src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b'))]),
    'A', 'auth:2:a');
  assert.equal(one.state, STATE.ESTABLISHED);
  assert.equal(one.supply[0].by, 'CLAIM');
});

test('T2 — DESIGNATED is satisfied only by that exact source', () => {
  // positive control first: when the designated address resolves, it satisfies
  const [rel, ord] = history('auth:1:a', 'auth:2:a');
  const ok = outcomeFor(play([src('A', rel, ord)], DES), 'A', 'auth:2:a');
  assert.equal(ok.state, STATE.ESTABLISHED, ok.why);
  assert.equal(ok.supply[0].by, 'REFERENCE');
  assert.equal(ok.supply[0].mode, MODE.DESIGNATED);

  // and now the real arm: a genuinely admissible, genuinely BINDING substitute does not satisfy
  const sub = supplier('auth:1:b');
  const r = play([src('A', consumer('auth:2:a')), src('B', sub)], DES);
  assert.equal(outcomeFor(r, 'B', 'auth:1:b').state, STATE.ESTABLISHED,
    'the substitute is real authority for exactly the same claim');
  const a = outcomeFor(r, 'A', 'auth:2:a');
  assert.equal(a.minted, false);
  assert.equal(a.state, STATE.FRONTIER_OPEN);
  assert.match(a.why, /not satisfied by an equally true substitute/);

  // the same certificate under the default DOES take the substitute - the mode is what differs
  assert.equal(outcomeFor(play([src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b'))]),
    'A', 'auth:2:a').state, STATE.ESTABLISHED);
});

test('T3 — EXISTENTIAL: one binding support satisfies, a second changes nothing', () => {
  const one = outcomeFor(play([src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b'))], EX),
    'A', 'auth:2:a');
  assert.equal(one.state, STATE.ESTABLISHED, one.why);
  assert.equal(one.supply[0].mode, MODE.EXISTENTIAL);
  assert.equal(one.supply[0].completenessBasis, 'NOT_REQUIRED_BY_THIS_MODE');

  const two = outcomeFor(play([src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b')),
    src('C', supplier('auth:1:c'))], EX), 'A', 'auth:2:a');
  assert.equal(two.state, one.state, 'a second agreeing support leaves satisfaction unchanged');
  assert.equal(two.why, one.why);
  assert.deepEqual(two.bound, one.bound);
  assert.deepEqual(two.supply[0].candidates.map((x) => x.origin).sort(), ['B', 'C'],
    'and every eligible support is still named');
  assert.equal(two.supply[0].completenessBasis, 'NOT_REQUIRED_BY_THIS_MODE',
    'the MULTI-candidate branch must not report a completeness basis it never relied on either.'
    + ' Added after a mutant that changed exactly this literal survived every arm');
  assert.equal(two.supply[0].mode, MODE.EXISTENTIAL);

  // a support that cannot bind here is still not support, mode or no mode
  const apparent = outcomeFor(play([src('A', consumer('auth:2:a')),
    src('C', supplier('auth:1:c', (x) => {
      x.measurement.observation.context.repository = 'another-repository';
      return x;
    }))], EX), 'A', 'auth:2:a');
  assert.equal(apparent.minted, false, 'EXISTENTIAL does not lower the binding bar: ' + apparent.why);
});

test('T4 — COMPLETE is expressible and not satisfiable here', () => {
  const r = play([src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b'))], COMP);
  assert.equal(outcomeFor(r, 'B', 'auth:1:b').state, STATE.ESTABLISHED);
  const a = outcomeFor(r, 'A', 'auth:2:a');
  assert.equal(a.minted, false);
  assert.equal(a.state, STATE.FRONTIER_OPEN);
  assert.equal(a.mode, MODE.COMPLETE);
  assert.match(a.why, /A stalled pass shows only that nothing can advance/);
  assert.match(a.why, /replayability itself depends on consumers still being postponed/);

  // even with the designated source present, COMPLETE still refuses: it is not about THIS source
  const [rel, ord] = history('auth:1:a', 'auth:2:a');
  const withRoot = outcomeFor(play([src('A', rel, ord)], COMP), 'A', 'auth:2:a');
  assert.equal(withRoot.state, STATE.ESTABLISHED,
    'a resolvable designated reference is taken before any claim question arises');
});

test('T5 — DESIGNATED and EXISTENTIAL outcomes are order-invariant', () => {
  const deepRoot = supplier('auth:1:root');
  const deep = supplier('auth:1:deep');
  deep.consumed = [{ relation: 'COVERAGE', subject: cov(ORD2).subject, object: cov(ORD2).object,
    ref: 'auth:1:root' }];
  const A = src('A', consumer('auth:2:a')), B = src('B', supplier('auth:1:b')),
    C = src('C', deepRoot, deep);
  for (const modes of [DES, EX]) {
    const base = shape(play([A, B, C], modes));
    for (const order of [[C, B, A], [B, A, C], [A, C, B]]) {
      assert.deepEqual(shape(play(order, modes)), base,
        JSON.stringify(modes) + ' changed with input order ' + order.map((o) => o.origin).join(''));
    }
  }
});

test('T6 — S6 regression, and what a mode does and does not do about it', () => {
  const hidden = supplier('auth:1:c');
  delete hidden.record.claim;                 // establishes the claim; declines to declare it
  const sources = [src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b')),
    src('C', hidden)];

  // UNDER THE DEFAULT the concealment S6 found still happens, unchanged.
  const def = outcomeFor(play(sources), 'A', 'auth:2:a');
  assert.equal(def.minted, true, 'the consumer still commits without seeing the hidden supplier');
  assert.equal(def.supply[0].completenessBasis, 'DECLARED_CLAIMS_OF_PENDING_RECORDS');

  // UNDER EXISTENTIAL the same attack is inert - because the obligation never needed completeness.
  const ex = outcomeFor(play(sources, EX), 'A', 'auth:2:a');
  assert.equal(ex.state, STATE.ESTABLISHED);
  assert.equal(ex.supply[0].completenessBasis, 'NOT_REQUIRED_BY_THIS_MODE');

  // THIS IS A CHANGE OF SEMANTICS, NOT A REPAIR, and here is the proof it is not a repair: when the
  // ONLY supplier hides, EXISTENTIAL is gated by the very same declaration S6 attacked.
  const onlyHidden = [src('A', consumer('auth:2:a')), src('C', hidden)];
  const starved = outcomeFor(play(onlyHidden, EX), 'A', 'auth:2:a');
  assert.equal(starved.minted, false,
    'EXISTENTIAL still relies on the declared hint to find its FIRST support: ' + starved.why);
  const declared = outcomeFor(play([src('A', consumer('auth:2:a')),
    src('C', supplier('auth:1:c'))], EX), 'A', 'auth:2:a');
  assert.equal(declared.state, STATE.ESTABLISHED,
    'the identical record, declaring its claim, is found. The hint still gates termination');
});

test('T7 — a certificate cannot declare its own requirement mode', () => {
  // BOTH producer-side surfaces, because a mutant reading only one of them survived the first
  // version of this arm: the certificate's own witness, and the journal's consumed entry.
  const sources = () => {
    const a = consumer('auth:2:a', 'auth:9:gone', (c) => {
      for (const w of c.derivation.alternatives[0].relation_witnesses) {
        w.requirement_mode = 'EXISTENTIAL';      // the producer trying to choose its own burden
      }
      return c;
    });
    for (const c of a.consumed) c.requirement_mode = 'EXISTENTIAL';
    return [src('A', a), src('B', supplier('auth:1:b')), src('C', supplier('auth:1:c'))];
  };

  const claimed = outcomeFor(play(sources()), 'A', 'auth:2:a');
  const plain = outcomeFor(play([src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b')),
    src('C', supplier('auth:1:c'))]), 'A', 'auth:2:a');
  assert.equal(claimed.state, plain.state, 'the declared mode changed nothing');
  assert.equal(claimed.minted, false);
  assert.match(claimed.why, /MULTIPLE ELIGIBLE SUPPORTS/);

  // and the runtime policy, which is the only thing that governs, does change it
  assert.equal(outcomeFor(play(sources(), EX), 'A', 'auth:2:a').state, STATE.ESTABLISHED);
});

test('T8 — EXISTENTIAL adds no scope, currency or strength', () => {
  const one = outcomeFor(play([src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b'))], EX),
    'A', 'auth:2:a');
  const two = outcomeFor(play([src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b')),
    src('C', supplier('auth:1:c'))], EX), 'A', 'auth:2:a');
  assert.equal(one.why, two.why);
  assert.deepEqual(one.bound, two.bound);
  assert.equal(one.state, two.state);
  assert.equal(/corroborat|confidence|strength|weight|score/i.test(JSON.stringify([one, two])),
    false, 'no notion of how well supported the claim is appears anywhere');
  assert.equal(NEED, one.supply[0].claim, 'and the claim itself is unchanged by the second support');
});
