// THE JUSTIFICATION GRAPH — controls on the invariant everything else turns out to be a special case of.
//
// The one that matters most is the ASYMMETRY. A truth-maintenance system that can restore its own
// conclusions has replaced re-testing with reasoning, and will eventually be confidently wrong for a
// month with nothing reporting it.
import test from 'node:test';
import assert from 'node:assert';
import { graph, add, node, invalidate, reestablish, entitled, widen, covers, scope, standing,
  NODE, VALIDITY, GENERALIZATION, EDGE, ANY } from './justification.mjs';

// The real ancestry of one verified capability, as this project actually produces it.
function builtGraph() {
  const g = graph();
  const sc = scope({ repository: 'S42', environment: 'win|py3.13',
    invocation: 'W17', implementation: 'fp:3f7c6e9d' });

  const corpus = node({ kind: NODE.ASSUMPTION, proposition: 'the corpus under test is the one imported',
    scope: sc, basis: 'ROOT_FILTER' });
  const tracer = node({ kind: NODE.ASSUMPTION,
    proposition: 'instrumentation does not change semantics', scope: sc, basis: 'CONTROL' });
  const siteId = node({ kind: NODE.INTERPRETATION, proposition: 'site identity is computed correctly',
    scope: sc, basis: 'FINGERPRINT', supports: [corpus.id] });
  const witness = node({ kind: NODE.OBSERVATION, proposition: 'site X executed',
    scope: sc, basis: 'EXECUTION_WITNESS', supports: [siteId.id, tracer.id] });
  const assertion = node({ kind: NODE.INTERPRETATION, proposition: 'the documented assertion held',
    scope: sc, basis: 'DOCTEST', supports: [witness.id] });
  const capability = node({ kind: NODE.CLAIM, proposition: 'capability C is verified',
    scope: sc, basis: 'PROGRESS', supports: [assertion.id] });
  for (const n of [corpus, tracer, siteId, witness, assertion, capability]) add(g, n);
  return { g, sc, ids: { corpus, tracer, siteId, witness, assertion, capability } };
}

test('ENTITLEMENT is traced to the leaves, and can be granted', () => {
  const { g, sc, ids } = builtGraph();
  const e = entitled(g, ids.capability.id, sc);
  assert.equal(e.ok, true, JSON.stringify(e.problems));
  assert.ok(e.path.includes('site identity is computed correctly'),
    'the whole ancestry is walked, not just the immediate support');
});

test('SCOPE INFLATION is refused — the same claim at a broader scope is NOT entitled', () => {
  const { g, sc, ids } = builtGraph();
  const other = { ...sc, environment: 'linux|py3.12' };
  const e = entitled(g, ids.capability.id, other);
  assert.equal(e.ok, false);
  assert.ok(e.problems.some((p) => /SCOPE INFLATION/.test(p.why)), JSON.stringify(e.problems));
  // and the specific axis must be named, or the refusal is not actionable
  assert.ok(e.problems.some((p) => /environment/.test(p.why)));
});

test('"observed once therefore works" is mechanically impossible', () => {
  const g = graph();
  const w5 = node({ kind: NODE.OBSERVATION, proposition: 'f(5) behaved',
    scope: scope({ invocation: '5' }), basis: 'EXECUTION_WITNESS' });
  add(g, w5);
  // Asking about a different input is asking about something never established.
  assert.equal(entitled(g, w5.id, scope({ invocation: '7' })).ok, false);
  assert.equal(entitled(g, w5.id, scope({ invocation: '5' })).ok, true);
  // And ANY is not reachable by accumulating point observations.
  assert.equal(entitled(g, w5.id, scope({ invocation: ANY })).ok, false);
});

