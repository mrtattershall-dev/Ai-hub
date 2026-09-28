// A1..A6 — can the system prevent the party seeking admission from choosing its burden of proof?
//
// Predictions frozen in MODE-AUTHORIZATION_PREREG.md. Position taken there, explicitly: for
// anything reaching admission, the runtime enforces an independently fixed obligation, and a
// caller's ask is recorded but never authorizing.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { adapt } from './adapter.mjs';
import { admit, STATE } from './admission.mjs';
import { store, relationClaim } from './authority-store.mjs';
import { journalEntry } from './replay.mjs';
import { merge, replayMerged, outcomeFor, sameObligationContract, MODE } from './merge.mjs';

const load = (n) => JSON.parse(readFileSync(new URL('./natural/' + n + '.json', import.meta.url), 'utf8'));
const REL2 = load('REL2'), ORD2 = load('ORD2');
const cov = (c) => c.derivation.alternatives[0].relation_witnesses.find((w) => w.relation === 'COVERAGE');

function supplier(ref) {
  const st = store();
  const c = structuredClone(REL2);
  admit(c, { authorityStore: st });
  const filed = st.admitToken(adapt(c, { authorityStore: st }).token, { fromCertificate: 'REL' });
  const e = journalEntry({ ref: filed.ref, store: st, certificate: c, consumed: [] }).entry;
  e.ref = ref;
  return e;
}
function consumer(ref, rootRef = 'auth:9:gone') {
  const st = store();
  const rel = structuredClone(REL2);
  admit(rel, { authorityStore: st });
  const filed = st.admitToken(adapt(rel, { authorityStore: st }).token, { fromCertificate: 'seed' });
  const o = structuredClone(ORD2);
  const w = cov(o);
  w.evidence_root = filed.ref;
  const f2 = st.admitToken(adapt(o, { authorityStore: st }).token, { fromCertificate: 'ORD' });
  const e = journalEntry({ ref: f2.ref, store: st, certificate: o,
    consumed: [{ relation: 'COVERAGE', subject: w.subject, object: w.object, ref: rootRef }] }).entry;
  e.ref = ref;
  return e;
}
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
const play = (sources, opts = {}) => replayMerged(merge(sources).merged,
  { authorityStore: store(), ...opts });
const GOVERN_DESIGNATED = { witnessModes: { COVERAGE: MODE.DESIGNATED }, obligationContractId: 'D' };

