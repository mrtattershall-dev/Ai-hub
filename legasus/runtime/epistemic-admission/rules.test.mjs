// V1.2 — R1..R5. Who owns the semantics of an inference rule?
//
// Predictions frozen in V1.2_PREREG.md before any of this was implemented. R3 is the attack and R4 is
// the anti-refusal control; without R4 the safe-looking repair becomes "every derivation must carry a
// witness", which is a refusal machine.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { adapt, deriveArgs, readable } from './adapter.mjs';
import { admit, STATE } from './admission.mjs';
import { ADMITTED_RULES, DIGESTS, resolveRule, digestOf, RULE_MOVED } from './rules.mjs';
import { derive, observe, isAuthority } from '../../legaknow/calculus.mjs';
import { observation, OBSERVABILITY } from '../../legaknow/observation.mjs';

const load = (n) => JSON.parse(readFileSync(new URL('./fixtures/' + n + '.json', import.meta.url), 'utf8'));
const F4 = load('F4');          // FOR_ALL, exhaustive coverage, witnesses established
const F1 = load('F1');          // EXISTS over PROGRAM from FUNCTION evidence: no membership witness

const obsToken = () => observe({
  observation: observation({ status: OBSERVABILITY.OBSERVED, value: 'v', subject: 's',
    producer: 'p', procedure: 'proc', attribution: 'attr', context: { a: 1 } }),
  procedure: 'proc', context: { a: 1 } });

test('P-1 BASELINE, kept as the record of the defect v1.2 repairs', () => {
  // derive() always COULD enforce; the old adapter never asked it to, passing `requires: []` itself.
  const refused = derive({ premises: [obsToken()], rule: { name: 'r', requires: ['MEMBERSHIP'] },
    relationWitnesses: [], claim: 'c' });
  assert.equal(refused.minted, false);
  assert.match(refused.why, /requires witnesses for MEMBERSHIP/);
  const vacuous = derive({ premises: [obsToken()], rule: { name: 'r', requires: [] },
    relationWitnesses: [], claim: 'c' });
  assert.equal(isAuthority(vacuous), true, 'an empty requirement mints with no witness at all');
});

test('R1 — known rule, every required witness supplied: MINT', () => {
  const out = adapt(F4);
  assert.equal(isAuthority(out.token), true, out.why);
  assert.equal(out.rule, 'universal-from-exhaustive-coverage');
  assert.equal(admit(F4).state, STATE.ESTABLISHED);
  // the witness was a FACT the producer established, and the requirement came from here
  assert.deepEqual(ADMITTED_RULES['universal-from-exhaustive-coverage'].requires, ['COVERAGE']);
  assert.ok(F4.derivation.alternatives[0].relation_witnesses.includes('COVERAGE'));
});

test('R2 — same rule, the required witness omitted: REFUSE, naming the relation', () => {
  const c = structuredClone(F4);
  for (const a of c.derivation.alternatives) a.relation_witnesses = [];
  const out = adapt(c);
  assert.equal(out.minted, false);
  assert.equal(out.stage, 'DERIVE');
  assert.match(out.why, /requires witnesses for COVERAGE/);
  assert.deepEqual(out.missing, ['COVERAGE']);
  assert.equal(admit(c).established, false);
});

test('R3 THE ATTACK — a certificate cannot shrink its own obligation', () => {
  // (a) the schema has no place to say it: additionalProperties is false on derivation.
  const schema = JSON.parse(readFileSync(
    new URL('../../contracts/entitlement-certificate.v1.2.schema.json', import.meta.url), 'utf8'));
  assert.equal(schema.$defs.derivation.additionalProperties, false);
  assert.ok(!('requires' in schema.$defs.derivation.properties), 'no requires field exists in v1.2');

  // (b) and even hand-forged past the schema, it is never read. The requirement is resolved locally.
  const forged = structuredClone(F4);
  forged.derivation.requires = [];                        // the lie
  for (const a of forged.derivation.alternatives) a.relation_witnesses = [];
  const out = adapt(forged);
  assert.equal(out.minted, false, 'the forged requirement must not be honoured');
  assert.match(out.why, /requires witnesses for COVERAGE/);
  assert.deepEqual(out.requires, ['COVERAGE'], 'the LOCAL requirement was used, not the certificate');

  // (c) the adapter builds derive() arguments from the local rule object it was handed
  const local = resolveRule(F4.derivation);
  const args = deriveArgs(forged, 0, [obsToken()], local.rule);
  assert.deepEqual(args.rule.requires, ['COVERAGE']);
  assert.notEqual(args.rule, forged.derivation, 'the rule is never the certificate');
});

