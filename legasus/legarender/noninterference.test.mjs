// NONINTERFERENCE — witnessed against the REAL prompts from the measured families.
//
// The admit cases are not invented. They are the `ISOLATED` prompts that scored P(correct|assembled)
// 1.000 at every capacity, and the catch cases are the `SIBLING_NAMED` prompts that produced 31.6%
// CROSS-OBLIGATION CAPTURE. A checker that cannot tell those two apart has not measured anything.
//
// Both negative controls are present, because a checker that rejects everything passes every catch case
// and one that accepts everything passes every admit case.
import test from 'node:test';
import assert from 'node:assert';
import { noninterference, checkProjection, domainClaims, phraseClaims } from './noninterference.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

const SOURCE = L('def classify(n):', '    if n == 3:', '        return "three"',
  '    # >>> YOUR LINES GO HERE <<<', '    return "other"');

const OWN = { domainText: 'For every value below 10, however small, where n is not 3, return "low".',
  result: '"low"' };
// The preserved behaviour is part of THIS operation's contract: it is obliged not to break it.
const CONTEXT = [{ domainText: SOURCE, result: '"three"' }];
// The planner holds both forms: the prose a renderer would emit, and the canonical condition. A leak
// can arrive as either, and the measured corpus contains both.
const FOREIGN = [
  { id: 'micro', domainText: 'For every value below 0, however small, return "micro".',
    condition: 'n < 0', result: '"micro"' },
  { id: 'high', domainText: 'For every value above 100, however large, return "high".',
    condition: 'n > 100', result: '"high"' },
];

const head = L('Here is a Python function. Every line shown is FIXED: you may not change, repeat',
  'or remove any of it.', '', SOURCE, '', 'A new behaviour is requested:', '    ' + OWN.domainText, '');
const tail = L('Write ONLY the lines that take the place of the marker. Keep the same indentation.',
  'Do NOT repeat any fixed line. Do NOT write the whole function. Do NOT explain.');

const ISOLATED = L(head, tail);

const SIBLING_EXISTS = L(head,
  'There are 2 other behaviours requested for the same function. They are',
  'being written separately and will be added to this same chain of conditions.',
  'You are writing ONLY the behaviour requested above.', '', tail);

const SIBLING_NAMED = L(head,
  'These other behaviours are requested for the same function. They are being written',
  'separately and will be added to this same chain of conditions:',
  '    ' + FOREIGN[0].domainText,
  '    ' + FOREIGN[1].domainText,
  'You are writing ONLY the behaviour requested above. Do not write these.', '', tail);

test('ADMIT — the ISOLATED prompt, which scored 1.000 at every capacity', () => {
  const r = noninterference({ prompt: ISOLATED, own: OWN, context: CONTEXT, foreign: FOREIGN });
  assert.equal(r.ok, true, JSON.stringify(r.leaks));
});

test('ADMIT — SIBLING_EXISTS: saying other work exists leaks no semantics', () => {
  // Measured at 0 of 240 captured and P(correct) 0.996, so it must pass. This is the case that
  // separates "there is more text" from "there is foreign meaning".
  const r = noninterference({ prompt: SIBLING_EXISTS, own: OWN, context: CONTEXT, foreign: FOREIGN });
  assert.equal(r.ok, true, JSON.stringify(r.leaks));
});

test('ADMIT — naming the PRESERVED behaviour is required, not a leak', () => {
  // n != 3 appears in 167 measured guards and is correct: the operation is obliged not to break it.
  const withPreserved = L(head, 'The existing behaviour for n == 3 must keep returning "three".', tail);
  const r = noninterference({ prompt: withPreserved, own: OWN, context: CONTEXT, foreign: FOREIGN });
  assert.equal(r.ok, true, JSON.stringify(r.leaks));
});

