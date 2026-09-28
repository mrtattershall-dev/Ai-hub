// WITNESSES for GATE 12C — precedence, including the must-distinguish pair.
//
// THE CENTRAL TEST: identical program, identical predicates, identical overlap, opposite stated intent
// must produce OPPOSITE precedence. Every earlier stage is asserted identical here, so a divergence can
// only come from the specification - which is the whole claim of the milestone.
//
// The ambiguity cases exist because AMBIGUOUS_INTENT is the obvious way to cheat. Coverage is scored:
// a deriver that declared everything ambiguous fails every PRECEDENCE case.
import { parseCondition, existingBehaviours, requestedBehaviour } from './predicates.mjs';
import { overlap } from './overlap.mjs';
import { derivePrecedence } from './precedence.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

// ONE program for both halves of the pair. Nothing about it differs between cases.
const SRC = L(
  'def classify(n):',
  '    if n < 0:',
  '        return "negative"',
  '    if n == 0:',
  '        return "zero"',
  '    return "positive"',
);

const zeroBehaviour = existingBehaviours(SRC, 'classify').find((b) => b.condition === 'n == 0');

function run(deltaText, preservationText) {
  const requested = requestedBehaviour(deltaText, 'n', { soleParameter: true });
  const ov = overlap(zeroBehaviour.domain, requested.domain);
  const prec = derivePrecedence({
    preservation_text: preservationText,
    delta_text: deltaText,
    existing: { condition: zeroBehaviour.condition, result: zeroBehaviour.result },
    requested: { condition: requested.condition, result: requested.result },
  }, ov);
  return { requested, ov, prec };
}

// ---- the must-distinguish pair
const CASE_A = run('For other values below 10, return "small".',
  'Preserve the existing special handling of zero.');
const CASE_B = run('Values below 10 should now return "small", including values that previously returned "zero".',
  null);

let fail = 0;
const check = (name, cond, detail) => {
  if (!cond) fail++;
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + name + (detail ? '   ' + detail : ''));
};

check('SHARED  both cases extract the SAME requested domain',
  JSON.stringify(CASE_A.requested.domain) === JSON.stringify(CASE_B.requested.domain),
  JSON.stringify(CASE_A.requested.domain));
check('SHARED  both cases produce the SAME overlap output',
  JSON.stringify(CASE_A.ov) === JSON.stringify(CASE_B.ov),
  CASE_A.ov.result + ' witness ' + CASE_A.ov.witness);
check('CASE A  preserved zero outranks new small',
  CASE_A.prec.outcome === 'PRECEDENCE' && CASE_A.prec.winner === 'existing',
  CASE_A.prec.outcome + ' ' + (CASE_A.prec.statement || ''));
check('CASE B  new small outranks previously-zero',
  CASE_B.prec.outcome === 'PRECEDENCE' && CASE_B.prec.winner === 'requested',
  CASE_B.prec.outcome + ' ' + (CASE_B.prec.statement || ''));
check('MUST DISTINGUISH  opposite intent gives OPPOSITE precedence',
  CASE_A.prec.winner !== CASE_B.prec.winner);

// ---- no overlap: precedence is not a question
const NOOV = run('When n is greater than 10 return "big".', 'Keep everything else working.');
check('NO OVERLAP  disjoint domains need no precedence',
  NOOV.prec.outcome === 'NO_PRECEDENCE_NEEDED',
  NOOV.ov.result + ' -> ' + NOOV.prec.outcome);

// ---- ambiguity: overlap, but the contract says nothing either way
const AMB = run('Add small handling for values below 10.', null);
check('AMBIGUOUS  overlap with no statement either way is declared, not guessed',
  AMB.prec.outcome === 'AMBIGUOUS_INTENT',
  AMB.ov.result + ' -> ' + AMB.prec.outcome);

// ---- unknown overlap must not become a confident ordering
const UNK = derivePrecedence(
  { preservation_text: 'Preserve the existing handling.', delta_text: 'Handle names in COLORS.' },
  { result: 'UNKNOWN', reason: 'unmodelled' });
check('UNKNOWN OVERLAP  declines rather than ordering',
  UNK.outcome === 'AMBIGUOUS_INTENT');

// ---- source order must not be usable as evidence
check('NO SOURCE ORDER  case B wins for the NEW behaviour over the same program that case A preserves',
  CASE_A.prec.winner === 'existing' && CASE_B.prec.winner === 'requested');

// ---- the contract must not name an implementation
const leak = /line \d|insert|elif|after the|before the|branch/i;
check('NO LEAKAGE  case A reason names no site, order or branch shape',
  !leak.test(CASE_A.prec.reason), CASE_A.prec.reason.slice(0, 72));
check('NO LEAKAGE  case B reason names no site, order or branch shape',
  !leak.test(CASE_B.prec.reason), CASE_B.prec.reason.slice(0, 72));

const precedenceCases = 2;
const otherCases = 3;
console.log('');
console.log('  ' + (fail ? fail + ' WITNESS FAILURE(S)' : 'all witnesses pass'));
console.log('  Non-vacuity: ' + precedenceCases + ' cases must yield PRECEDENCE in OPPOSITE directions,');
console.log('  and ' + otherCases + ' must yield NO_PRECEDENCE_NEEDED or AMBIGUOUS_INTENT. A deriver');
console.log('  that always declared ambiguity fails both precedence cases; one that always ordered');
console.log('  fails the disjoint and ambiguous ones.');
if (fail) process.exitCode = 1;