test('R4 ANTI-REFUSAL — a rule that genuinely requires nothing mints without witnesses', () => {
  const rule = ADMITTED_RULES['claim-from-direct-observation'];
  assert.deepEqual(rule.requires, [], 'this rule relates nothing to anything');
  const c = structuredClone(F4);
  c.requested_claim.quantifier = 'POINTWISE';
  c.derivation.rule_id = 'claim-from-direct-observation';
  c.derivation.rule_digest = DIGESTS['claim-from-direct-observation'];
  for (const a of c.derivation.alternatives) a.relation_witnesses = [];
  const out = adapt(c);
  assert.equal(isAuthority(out.token), true, 'v1.2 must not become "every derivation needs a witness"');
  assert.equal(out.rule, 'claim-from-direct-observation');
});

test('R5 DRIFT — a moved rule definition is REFUSED, never silently re-interpreted', () => {
  const c = structuredClone(F4);
  c.derivation.rule_digest = 'f'.repeat(64);              // produced against another definition
  const out = adapt(c);
  assert.equal(out.minted, false);
  assert.equal(out.stage, 'RULE');
  assert.equal(out.moved, true);
  assert.match(out.why, new RegExp(RULE_MOVED));
  assert.match(out.why, /neither convict nor absolve/);
  assert.equal(admit(c).established, false);

  // and the drift is real rather than nominal: change what the rule REQUIRES and the digest moves
  const moved = { name: 'universal-from-exhaustive-coverage', requires: ['COVERAGE', 'MEMBERSHIP'],
    version: '1' };
  assert.notEqual(digestOf(moved), DIGESTS['universal-from-exhaustive-coverage'],
    'a changed obligation changes the fingerprint');
  // a renamed rule with identical requirements is also a different referent
  const renamed = { name: 'something-else', requires: ['COVERAGE'], version: '1' };
  assert.notEqual(digestOf(renamed), DIGESTS['universal-from-exhaustive-coverage']);
});

test('an unknown rule_id is refused: what it cannot resolve it cannot enforce', () => {
  const c = structuredClone(F4);
  c.derivation.rule_id = 'rule-this-runtime-never-admitted';
  const out = adapt(c);
  assert.equal(out.minted, false);
  assert.equal(out.stage, 'RULE');
  assert.equal(out.moved, false);
  assert.match(out.why, /not an admitted rule of this runtime/);
});

test('F1 — the Stage B scope defect now appears as a MISSING WITNESS', () => {
  // EXISTS over PROGRAM from FUNCTION evidence. The producer established no membership in PROGRAM,
  // so it emitted no MEMBERSHIP witness, and the rule requires one.
  assert.equal(F1.requested_claim.quantifier, 'EXISTS');
  assert.equal(F1.derivation.rule_id, 'existential-from-established-member');
  assert.deepEqual(F1.derivation.alternatives[0].relation_witnesses, []);
  const out = adapt(F1);
  assert.equal(out.minted, false);
  assert.match(out.why, /requires witnesses for MEMBERSHIP/);
  assert.equal(admit(F1).established, false);
});

test('a v1.1 certificate is now refused: it carries no rule identity', () => {
  const c = structuredClone(F4);
  c.contract_version = '1.1.0-frozen-2026-09-21';
  assert.match(readable(c), /this adapter consumes 1\.2\.0/);
  const noRule = structuredClone(F4);
  delete noRule.derivation.rule_id;
  assert.match(readable(noRule), /carries no rule identity/);
});

test('the registry is the runtime\'s, and the adapter reads requirements from nowhere else', () => {
  const src = readFileSync(new URL('./adapter.mjs', import.meta.url), 'utf8')
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.doesNotMatch(src, /requires:\s*\[/, 'the adapter never writes a requirements list');
  assert.doesNotMatch(src, /cert\.derivation\.requires|derivation\.requires/,
    'and never reads one from the certificate');
  assert.match(src, /resolveRule\(/, 'it resolves locally');
});
