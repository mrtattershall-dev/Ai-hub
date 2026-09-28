// CONTROLS FOR SEMANTIC-1 — predictions P-1..P-5, C-1..C-3 in benchmarks/SEMANTIC_1_PREREG.md.
//
// Every formula in the vocabulary is demonstrated on a fixture built to produce exactly it, so a
// vocabulary word that the inference can never emit would fail here rather than sit unused. The run
// against the real tree is benchmarks/RESULT.semantic.md.
import test from 'node:test';
import assert from 'node:assert';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recorder } from './witness.mjs';
import { roleOf, supportFormula, decisionProfile, ROLE, FORMULA, SPEC_VOCABULARY } from './semantic.mjs';
import { contract, resolve, digestOf, RESOLUTION, STATUS } from './contract.mjs';
import { VERDICT } from './outcome.mjs';

// A miniature authority system whose `combine` can be swapped, so each formula gets a subject that
// really behaves that way rather than a stub that reports it.
function rig(combine) {
  const MINTED = new WeakSet();
  const mint = (o) => { const t = Object.freeze(o); MINTED.add(t); return t; };
  const isAuthority = (t) => !!(t && typeof t === 'object' && MINTED.has(t));
  const R = recorder().brand(isAuthority);
  const o = R.instrument('t.observe', ({ context }) => mint({ context: { ...context } }));
  const d = R.instrument('t.combine', ({ premises, rule }) => {
    if (!premises.every(isAuthority)) return { refused: true };
    return mint({ context: combine(premises), rule });
  });
  return { R, o, d, isAuthority };
}
const two = (g, a, b) => g.d({ premises: [g.o({ context: a }), g.o({ context: b })],
  rule: 'conjunction' });
const formulaOf = (g, coord) => supportFormula(g.R, g.R.witnesses('t.combine')[0], coord).formula;

test('P-1 ALL_OF — every input group individually carries the coordinate', () => {
  const g = rig((ps) => (ps.every((p) => p.context.repo !== undefined)
    ? { repo: ps[0].context.repo } : {}));
  two(g, { repo: 'S1' }, { repo: 'S1' });
  assert.equal(formulaOf(g, 'context.repo'), FORMULA.ALL_OF);
});

test('P-1 ANY_OF — no single removal moves it, removing every premise fact does', () => {
  const g = rig((ps) => { const v = ps.map((p) => p.context.repo).find((x) => x !== undefined);
    return v === undefined ? {} : { repo: v }; });
  two(g, { repo: 'S1' }, { repo: 'S1' });
  assert.equal(formulaOf(g, 'context.repo'), FORMULA.ANY_OF);
});

test('P-1 NTH — exactly one input group carries it', () => {
  const g = rig((ps) => (ps[0].context.repo === undefined ? {} : { repo: ps[0].context.repo }));
  two(g, { repo: 'S1' }, { repo: 'S1' });
  assert.equal(formulaOf(g, 'context.repo'), FORMULA.NTH(0));
});

test('P-1 CONSTANT — removing every premise fact leaves it in place', () => {
  const g = rig(() => ({ repo: 'ALWAYS' }));
  two(g, { repo: 'S1' }, { repo: 'S1' });
  assert.equal(formulaOf(g, 'context.repo'), FORMULA.CONSTANT);
});

test('P-1 UNKNOWN — one constructed input is not an aggregation over inputs', () => {
  const g = rig((ps) => ({ repo: ps[0].context.repo }));
  g.d({ premises: [g.o({ context: { repo: 'S1' } })], rule: 'single' });
  assert.equal(formulaOf(g, 'context.repo'), FORMULA.UNKNOWN);
});

