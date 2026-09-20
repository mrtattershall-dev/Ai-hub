// r4 — authority under composition in the justification graph. Predictions were frozen in
// benchmarks/COMPOSITION_PREREG.md (C1, C7); the PRE-REPAIR run that reproduced both defects is
// preserved in benchmarks/RESULT.composition.md and at commit b11e51f, where this file asserted the
// defects. It now asserts the repairs, and keeps every control, so a refusal machine cannot pass.
import test from 'node:test';
import assert from 'node:assert';
import { graph, add, node, entitled, scope, NODE, VALIDITY, EDGE, ANY } from './justification.mjs';

const S = (repository) => scope({ repository });

// ------------------------------------------------------------------ C1: the null intermediate

const chain = (d1Repo) => {
  const g = graph();
  const a = node({ kind: NODE.OBSERVATION, proposition: 'A observed', scope: S('S1'),
    basis: 'EXECUTION_WITNESS' });
  const d1 = node({ kind: NODE.INTERPRETATION, proposition: 'D1', scope: S(d1Repo),
    basis: 'DERIVATION', supports: [a.id] });
  const d2 = node({ kind: NODE.CLAIM, proposition: 'D2 stated for S2', scope: S('S2'),
    basis: 'DERIVATION', supports: [d1.id] });
  for (const n of [a, d1, d2]) add(g, n);
  return { g, a, d1, d2 };
};

