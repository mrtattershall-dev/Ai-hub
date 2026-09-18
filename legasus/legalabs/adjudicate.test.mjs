// The adjudicator's whole risk is that it turns P3 into a property that cannot fail. A function that
// answers "justified" to everything would make the conformance audit green and meaningless, and this
// project's ledger already records a checker whose branch could not return false.
//
// So the FIRST test is the negative one: a position that is legal on both channels must come back
// `over_constraint`.
import test from 'node:test';
import assert from 'node:assert';
import { adjudicateRemoval, oracleVersion } from './adjudicate.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

// A module body with two independent statements. Inserting another assignment between them changes
// nobody's parent and terminates nothing.
const FLAT = L(
  'A = 1',
  'B = 2',
  'C = 3',
);

// A function body whose statements follow a `return`. Inserting a class-level `def` at module indent
// ends the function early, and everything after it is re-parented out of that function - behaviour the
// sealed probes in a V1 family never call, which is the entire reason this adjudicator exists.
const NESTED = L(
  'def resolve(x):',
  '    y = x + 1',
  '    z = y * 2',
  '    return z',
);

test('a position legal on BOTH channels is an over-constraint - the adjudicator can fail', () => {
  const r = adjudicateRemoval({
    base: FLAT, code: 'D = 4' + NL, position: 0,
    row: { failing_positions: [] },
  });
  assert.equal(r.verdict, 'over_constraint');
  assert.equal(r.channel, 'structural_live');
});

test('a position the V1 seal recorded as failing is justified without re-deriving anything', () => {
  const r = adjudicateRemoval({
    base: FLAT, code: 'D = 4' + NL, position: 1,
    row: { failing_positions: [1] },
  });
  assert.equal(r.verdict, 'justified');
  assert.equal(r.channel, 'sealed');
});

test('a structurally destructive position is justified even though the V1 seal called it passing', () => {
  const r = adjudicateRemoval({
    base: NESTED, code: 'def helper():' + NL + '    return 0' + NL, position: 1,
    row: { failing_positions: [] },
  });
  assert.equal(r.verdict, 'justified');
  assert.equal(r.channel, 'structural_live');
  assert.ok(r.witness && r.witness.length, 'a live verdict must carry the violation it found');
  assert.ok(r.witness.some((v) => v.kind === 're_parented' || v.kind === 'vanished'),
    'the witness must name a real structural violation, got ' + JSON.stringify(r.witness));
});

test('a V2 row is never re-derived: its seal already ran both channels', () => {
  const r = adjudicateRemoval({
    base: NESTED, code: 'def helper():' + NL + '    return 0' + NL, position: 1,
    row: { failing_positions: [], oracle_version: 'V2', structural_only_failures: [] },
  });
  assert.equal(r.verdict, 'over_constraint');
  assert.equal(r.channel, 'sealed');
  assert.equal(r.oracle, 'V2');
});

test('oracle version comes from the row shape, so no sealed artifact has to be edited', () => {
  assert.equal(oracleVersion({ failing_positions: [] }), 'V1');
  assert.equal(oracleVersion({ oracle_version: 'V2' }), 'V2');
});