test('THE TARGET\'S OWN FACTS ARE NOT A PREMISE GROUP', () => {
  // The defect the first real run exposed. `rule` is a fact of the operation, not a premise of an
  // aggregation over premises; counting it as a third group made ALL_OF structurally unreachable and
  // every derive in the repository came out SOME_OF(2/3).
  const g = rig((ps) => (ps.every((p) => p.context.repo !== undefined)
    ? { repo: ps[0].context.repo } : {}));
  two(g, { repo: 'S1' }, { repo: 'S1' });
  const w = g.R.witnesses('t.combine')[0];
  assert.ok(w.leaves.some((l) => l.node === w.root.id), 'the root really does carry its own leaves');
  assert.equal(supportFormula(g.R, w, 'context.repo').groups, 2, 'and they are not an input group');
});

test('ROLES are established from what a call DID, not from what it is called', () => {
  const g = rig((ps) => ({ repo: ps[0].context.repo }));
  two(g, { repo: 'S1' }, { repo: 'S1' });
  const produce = g.R.witnesses('t.observe')[0];
  const transduce = g.R.witnesses('t.combine')[0];
  assert.equal(roleOf(g.R, produce), ROLE.PRODUCER, 'facts in, authority out');
  assert.equal(roleOf(g.R, transduce), ROLE.TRANSDUCER, 'authority in, authority out');

  // The SAME function is a CONSUMER on a call where it refuses to mint.
  const h = rig(() => ({}));
  const refuser = h.R.instrument('t.gate', ({ premises }) => premises.every(h.isAuthority));
  refuser({ premises: [h.o({ context: { repo: 'S1' } })] });
  assert.equal(roleOf(h.R, h.R.witnesses('t.gate')[0]), ROLE.CONSUMER, 'authority in, no authority out');
});

test('C-2 MUST FIRE — a weakened input that leaves the DECISION unchanged', () => {
  // Without this, a screen that convicts every perturbation looks perfect and "always refuse" wins.
  const g = rig((ps) => ({ repo: ps[0].context.repo }));
  const pred = g.R.instrument('t.isAuth', (t) => g.isAuthority(t));
  pred(g.o({ context: { repo: 'S1', note: 'irrelevant' } }));
  const p = decisionProfile(g.R, g.R.witnesses('t.isAuth')[0]);
  assert.ok(p.measured > 0, 'the decision was actually read');
  assert.equal(p.required, 0, 'no fact of the token changes whether it IS a token');
  assert.ok(p.irrelevant > 0, 'and that is a positive observation, not a failure to detect');
});

test('C-3 — a decision that DOES depend on the weakened coordinate', () => {
  const g = rig((ps) => ({ repo: ps[0].context.repo }));
  const gate = g.R.instrument('t.gate', (t) => t.context.repo === 'S1');
  gate(g.o({ context: { repo: 'S1' } }));
  const p = decisionProfile(g.R, g.R.witnesses('t.gate')[0]);
  assert.ok(p.required > 0, 'removing repo changes the decision');
});

// ------------------------------------------------------------------ contracts
const AUTH = (validAgainst) => ({ source: 'legasus/legaknow/calculus.mjs',
  provenance: 'DERIVE: the output context is the INTERSECTION', version: 'r4', validAgainst });
const EV = { replayed: true, applied: true, observed: true };

test('P-2 — a contract missing its authority is REFUSED at construction', () => {
  for (const missing of ['source', 'provenance', 'validAgainst']) {
    const a = AUTH('abc'); delete a[missing];
    assert.throws(() => contract({ subject: 's', coordinate: 'c', proposition: 'ALL_OF', authority: a }),
      new RegExp('authority\\.' + missing), 'a criterion with no stated ' + missing + ' is testimony');
  }
});