test('WIDENING A QUANTIFIER IS ITSELF A CLAIM and needs its own authority', () => {
  const g = graph();
  const w = node({ kind: NODE.OBSERVATION, proposition: 'f behaved',
    scope: scope({ invocation: '5', repository: 'S42' }), basis: 'EXECUTION_WITNESS' });
  add(g, w);

  const bare = widen(g, w.id, { dimension: 'invocation', to: ANY, via: 'BECAUSE_I_SAW_IT' });
  assert.equal(bare.rejected, true);
  assert.match(bare.why, /SCOPE INFLATION/);

  const unevidenced = widen(g, w.id, { dimension: 'invocation', to: ANY,
    via: GENERALIZATION.EXHAUSTIVE, evidence: [] });
  assert.equal(unevidenced.rejected, true, 'an exhaustive claim must carry the enumeration');

  // POSITIVE CONTROL: a properly authorised widening produces a NEW claim that IS entitled at the wider
  // scope - and still depends on the observation, so invalidating that observation kills it.
  const ok = widen(g, w.id, { dimension: 'invocation', to: ANY, via: GENERALIZATION.PROOF,
    evidence: ['monotonicity argument over the integers'] });
  assert.equal(ok.rejected, undefined);
  assert.equal(entitled(g, ok.id, scope({ invocation: '9999', repository: 'S42' })).ok, true);
  invalidate(g, w.id, 'the observation was of the wrong process');
  assert.equal(entitled(g, ok.id, scope({ invocation: '9999', repository: 'S42' })).ok, false,
    'a generalization inherits the fate of what it generalized');
});

test('INVALIDATION PROPAGATES — fixing the site-identity bug invalidates everything above it', () => {
  const { g, sc, ids } = builtGraph();
  const { touched } = invalidate(g, ids.siteId.id, 'site identity was computed on (module, line)');
  assert.ok(touched.includes(ids.witness.id));
  assert.ok(touched.includes(ids.assertion.id));
  assert.ok(touched.includes(ids.capability.id));
  assert.equal(g.nodes[ids.capability.id].validity, VALIDITY.UNESTABLISHED);
  assert.equal(entitled(g, ids.capability.id, sc).ok, false);
  // The unrelated assumption is untouched: propagation follows justification, not proximity.
  assert.equal(g.nodes[ids.tracer.id].validity, VALIDITY.ESTABLISHED);
});

test('THE ASYMMETRY — revalidation does NOT propagate, and that is the whole point', () => {
  const { g, sc, ids } = builtGraph();
  invalidate(g, ids.siteId.id, 'site identity was computed on (module, line)');
  reestablish(g, ids.siteId.id, { evidence: ['fingerprinted identity, 6 controls'] });

  assert.equal(g.nodes[ids.siteId.id].validity, VALIDITY.ESTABLISHED);
  assert.equal(g.nodes[ids.capability.id].validity, VALIDITY.UNESTABLISHED,
    'repairing the ground must NOT silently restore the conclusion built on it');
  assert.equal(entitled(g, ids.capability.id, sc).ok, false);

  // The conclusion returns only by being re-derived itself - which means re-running the thing that
  // established it. That cost is the mechanism, not an inefficiency.
  reestablish(g, ids.witness.id, { evidence: ['re-traced'] });
  assert.equal(entitled(g, ids.capability.id, sc).ok, false, 'still not, the assertion has not re-run');
  reestablish(g, ids.assertion.id, { evidence: ['re-asserted'] });
  reestablish(g, ids.capability.id, { evidence: ['re-derived'] });
  assert.equal(entitled(g, ids.capability.id, sc).ok, true);
});

test('ONE BROKEN ANCESTOR ANYWHERE kills entitlement, however deep', () => {
  const { g, sc, ids } = builtGraph();
  invalidate(g, ids.corpus.id, 'the witness observed the INSTALLED package');
  const e = entitled(g, ids.capability.id, sc);
  assert.equal(e.ok, false);
  assert.ok(e.problems.some((p) => /INSTALLED package/.test(p.why)),
    'and the report must name the actual root cause, four levels down: ' + JSON.stringify(e.problems));
});

