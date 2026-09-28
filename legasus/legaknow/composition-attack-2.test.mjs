// r4 — composition wave 2, justification graph. Predictions were frozen in
// benchmarks/COMPOSITION_PREREG_2.md (W2-a, W2-b); the PRE-REPAIR run that reproduced both is preserved
// in benchmarks/RESULT.composition-2.md and at b0673cd, where this file asserted the defects. It now
// asserts the repairs and keeps every control.
import test from 'node:test';
import assert from 'node:assert';
import { graph, add, node, entitled, reestablish, invalidate, scope, NODE, EDGE, ANY, VALIDITY }
  from './justification.mjs';

const S = (repository) => scope({ repository });

const refuted = (claimRepo, refuterRepo) => {
  const g = graph();
  const c = node({ kind: NODE.CLAIM, proposition: 'P holds', scope: S(claimRepo), basis: 'W' });
  const r = node({ kind: NODE.OBSERVATION, proposition: 'a counterexample ran', scope: S(refuterRepo),
    basis: 'EXECUTION_WITNESS', supports: [{ id: c.id, edge: EDGE.REFUTES }] });
  add(g, c); add(g, r);
  return entitled(g, c.id, S(claimRepo));
};

test('W2-a-1 REGRESSION — a refuter established at S2 does NOT refute a claim about S1', () => {
  const e = refuted('S1', 'S2');
  assert.equal(e.ok, true, 'b0673cd refuted this across worlds: ' + JSON.stringify(e.problems));
});

test('W2-a-2 CONTROL — a refuter in the SAME world refutes', () => {
  const e = refuted('S1', 'S1');
  assert.equal(e.ok, false);
  assert.ok(e.problems.some((p) => /REFUTED by/.test(p.why)));
});

test('W2-a-3 CONTROL — a for-all refuter refutes a claim about any world', () => {
  const e = refuted('S1', ANY);
  assert.equal(e.ok, false);
  assert.ok(e.problems.some((p) => /REFUTED by/.test(p.why)));
});

test('W2-a-4 — a refuter established nowhere in particular refutes nothing; an invalidated one still refutes nothing', () => {
  assert.equal(refuted('S1', null).ok, true);
  const g = graph();
  const c = node({ kind: NODE.CLAIM, proposition: 'P holds', scope: S('S1'), basis: 'W' });
  const r = node({ kind: NODE.OBSERVATION, proposition: 'a counterexample ran', scope: S('S1'),
    basis: 'EXECUTION_WITNESS', supports: [{ id: c.id, edge: EDGE.REFUTES }] });
  add(g, c); add(g, r);
  assert.equal(entitled(g, c.id, S('S1')).ok, false);
  invalidate(g, r.id, 'the counterexample ran against the wrong copy');
  assert.equal(entitled(g, c.id, S('S1')).ok, true);
});

test('W2-b-1 REGRESSION — reestablish() REFUSES to move the scope under an identity that encodes it', () => {
  const g = graph();
  const p = node({ kind: NODE.CLAIM, proposition: 'P', scope: S('S1'), basis: 'X' });
  add(g, p);
  const r = reestablish(g, p.id, { evidence: ['w2'], scope: S('S2') });
  assert.equal(r.rejected, true, 'b0673cd moved the scope in place');
  assert.match(r.why, /different claim/);
  assert.equal(g.nodes[p.id].scope.repository, 'S1');
  assert.equal(g.nodes[p.id].validity, VALIDITY.ESTABLISHED, 'a refusal changes nothing');
});

test('W2-b-2 CONTROL — reestablish() with evidence, or with the SAME scope, still works', () => {
  const g = graph();
  const p = node({ kind: NODE.CLAIM, proposition: 'P', scope: S('S1'), basis: 'X' });
  add(g, p);
  invalidate(g, p.id, 'x');
  const r = reestablish(g, p.id, { evidence: ['w2'], scope: S('S1') });
  assert.equal(r.rejected, undefined);
  assert.equal(g.nodes[p.id].validity, VALIDITY.ESTABLISHED);
  assert.deepEqual(g.nodes[p.id].evidence, ['w2']);
});