test('P-3b MUST FIRE — a contract whose subject has MOVED can neither convict nor absolve', () => {
  const c = contract({ subject: 's', coordinate: 'context.repo', proposition: 'ALL_OF',
    authority: AUTH('DIGEST-AT-AUTHORING') });
  const current = resolve({ observed: 'ALL_OF', contract: c, digest: 'DIGEST-AT-AUTHORING',
    vocabulary: SPEC_VOCABULARY, evidence: EV });
  assert.equal(current.resolution, RESOLUTION.SCREENED);
  assert.equal(current.verdict, VERDICT.INVARIANT_HELD);

  const moved = resolve({ observed: 'ALL_OF', contract: c, digest: 'THE-SUBJECT-CHANGED',
    vocabulary: SPEC_VOCABULARY, evidence: EV });
  assert.equal(moved.resolution, RESOLUTION.CHARACTERIZED);
  assert.equal(moved.status, STATUS.STALE);
  assert.equal(moved.verdict, undefined, 'it cannot ABSOLVE either - that is the half usually forgotten');

  const wrong = resolve({ observed: 'ANY_OF', contract: c, digest: 'THE-SUBJECT-CHANGED',
    vocabulary: SPEC_VOCABULARY, evidence: EV });
  assert.equal(wrong.verdict, undefined, 'and a stale contract cannot convict');
});

test('SELF-RATIFICATION IS BLOCKED BY CONSTRUCTION, on real bytes', () => {
  // Edit the implementation and its criterion together; the digest no longer matches, so the pair
  // cannot come out green.
  const dir = mkdtempSync(join(tmpdir(), 'lgs-contract-'));
  const f = join(dir, 'subject.mjs');
  try {
    writeFileSync(f, 'export const rule = "INTERSECTION";\n');
    const c = contract({ subject: 's', coordinate: 'context.repo', proposition: 'ANY_OF',
      authority: { source: f, provenance: 'p', version: '1', validAgainst: digestOf(f) } });
    assert.equal(resolve({ observed: 'ANY_OF', contract: c, digest: digestOf(f),
      vocabulary: SPEC_VOCABULARY, evidence: EV }).verdict, VERDICT.INVARIANT_HELD);
    writeFileSync(f, 'export const rule = "UNION";\n');            // implementation moves
    const after = resolve({ observed: 'ANY_OF', contract: c, digest: digestOf(f),
      vocabulary: SPEC_VOCABULARY, evidence: EV });
    assert.equal(after.status, STATUS.STALE);
    assert.equal(after.verdict, undefined);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('UNMAPPABLE MUST FIRE — an observation the specification has no word for', () => {
  // NOT coerced to UNKNOWN, NOT coerced to the nearest available word. A capability gap in the
  // SPECIFICATION is not evidence against the subject.
  const c = contract({ subject: 's', coordinate: 'context.repo', proposition: 'ALL_OF',
    authority: AUTH('d') });
  const r = resolve({ observed: FORMULA.SOME_OF(2, 3), contract: c, digest: 'd',
    vocabulary: SPEC_VOCABULARY, evidence: EV });
  assert.equal(r.resolution, RESOLUTION.UNMAPPABLE);
  assert.equal(r.verdict, undefined);
  assert.match(r.why, /capability gap IN THE SPECIFICATION/);
  assert.ok(!SPEC_VOCABULARY.includes(FORMULA.SOME_OF(2, 3)));
});

test('P-4 — no contract means CHARACTERIZED, never DEFECT', () => {
  const r = resolve({ observed: 'ANY_OF', contract: null, vocabulary: SPEC_VOCABULARY, evidence: EV });
  assert.equal(r.resolution, RESOLUTION.CHARACTERIZED);
  assert.equal(r.verdict, undefined);
  assert.match(r.why, /does not invent requirements/);
});

test('AND THE STRUCTURAL GATE STILL APPLIES — a contract cannot judge an experiment that never ran', () => {
  const c = contract({ subject: 's', coordinate: 'context.repo', proposition: 'ALL_OF',
    authority: AUTH('d') });
  const r = resolve({ observed: 'ANY_OF', contract: c, digest: 'd', vocabulary: SPEC_VOCABULARY,
    evidence: { replayed: true, applied: false, observed: false } });
  assert.equal(r.verdict, VERDICT.INVARIANT_UNKNOWN, 'an established, current contract is still not');
  assert.match(r.why, /the experiment never ran/);
});