test('covers() treats a never-established dimension as licensing NOTHING', () => {
  assert.equal(covers(scope({ repository: 'S1' }), scope({ repository: 'S1' })).ok, true);
  assert.equal(covers(scope({ repository: 'S1' }), scope({ environment: 'win' })).ok, false,
    'silence about a dimension is not permission over it');
  assert.equal(covers(scope({ environment: ANY }), scope({ environment: 'anything' })).ok, true);
  // A consumer that does not care about an axis is not inflating anything by ignoring it.
  assert.equal(covers(scope({ repository: 'S1' }), scope({})).ok, true);
});

test('standing() reports what the system is currently entitled to, not what it once concluded', () => {
  const { g, ids } = builtGraph();
  assert.deepEqual(standing(g), { ESTABLISHED: 6, UNESTABLISHED: 0, INVALID: 0 });
  invalidate(g, ids.siteId.id, 'x');
  const s = standing(g);
  assert.equal(s.INVALID, 1);
  assert.equal(s.UNESTABLISHED, 3);
  assert.equal(s.ESTABLISHED, 2);
});

// ---------------------------------------------------------------------------------------------------
// TYPED EDGES. The node-and-edge syntax proves nothing by itself; the obligations are the content.

test('REFUTES destroys entitlement even when the justification below is intact', () => {
  const { g, sc, ids } = builtGraph();
  assert.equal(entitled(g, ids.capability.id, sc).ok, true);
  const counter = node({ kind: NODE.OBSERVATION, proposition: 'a counterexample was executed',
    scope: sc, basis: 'EXECUTION_WITNESS', supports: [{ id: ids.capability.id, edge: EDGE.REFUTES }] });
  add(g, counter);
  const e = entitled(g, ids.capability.id, sc);
  assert.equal(e.ok, false);
  assert.ok(e.problems.some((p) => /REFUTED by/.test(p.why)), JSON.stringify(e.problems));
  // A refuter that is itself not established refutes nothing.
  invalidate(g, counter.id, 'the counterexample ran against the wrong copy');
  assert.equal(entitled(g, ids.capability.id, sc).ok, true);
});

test('IDENTIFIES carries the NON-ALIASING obligation: an unpinned identity is a name', () => {
  const g = graph();
  const target = node({ kind: NODE.OBSERVATION, proposition: 'the site executed',
    scope: scope({ repository: 'S1', implementation: 'fp:abc' }), basis: 'EXECUTION_WITNESS' });
  add(g, target);
  const unpinned = node({ kind: NODE.INTERPRETATION, proposition: 'that site is canonicalize_name',
    scope: scope({ repository: 'S1' }), basis: 'NAME',
    supports: [{ id: target.id, edge: EDGE.IDENTIFIES }] });
  add(g, unpinned);
  const e = entitled(g, unpinned.id, scope({ repository: 'S1' }));
  assert.equal(e.ok, false);
  assert.ok(e.problems.some((p) => /that is a name, not an identity/.test(p.why)),
    JSON.stringify(e.problems));

  // POSITIVE CONTROL: pin the implementation and the same edge is fine.
  const pinned = node({ kind: NODE.INTERPRETATION, proposition: 'that site is canonicalize_name#abc',
    scope: scope({ repository: 'S1', implementation: 'fp:abc' }), basis: 'FINGERPRINT',
    supports: [{ id: target.id, edge: EDGE.IDENTIFIES }] });
  add(g, pinned);
  assert.equal(entitled(g, pinned.id, scope({ repository: 'S1' })).ok, true);
});

test('THERE IS NO INVERSE OPERATION — nothing in the API walks upward turning red nodes green', async () => {
  // Downward invalidity may propagate by dependency. Upward validity requires fresh evidence. If any
  // export could restore dependents, the graph would have become an oracle over its own conclusions.
  const mod = await import('./justification.mjs');
  const suspicious = Object.keys(mod).filter((k) =>
    /propagateValid|restoreAll|revalidateTree|cascadeValid|greenify/i.test(k));
  assert.deepEqual(suspicious, []);
  // And behaviourally: reestablish touches exactly one node, proven by counting.
  const { g, ids } = builtGraph();
  invalidate(g, ids.corpus.id, 'x');
  const before = standing(g);
  reestablish(g, ids.corpus.id, { evidence: ['re-checked'] });
  const after = standing(g);
  assert.equal(after.ESTABLISHED, before.ESTABLISHED + 1, 'exactly one node changed colour');
});