test('C1-a REGRESSION — A@S1 -> D1@null -> D2@S2 is REFUSED even when the consumer does not pin repository', () => {
  const { g, d2 } = chain(null);
  const e = entitled(g, d2.id, scope({}));
  assert.equal(e.ok, false, 'b11e51f admitted this chain');
  assert.ok(e.problems.some((p) => /never established repository/.test(p.why)), JSON.stringify(e.problems));
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

test('C1-c NON-VACUITY — the same chain with D1@S1 is REFUSED, so the null was the laundering agent', () => {
  const { g, d2 } = chain('S1');
  assert.equal(entitled(g, d2.id, scope({})).ok, false);
});

test('C1-d ADMIT CONTROL — a restriction is free: A@S1 -> D1@null -> D2@null is ENTITLED', () => {
  // The repair must not turn into a wall. A conclusion WEAKER than its premise on a context dimension
  // is a restriction and needs no authority.
  const g = graph();
  const a = node({ kind: NODE.OBSERVATION, proposition: 'A observed', scope: S('S1'),
    basis: 'EXECUTION_WITNESS' });
  const d1 = node({ kind: NODE.INTERPRETATION, proposition: 'D1', scope: S(null),
    basis: 'DERIVATION', supports: [a.id] });
  const d2 = node({ kind: NODE.CLAIM, proposition: 'D2', scope: S(null),
    basis: 'DERIVATION', supports: [d1.id] });
  for (const n of [a, d1, d2]) add(g, n);
  assert.equal(entitled(g, d2.id, scope({})).ok, true);
  // and the same-world chain is entitled for a consumer who pins that world
  const { g: g2, d2: same } = (() => {
    const gg = graph();
    const x = node({ kind: NODE.OBSERVATION, proposition: 'A', scope: S('S1'), basis: 'W' });
    const y = node({ kind: NODE.CLAIM, proposition: 'B', scope: S('S1'), basis: 'D', supports: [x.id] });
    const z = node({ kind: NODE.CLAIM, proposition: 'C', scope: S('S1'), basis: 'D', supports: [y.id] });
    for (const n of [x, y, z]) add(gg, n);
    return { g: gg, d2: z };
  })();
  assert.equal(entitled(g2, same.id, S('S1')).ok, true);
});

test('C1-e ADMIT CONTROL — a premise established for ANY covers any concrete conclusion', () => {
  const g = graph();
  const a = node({ kind: NODE.OBSERVATION, proposition: 'A for all repositories', scope: S(ANY),
    basis: 'PROOF' });
  const d = node({ kind: NODE.CLAIM, proposition: 'D at S2', scope: S('S2'), basis: 'D',
    supports: [a.id] });
  add(g, a); add(g, d);
  assert.equal(entitled(g, d.id, S('S2')).ok, true);
});

test('C1-f — the laundering path cannot run through ANY_OF either', () => {
  const g = graph();
  const a = node({ kind: NODE.OBSERVATION, proposition: 'A observed', scope: S('S1'),
    basis: 'EXECUTION_WITNESS' });
  const d1 = node({ kind: NODE.INTERPRETATION, proposition: 'D1', scope: S(null),
    basis: 'DERIVATION', supports: [a.id] });
  const d2 = node({ kind: NODE.CLAIM, proposition: 'D2 stated for S2', scope: S('S2'),
    basis: 'DERIVATION', supports: [{ id: d1.id, edge: EDGE.ANY_OF }] });
  for (const n of [a, d1, d2]) add(g, n);
  const e = entitled(g, d2.id, scope({}));
  assert.equal(e.ok, false);
  assert.ok(e.problems.some((p) => /no surviving alternative/.test(p.why)), JSON.stringify(e.problems));
  // positive control: an alternative in the SAME world survives
  const g2 = graph();
  const x = node({ kind: NODE.OBSERVATION, proposition: 'X', scope: S('S2'), basis: 'W' });
  const y = node({ kind: NODE.CLAIM, proposition: 'Y at S2', scope: S('S2'), basis: 'D',
    supports: [{ id: x.id, edge: EDGE.ANY_OF }] });
  add(g2, x); add(g2, y);
  assert.equal(entitled(g2, y.id, S('S2')).ok, true);
});

// ------------------------------------------------------------------ C7: identity includes scope

test('C7-a REGRESSION — the same proposition at two scopes has TWO ids, and neither overwrites the other', () => {
  const g = graph();
  const p1 = node({ kind: NODE.CLAIM, proposition: 'P', scope: S('S1'), basis: 'X', evidence: ['w1'] });
  const p2 = node({ kind: NODE.CLAIM, proposition: 'P', scope: S('S2'), basis: 'X', evidence: ['w2'] });
  assert.notEqual(p1.id, p2.id, 'b11e51f gave these one id');
  const c = node({ kind: NODE.CLAIM, proposition: 'C rests on P', scope: S('S1'), basis: 'Y',
    supports: [p1.id] });
  add(g, p1); add(g, c); add(g, p2);
  assert.equal(g.nodes[p1.id].scope.repository, 'S1');
  assert.deepEqual(g.nodes[p1.id].evidence, ['w1']);
  assert.equal(g.nodes[p2.id].scope.repository, 'S2');
  assert.equal(entitled(g, c.id, S('S1')).ok, true, 'C still rests on P@S1, untouched');
});

test('C7-b — add() REFUSES a duplicate identity with a reason instead of overwriting', () => {
  const g = graph();
  const p = node({ kind: NODE.CLAIM, proposition: 'P', scope: S('S1'), basis: 'X', evidence: ['w1'] });
  const again = node({ kind: NODE.CLAIM, proposition: 'P', scope: S('S1'), basis: 'X', evidence: ['w2'] });
  assert.equal(p.id, again.id, 'same claim, same scope: same identity');
  assert.equal(add(g, p), p.id);
  const r = add(g, again);
  assert.equal(r.rejected, true);
  assert.match(r.why, /reestablish\(\)/);
  assert.deepEqual(g.nodes[p.id].evidence, ['w1'], 'the first node is untouched');
});

test('C7-c CONTROL — a different proposition still gets a different id; ANY and null are distinct in identity', () => {
  const p = node({ kind: NODE.CLAIM, proposition: 'P', scope: S('S1'), basis: 'X' });
  const q = node({ kind: NODE.CLAIM, proposition: 'Q', scope: S('S1'), basis: 'X' });
  assert.notEqual(p.id, q.id);
  const any = node({ kind: NODE.CLAIM, proposition: 'P', scope: S(ANY), basis: 'X' });
  const nul = node({ kind: NODE.CLAIM, proposition: 'P', scope: S(null), basis: 'X' });
  assert.notEqual(any.id, nul.id, 'for-all and never-established are different claims');
});

test('C7-d — a difference ONLY in UNADMITTED is the same claim (recorded, not authoritative)', () => {
  const a = node({ kind: NODE.CLAIM, proposition: 'P', basis: 'X',
    scope: scope({ repository: 'S1', UNADMITTED: { cohort: 'A' } }) });
  const b = node({ kind: NODE.CLAIM, proposition: 'P', basis: 'X',
    scope: scope({ repository: 'S1', UNADMITTED: { cohort: 'B' } }) });
  assert.equal(a.id, b.id);
});