test('CATCH — SIBLING_NAMED, the prompt that produced 31.6% capture', () => {
  const r = noninterference({ prompt: SIBLING_NAMED, own: OWN, context: CONTEXT, foreign: FOREIGN });
  assert.equal(r.ok, false);
  assert.deepEqual(r.leaks.map((l) => l.operation).sort(), ['high', 'high', 'micro', 'micro']);
  assert.ok(r.leaks.some((l) => l.kind === 'domain_phrase' && l.detail === 'below 0'));
  assert.ok(r.leaks.some((l) => l.kind === 'result' && l.detail === '"micro"'));
});

test('CATCH — a leak in code form, not just prose', () => {
  const asCode = L(head, 'Another line elsewhere does: if n < 0: return "micro"', tail);
  const r = noninterference({ prompt: asCode, own: OWN, context: CONTEXT, foreign: FOREIGN });
  assert.equal(r.ok, false);
  assert.ok(r.leaks.some((l) => l.kind === 'domain' && l.detail === 'n < 0'));
});

test('CATCH — relevance framing does not make a leak stop being a leak', () => {
  // The ELSEWHERE condition states the SAME domains and only reframes them. Whatever the model does
  // with that, the renderer still emitted another operation's semantics.
  const elsewhere = L(head,
    'These behaviours are handled by a DIFFERENT function elsewhere in the codebase. They are',
    'not part of this function and do not affect your condition:',
    '    ' + FOREIGN[0].domainText,
    '    ' + FOREIGN[1].domainText, '', tail);
  const r = noninterference({ prompt: elsewhere, own: OWN, context: CONTEXT, foreign: FOREIGN });
  assert.equal(r.ok, false, 'the framing changes the story, not the exposure');
});

test('NEGATIVE CONTROL — a checker that accepts everything fails the catch case', () => {
  const permissive = () => ({ ok: true, leaks: [] });
  const real = noninterference({ prompt: SIBLING_NAMED, own: OWN, context: CONTEXT, foreign: FOREIGN });
  assert.notEqual(real.ok, permissive().ok,
    'the instrument must disagree with a permissive stub somewhere, or it is one');
});

test('NEGATIVE CONTROL — a checker that rejects everything fails the admit cases', () => {
  const rejecting = () => ({ ok: false, leaks: [{ kind: 'everything' }] });
  for (const p of [ISOLATED, SIBLING_EXISTS]) {
    const real = noninterference({ prompt: p, own: OWN, context: CONTEXT, foreign: FOREIGN });
    assert.notEqual(real.ok, rejecting().ok,
      'the instrument must admit the prompts that measured clean, or it is a rejecting stub');
  }
});

test('the two obligations together — not too little AND not too much', () => {
  // Sufficiency alone passes a leaking prompt; noninterference alone passes an insufficient one.
  const required = ['below 10'];
  const bothOk = checkProjection({ prompt: ISOLATED, own: OWN, context: CONTEXT, foreign: FOREIGN,
    requiredFacts: required });
  assert.equal(bothOk.ok, true);

  const leaking = checkProjection({ prompt: SIBLING_NAMED, own: OWN, context: CONTEXT, foreign: FOREIGN,
    requiredFacts: required });
  assert.equal(leaking.ok, false);
  assert.equal(leaking.missing.length, 0, 'it is sufficient, and still wrong');

  const insufficient = checkProjection({ prompt: L(head, tail), own: OWN, context: CONTEXT,
    foreign: FOREIGN, requiredFacts: ['below 10', 'a fact nobody rendered'] });
  assert.equal(insufficient.ok, false);
  assert.equal(insufficient.leaks.length, 0, 'it leaks nothing, and is still wrong');
});

test('the claim extractors read what the corpus actually contains', () => {
  assert.deepEqual(domainClaims('if n < 10 and n != 3:'),
    [{ variable: 'n', op: '<', value: 10 }, { variable: 'n', op: '!=', value: 3 }]);
  assert.deepEqual(phraseClaims('For every value below 0, however small'),
    [{ phrase: 'below', value: 0 }]);
  // A bound belonging to a DIFFERENT variable is not this operation's domain.
  assert.deepEqual(domainClaims('if k < 10:'), [{ variable: 'k', op: '<', value: 10 }]);
});
