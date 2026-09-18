// REACHABILITY BY EXECUTION — and the case the planned version gets wrong.
//
// The decisive witness is the ADMIT case. A self-defending realization assembled in an order the PLAN
// calls wrong produces a program with no dead code, and `reachability` - which never sees the program -
// condemns it anyway. Both are run here on the same program so the disagreement is on the record rather
// than in a commit message.
//
// Both negative controls are present, because a deadness check that admits everything passes every
// catch case and one that rejects everything passes every admit case:
//   - a check that never reports dead must FAIL the shadowed case
//   - a check that always reports dead must FAIL the self-defending case
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { reachability, reachabilityExecuted, auditResultLabels } from './transaction.mjs';
import { parseCondition } from '../legacore/predicates.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

// Domains are built by the real parser, not hand-shaped here. A hand-written domain object that the
// parser would never produce can make the planned check say anything, including agreeing by accident.
const REQUESTED = [
  { id: 'low', result: '"low"', domain: parseCondition('n < 10') },
  { id: 'high', result: '"high"', domain: parseCondition('n > 100') },
  { id: 'micro', result: '"micro"', domain: parseCondition('n < 0') },
];
const PRESENTED = ['low', 'high', 'micro'];
const PRESERVED = parseCondition('n == 3');

// Run a python program over a sweep and report which results it ACTUALLY produced.
function observedResults(bodyLines) {
  const prog = L('def classify(n):', ...bodyLines, '    return "other"', '',
    'import json',
    'vs = list(range(-100000, 100001, 7)) + [-1, 0, 1, 3, 5, 9, 10, 11, 50, 99, 100, 101, 1000]',
    'print(json.dumps(sorted(set(json.dumps(classify(v)) for v in vs))))');
  const out = execFileSync('python', ['-c', prog], { encoding: 'utf8' });
  return new Set(JSON.parse(out));
}

const SELF_DEFENDING = ['    if n == 3: return "three"',
  '    if n < 10 and n >= 0: return "low"',
  '    if n > 100: return "high"',
  '    if n < 0: return "micro"'];

const SHADOWING = ['    if n == 3: return "three"',
  '    if n < 10: return "low"',
  '    if n > 100: return "high"',
  '    if n < 0: return "micro"'];

test('ADMIT — a self-defending realization has no dead code, and is admitted', () => {
  const observed = observedResults(SELF_DEFENDING);
  assert.ok(observed.has('"micro"'), 'the witness is only meaningful if micro genuinely fires');
  const r = reachabilityExecuted({ requested: REQUESTED, observed });
  assert.equal(r.allReachable, true, 'no operation is dead in this program, so none may be reported dead');
  assert.deepEqual(r.dead, []);
});

test('and the PLANNED check condemns that same program — the defect, on the record', () => {
  const planned = reachability({ requested: REQUESTED, order: PRESENTED,
    preserved: PRESERVED, preservedWins: true });
  assert.deepEqual(planned.dead, ['micro'],
    'the planned check calls micro dead because n<0 is inside n<10 and low came first');
  // Executing the same program shows micro firing. The two disagree, and execution is right.
  assert.ok(observedResults(SELF_DEFENDING).has('"micro"'));
});

test('CATCH — a genuinely shadowed operation cannot produce its result, and is caught', () => {
  const observed = observedResults(SHADOWING);
  assert.equal(observed.has('"micro"'), false, 'a shadowed branch cannot fire for any input');
  const r = reachabilityExecuted({ requested: REQUESTED, observed });
  assert.equal(r.allReachable, false);
  assert.deepEqual(r.dead, ['micro'], 'and it must name which operation');
});

test('NEGATIVE CONTROL — a check that never reports dead fails the shadowed case', () => {
  const neverDead = () => ({ allReachable: true, dead: [] });
  assert.equal(neverDead().allReachable, true);
  const real = reachabilityExecuted({ requested: REQUESTED, observed: observedResults(SHADOWING) });
  assert.notEqual(real.allReachable, neverDead().allReachable,
    'the instrument must disagree with a permissive stub somewhere, or it is one');
});

test('NEGATIVE CONTROL — a check that always reports dead fails the self-defending case', () => {
  const alwaysDead = () => ({ allReachable: false, dead: REQUESTED.map((r) => r.id) });
  const real = reachabilityExecuted({ requested: REQUESTED, observed: observedResults(SELF_DEFENDING) });
  assert.notEqual(real.allReachable, alwaysDead().allReachable,
    'the instrument must disagree with a rejecting stub somewhere, or it is one');
});

test('the audit REFUSES a setup where an observation could not be attributed', () => {
  const shared = [{ id: 'a', result: '"x"' }, { id: 'b', result: '"x"' }];
  const a1 = auditResultLabels({ requested: shared });
  assert.equal(a1.ok, false);
  assert.match(a1.problems.join(' '), /share the result/);

  const collides = [{ id: 'a', result: '"other"' }];
  const a2 = auditResultLabels({ requested: collides, originalResults: ['"other"'] });
  assert.equal(a2.ok, false);
  assert.match(a2.problems.join(' '), /already produces/);

  const missing = [{ id: 'a', result: null }];
  assert.equal(auditResultLabels({ requested: missing }).ok, false);

  assert.equal(auditResultLabels({ requested: REQUESTED, originalResults: ['"other"', '"three"'] }).ok,
    true, 'and it must ADMIT the real setup, or it is refusing everything');
});

test('deadness by execution does not consult the order — the same program, either order, same verdict', () => {
  const observed = observedResults(SELF_DEFENDING);
  const a = reachabilityExecuted({ requested: REQUESTED, observed });
  const b = reachabilityExecuted({ requested: REQUESTED.slice().reverse(), observed });
  assert.deepEqual(a.dead, b.dead, 'the verdict is a property of the artifact, not of how it is listed');
});
