// r4 — composition wave 2, justification graph. Predictions frozen in benchmarks/COMPOSITION_PREREG_2.md
// (W2-a, W2-b) BEFORE this file existed. Assertions state the PREDICTED DEFECT; controls beside them.
import test from 'node:test';
import assert from 'node:assert';
import { graph, add, node, entitled, reestablish, scope, NODE, EDGE, ANY } from './justification.mjs';

const S = (repository) => scope({ repository });

const refuted = (claimRepo, refuterRepo) => {
  const g = graph();
  const c = node({ kind: NODE.CLAIM, proposition: 'P holds', scope: S(claimRepo), basis: 'W' });
  const r = node({ kind: NODE.OBSERVATION, proposition: 'a counterexample ran', scope: S(refuterRepo),
    basis: 'EXECUTION_WITNESS', supports: [{ id: c.id, edge: EDGE.REFUTES }] });
  add(g, c); add(g, r);
  return entitled(g, c.id, S(claimRepo));
};

test('W2-a-1 ATTACK — a refuter established at S2 refutes a claim about S1', () => {
  const e = refuted('S1', 'S2');
  // PREDICTED DEFECT: refuted across worlds, no bridge.
  assert.equal(e.ok, false, 'prediction W2-a-1: refuted');
  assert.ok(e.problems.some((p) => /REFUTED by/.test(p.why)), JSON.stringify(e.problems));
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

test('W2-b-1 ATTACK — reestablish() moves the scope under an identity that encodes the old one', () => {
  const g = graph();
  const p = node({ kind: NODE.CLAIM, proposition: 'P', scope: S('S1'), basis: 'X' });
  add(g, p);
  const before = p.id;
  const r = reestablish(g, p.id, { evidence: ['w2'], scope: S('S2') });
  // PREDICTED DEFECT: the node now says S2 while its id is the one computed for S1.
  assert.equal(g.nodes[before].scope.repository, 'S2', 'prediction W2-b-1: scope moved in place');
  assert.equal(r.id, before);
});

test('W2-b-2 CONTROL — reestablish() with evidence only keeps the scope and the identity', () => {
  const g = graph();
  const p = node({ kind: NODE.CLAIM, proposition: 'P', scope: S('S1'), basis: 'X' });
  add(g, p);
  reestablish(g, p.id, { evidence: ['w2'] });
  assert.equal(g.nodes[p.id].scope.repository, 'S1');
  assert.deepEqual(g.nodes[p.id].evidence, ['w2']);
});