// ---------------------------------------------------------------------------------------------------
// ALGEBRA v2 — ALTERNATIVE justification. Added AFTER the shadow-graph experiment localised the gap, so
// it carries the heaviest burden of proof in this file: it must admit a claim with one surviving
// justification while refusing one with none, or it is a universal escape hatch.

function alts() {
  const g = graph();
  const sc = scope({ repository: 'S1', implementation: 'fp:x' });
  const j1 = node({ kind: NODE.OBSERVATION, proposition: 'execution A reached it', scope: sc,
    basis: 'EXECUTION_WITNESS' });
  const j2 = node({ kind: NODE.OBSERVATION, proposition: 'execution B reached it', scope: sc,
    basis: 'EXECUTION_WITNESS' });
  add(g, j1); add(g, j2);
  const claim = node({ kind: NODE.CLAIM, proposition: 'the site is in the region', scope: sc,
    basis: 'CONNECTIVITY',
    supports: [{ id: j1.id, edge: EDGE.ANY_OF }, { id: j2.id, edge: EDGE.ANY_OF }] });
  add(g, claim);
  return { g, sc, j1, j2, claim };
}

test('ANY_OF — one surviving justification is enough, and ZERO is a refusal', () => {
  const { g, sc, j1, j2, claim } = alts();
  assert.equal(entitled(g, claim.id, sc).ok, true);
  invalidate(g, j1.id, 'execution A observed the wrong copy');
  assert.equal(entitled(g, claim.id, sc).ok, true, 'B still justifies it');
  invalidate(g, j2.id, 'execution B observed the wrong copy');
  const e = entitled(g, claim.id, sc);
  assert.equal(e.ok, false, 'with no surviving alternative it must REFUSE, or ANY_OF is an escape hatch');
  assert.ok(e.problems.some((p) => /no surviving alternative/.test(p.why)), JSON.stringify(e.problems));
});

test('INVALIDATION does not propagate through ANY_OF while an alternative survives', () => {
  const { g, j1, j2, claim } = alts();
  invalidate(g, j1.id, 'A was wrong');
  assert.equal(g.nodes[claim.id].validity, VALIDITY.ESTABLISHED,
    'losing one of two independent justifications does not unmake the claim');
  invalidate(g, j2.id, 'B was wrong too');
  assert.equal(g.nodes[claim.id].validity, VALIDITY.UNESTABLISHED,
    'losing the LAST one does');
});

test('CIRCULAR JUSTIFICATION IS NOT JUSTIFICATION', () => {
  // Two claims that justify each other and nothing else. A walk that treated a node already on its own
  // path as established would let a cycle bootstrap itself into entitlement.
  const g = graph();
  const sc = scope({ repository: 'S1' });
  const a = node({ kind: NODE.CLAIM, proposition: 'A', scope: sc, basis: 'X' });
  add(g, a);
  const b = node({ kind: NODE.CLAIM, proposition: 'B', scope: sc, basis: 'X',
    supports: [{ id: a.id, edge: EDGE.SUPPORTS }] });
  add(g, b);
  // close the loop by hand: A now rests on B
  g.nodes[a.id].supports = [{ id: b.id, edge: EDGE.SUPPORTS }];
  g.dependents[b.id] = [a.id];
  const e = entitled(g, a.id, sc);
  assert.equal(e.ok, false);
  assert.ok(e.problems.some((p) => /CIRCULAR JUSTIFICATION/.test(p.why)), JSON.stringify(e.problems));
});