test('A1 — a caller cannot turn DESIGNATED into EXISTENTIAL by asking', () => {
  const sources = [src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b'))];
  const asked = play(sources, { ...GOVERN_DESIGNATED,
    requestedModes: { COVERAGE: MODE.EXISTENTIAL } });
  const a = outcomeFor(asked, 'A', 'auth:2:a');

  assert.equal(outcomeFor(asked, 'B', 'auth:1:b').state, STATE.ESTABLISHED,
    'the substitute is real authority for exactly the claim the witness needs');
  assert.equal(a.minted, false, 'and it still cannot satisfy a designated obligation: ' + a.why);
  assert.equal(a.state, STATE.FRONTIER_OPEN);
  assert.equal(a.obligation.mode, MODE.DESIGNATED, 'the GOVERNING mode is what was enforced');
  assert.equal(a.obligation.requested, MODE.EXISTENTIAL);
  assert.equal(a.obligation.requestAccepted, false);
  assert.match(a.why, /does not choose which burden applies/);
  assert.match(a.why, /request for EXISTENTIAL was recorded and REFUSED/);

  // WHAT IS IDENTICAL, NAMED EXACTLY. "The request is refused" and "asking is identical to not
  // asking" cannot both describe the WHOLE outcome, because the request metadata differs. The
  // identical projection is the ADMISSION projection - state, minting, binding, supply - and the
  // difference is confined to the recorded request.
  const plain = outcomeFor(play(sources, GOVERN_DESIGNATED), 'A', 'auth:2:a');
  const admission = (o) => ({ state: o.state, minted: o.minted, bound: o.bound || [],
    supply: (o.supply || []).map((x) => x.origin + '/' + x.ref + '/' + x.by),
    mode: o.obligation.mode });
  assert.deepEqual(admission(a), admission(plain),
    'the ADMISSION projection is identical whether or not a request was made');
  assert.notDeepEqual(a.obligation, plain.obligation,
    'and the obligation record is NOT identical: the request is documented, which is the point');
  assert.equal(plain.obligation.requested, null);

  // REJECTING THE REQUEST IS NOT REJECTING THE ADMISSION. Here both happen, for different reasons,
  // so the two are shown to be independent: a request is refused while an admission succeeds.
  const succeeds = outcomeFor(play([src('A', ...history('auth:1:a', 'auth:2:a'))],
    { ...GOVERN_DESIGNATED, requestedModes: { COVERAGE: MODE.EXISTENTIAL } }), 'A', 'auth:2:a');
  assert.equal(succeeds.state, STATE.ESTABLISHED, 'the admission succeeds');
  assert.equal(succeeds.supply[0].obligation.requestAccepted, false,
    'while the request to change the burden was still refused');
  assert.equal(succeeds.supply[0].obligation.mode, MODE.DESIGNATED);
});

test('A2 — omitting the request cannot inherit a weaker default', () => {
  const sources = [src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b'))];
  const silent = outcomeFor(play(sources, GOVERN_DESIGNATED), 'A', 'auth:2:a');
  assert.equal(silent.obligation.mode, MODE.DESIGNATED);
  assert.equal(silent.obligation.requested, null, 'nothing was asked');
  assert.equal(silent.obligation.requestAccepted, null,
    'and "no request" is not the same value as "request refused"');
  assert.equal(silent.minted, false, 'silence does not fall back to the unnamed default');

  // the control that makes this arm mean something: WITHOUT governance the same journal succeeds
  const ungoverned = outcomeFor(play(sources), 'A', 'auth:2:a');
  assert.equal(ungoverned.state, STATE.ESTABLISHED,
    'so the refusal above is the obligation doing work, not the fixture being unsatisfiable');
  assert.equal(ungoverned.supply[0].obligation.governedBy, 'DEFAULT');
});

test('A3 — a replay under a different governing obligation is not a reproduction', () => {
  const sources = [src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b'))];
  const first = play(sources, { witnessModes: { COVERAGE: MODE.EXISTENTIAL },
    obligationContractId: 'E' });
  const again = play(sources, { witnessModes: { COVERAGE: MODE.EXISTENTIAL },
    obligationContractId: 'E' });
  const other = play(sources, GOVERN_DESIGNATED);

  assert.equal(sameObligationContract(first, again), true, 'same contract, genuinely reproduced');
  assert.equal(sameObligationContract(first, other), false,
    'a different governing obligation is a different contract, whatever the outcomes look like');
  assert.notEqual(first.obligationContract.fingerprint, other.obligationContract.fingerprint);

  // THE DANGEROUS CASE: outcomes that LOOK the same under different contracts.
  const looksSame = play([src('A', ...history('auth:1:a', 'auth:2:a'))], GOVERN_DESIGNATED);
  const looksSame2 = play([src('A', ...history('auth:1:a', 'auth:2:a'))],
    { witnessModes: { COVERAGE: MODE.EXISTENTIAL }, obligationContractId: 'E' });
  assert.equal(outcomeFor(looksSame, 'A', 'auth:2:a').state, STATE.ESTABLISHED);
  assert.equal(outcomeFor(looksSame2, 'A', 'auth:2:a').state, STATE.ESTABLISHED);
  assert.equal(sameObligationContract(looksSame, looksSame2), false,
    'identical states under different obligations must not be presentable as the same admission');
  assert.notEqual(outcomeFor(looksSame, 'A', 'auth:2:a').supply[0].obligation.mode,
    outcomeFor(looksSame2, 'A', 'auth:2:a').supply[0].obligation.mode);
});

test('A4 — matching claim strings do not collapse different governing obligations', () => {
  // Two consumers needing the SAME claim, governed differently. Keyed by (origin, ref), which is
  // merger-assigned - a consumer cannot name its own key.
  const sources = [src('A', consumer('auth:2:a')), src('D', consumer('auth:2:d')),
    src('B', supplier('auth:1:b'))];
  const r = play(sources, { governingByRecord: { '["A","auth:2:a"]': MODE.DESIGNATED,
    '["D","auth:2:d"]': MODE.EXISTENTIAL }, obligationContractId: 'MIXED' });

  const a = outcomeFor(r, 'A', 'auth:2:a'), d = outcomeFor(r, 'D', 'auth:2:d');
  assert.equal(a.obligation.mode, MODE.DESIGNATED);
  assert.equal(a.minted, false, 'the designated consumer is not satisfied by the substitute');
  assert.equal(d.supply[0].obligation.mode, MODE.EXISTENTIAL);
  assert.equal(d.state, STATE.ESTABLISHED, 'the existential one is: ' + d.why);
  assert.equal(a.obligation.governedBy, 'GOVERNING_BY_RECORD');
  assert.equal(d.supply[0].obligation.governedBy, 'GOVERNING_BY_RECORD');
});

test('A5 — every admission path carries the obligation it enforced', () => {
  // three paths: the REFERENCE path, the single-candidate CLAIM path, the multi-candidate branch
  const byReference = outcomeFor(play([src('A', ...history('auth:1:a', 'auth:2:a'))],
    { witnessModes: { COVERAGE: MODE.DESIGNATED }, obligationContractId: 'D' }), 'A', 'auth:2:a');
  assert.equal(byReference.supply[0].by, 'REFERENCE');
  assert.equal(byReference.supply[0].obligation.mode, MODE.DESIGNATED);
  assert.equal(byReference.supply[0].obligation.governedBy, 'GOVERNING_BY_RELATION');

  const oneCandidate = outcomeFor(play([src('A', consumer('auth:2:a')), src('B', supplier('auth:1:b'))],
    { witnessModes: { COVERAGE: MODE.EXISTENTIAL } }), 'A', 'auth:2:a');
  assert.equal(oneCandidate.supply[0].by, 'CLAIM');
  assert.equal(oneCandidate.supply[0].obligation.mode, MODE.EXISTENTIAL);

  const manyCandidates = outcomeFor(play([src('A', consumer('auth:2:a')),
    src('B', supplier('auth:1:b')), src('C', supplier('auth:1:c'))],
  { witnessModes: { COVERAGE: MODE.EXISTENTIAL } }), 'A', 'auth:2:a');
  assert.equal(manyCandidates.supply[0].obligation.mode, MODE.EXISTENTIAL);

  // and the refusing paths too
  const refusedMany = outcomeFor(play([src('A', consumer('auth:2:a')),
    src('B', supplier('auth:1:b')), src('C', supplier('auth:1:c'))]), 'A', 'auth:2:a');
  assert.equal(refusedMany.obligation.governedBy, 'DEFAULT');
  assert.equal(refusedMany.obligation.mode, null, 'the default is not a mode and is not named one');
  const refusedComplete = outcomeFor(play([src('A', consumer('auth:2:a')),
    src('B', supplier('auth:1:b'))], { witnessModes: { COVERAGE: MODE.COMPLETE } }),
  'A', 'auth:2:a');
  assert.equal(refusedComplete.obligation.mode, MODE.COMPLETE);
});

test('A6 — the stable order is stable only if the coordinates are: a demonstrated hazard', () => {
  const b = supplier('auth:1:b'), c = supplier('auth:1:c');
  const EX = { witnessModes: { COVERAGE: MODE.EXISTENTIAL } };
  // The RECORD chosen, not the label naming it. The first version of this arm compared
  // supply[0].origin and got 'origin-0' both times - the label was stable while the record it
  // named had moved. Tenth wrong-referent instance, and the one that makes the hazard sharpest:
  // a position-derived label conceals the movement it causes.
  const sup = (sources) => outcomeFor(play(sources, EX), 'A', 'auth:2:a').supply[0];
  const chosen = (sources) => { const s2 = sup(sources); return s2.origin + '/' + s2.ref; };

  // hand-labelled origins: stable under permutation, which is what T5 fixed
  const A = src('A', consumer('auth:2:a'));
  assert.equal(chosen([A, src('B', b), src('C', c)]), chosen([A, src('C', c), src('B', b)]),
    'with stable labels the chosen support does not move');

  // POSITION-DERIVED ORIGINS, the hazard: origins are MERGER-ASSIGNED, so a caller that labels by
  // input position reintroduces exactly the provenance dependence T5 removed, under new labels.
  const byPosition = (entries) => entries.map((e, i) => src('origin-' + i, e));
  const fwd = sup([A, ...byPosition([b, c])]), rev = sup([A, ...byPosition([c, b])]);
  assert.notEqual(fwd.origin + '/' + fwd.ref, rev.origin + '/' + rev.ref,
    'DEMONSTRATED: position-derived origins make the chosen support move with input order again');
  assert.equal(fwd.origin, rev.origin,
    'and the ORIGIN LABEL is identical both times, so the movement is invisible in the label alone');
  assert.notEqual(fwd.ref, rev.ref, 'while the record it names is a different one');
  // recorded as a hazard of origin ASSIGNMENT, not repaired here: the merger owns that choice, and
  // nothing in this contract constrains it. See MODE-AUTHORIZATION_RESULT.md.
});
