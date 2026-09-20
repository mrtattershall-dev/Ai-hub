// r4 — ATTACK on authority under composition in the justification graph. Predictions frozen in
// benchmarks/COMPOSITION_PREREG.md (C1, C7) BEFORE this file existed.
//
// These tests assert the PREDICTED DEFECT. If a prediction fails, the hypothesis is falsified and that
// is recorded; if it holds, the test is flipped to a regression in a later, separate commit. Every
// attack sits beside a control that a refusal machine could not pass.
import test from 'node:test';
import assert from 'node:assert';
import { graph, add, node, entitled, scope, NODE, VALIDITY } from './justification.mjs';

const S = (repository) => scope({ repository });

// ------------------------------------------------------------------ C1: the null intermediate

test('C1-a ATTACK — A@S1 -> D1@null -> D2@S2 is ENTITLED for a consumer that does not pin repository', () => {
  const g = graph();
  const a = node({ kind: NODE.OBSERVATION, proposition: 'A observed', scope: S('S1'),
    basis: 'EXECUTION_WITNESS' });
  const d1 = node({ kind: NODE.INTERPRETATION, proposition: 'D1 (restriction of A)', scope: S(null),
    basis: 'DERIVATION', supports: [a.id] });
  const d2 = node({ kind: NODE.CLAIM, proposition: 'D2 stated for S2', scope: S('S2'),
    basis: 'DERIVATION', supports: [d1.id] });
  for (const n of [a, d1, d2]) add(g, n);

  const e = entitled(g, d2.id, scope({}));
  // PREDICTED DEFECT: the chain is admitted. D2 claims S2; the only evidence is at S1; no bridge.
  assert.equal(e.ok, true, 'prediction C1-a: the three-node chain is admitted - ' + JSON.stringify(e.problems));
});

test('C1-b CONTROL — the direct edge A@S1 -> D2@S2 is REFUSED for the same consumer', () => {
  const g = graph();
  const a = node({ kind: NODE.OBSERVATION, proposition: 'A observed', scope: S('S1'),
    basis: 'EXECUTION_WITNESS' });
  const d2 = node({ kind: NODE.CLAIM, proposition: 'D2 stated for S2', scope: S('S2'),
    basis: 'DERIVATION', supports: [a.id] });
  add(g, a); add(g, d2);
  const e = entitled(g, d2.id, scope({}));
  assert.equal(e.ok, false);
  assert.ok(e.problems.some((p) => /INVALID DERIVATION/.test(p.why)), JSON.stringify(e.problems));
});

test('C1-c NON-VACUITY — the same chain with D1@S1 is REFUSED, so the null is the laundering agent', () => {
  const g = graph();
  const a = node({ kind: NODE.OBSERVATION, proposition: 'A observed', scope: S('S1'),
    basis: 'EXECUTION_WITNESS' });
  const d1 = node({ kind: NODE.INTERPRETATION, proposition: 'D1 at S1', scope: S('S1'),
    basis: 'DERIVATION', supports: [a.id] });
  const d2 = node({ kind: NODE.CLAIM, proposition: 'D2 stated for S2', scope: S('S2'),
    basis: 'DERIVATION', supports: [d1.id] });
  for (const n of [a, d1, d2]) add(g, n);
  const e = entitled(g, d2.id, scope({}));
  assert.equal(e.ok, false);
  assert.ok(e.problems.some((p) => /INVALID DERIVATION/.test(p.why)), JSON.stringify(e.problems));
});

// ------------------------------------------------------------------ C7: identity excludes scope

test('C7-a ATTACK — the same proposition at two scopes has ONE id, and add() overwrites the first', () => {
  const g = graph();
  const p1 = node({ kind: NODE.CLAIM, proposition: 'P', scope: S('S1'), basis: 'X',
    evidence: ['w1'] });
  const p2 = node({ kind: NODE.CLAIM, proposition: 'P', scope: S('S2'), basis: 'X',
    evidence: ['w2'] });
  // PREDICTED: identical ids.
  assert.equal(p1.id, p2.id, 'prediction C7-a: scope is not part of identity');

  const c = node({ kind: NODE.CLAIM, proposition: 'C rests on P', scope: S('S1'), basis: 'Y',
    supports: [p1.id] });
  add(g, p1); add(g, c);
  assert.equal(entitled(g, c.id, S('S1')).ok, true, 'C is entitled on P@S1');

  add(g, p2);
  // PREDICTED DEFECT: the node under that id is now P@S2, with P@S1's evidence gone, and C - which was
  // justified by P@S1 - is still ESTABLISHED and now rests on a claim about a different world.
  assert.equal(g.nodes[p1.id].scope.repository, 'S2');
  assert.deepEqual(g.nodes[p1.id].evidence, ['w2']);
  assert.equal(g.nodes[c.id].validity, VALIDITY.ESTABLISHED, 'no invalidation reached C');
});

test('C7-b CONTROL — a different proposition gets a different id, so identity is not degenerate', () => {
  const p = node({ kind: NODE.CLAIM, proposition: 'P', scope: S('S1'), basis: 'X' });
  const q = node({ kind: NODE.CLAIM, proposition: 'Q', scope: S('S1'), basis: 'X' });
  assert.notEqual(p.id, q.id);
});
