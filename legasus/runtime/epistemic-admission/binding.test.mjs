// W1..W5 — a relation NAME is not a relation INSTANCE.
//
// Predictions frozen in WITNESS-BINDING_PREREG.md. The registry stays at three rules; the matchers
// constrain EXISTING obligations and introduce none. legaknow is not modified.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { adapt, bindingContext, CONTRACT_VERSION } from './adapter.mjs';
import { admit, STATE } from './admission.mjs';
import { ADMITTED_RULES, DIGESTS, bindWitnesses, digestOf } from './rules.mjs';
import { isAuthority } from '../../legaknow/calculus.mjs';

const F4 = JSON.parse(readFileSync(new URL('./fixtures/F4.json', import.meta.url), 'utf8'));
const witnessesOf = (c) => c.derivation.alternatives[0].relation_witnesses;
const coverageOf = (c) => witnessesOf(c).find((w) => w.relation === 'COVERAGE');

// The producer emits BOTH a COVERAGE and a MEMBERSHIP candidate for F4; only COVERAGE is required by
// universal-from-exhaustive-coverage, so MEMBERSHIP is an offered candidate the rule does not need.
test('setup — F4 carries witness INSTANCES, and the rule needs exactly one of them', () => {
  assert.equal(F4.contract_version, CONTRACT_VERSION);
  const w = coverageOf(F4);
  assert.equal(w.domain, F4.requested_claim.domain.name);
  assert.equal(w.subject, F4.derivation.alternatives[0].premises[0].ref);
  assert.ok(w.evidence_root, 'it roots in something');
  assert.deepEqual([...ADMITTED_RULES['universal-from-exhaustive-coverage'].requires], ['COVERAGE']);
});

test('W1 — correct relation, correct domain and endpoints: ACCEPTED', () => {
  const out = adapt(F4);
  assert.equal(isAuthority(out.token), true, out.why);
  assert.deepEqual(out.bound, ['COVERAGE']);
  assert.equal(admit(F4).state, STATE.ESTABLISHED);
});

test('W2 — same relation NAME, wrong claim domain: REFUSED, naming the binding', () => {
  // This is the v1.2 specimen. The witness still says COVERAGE; it is simply about another world.
  const c = structuredClone(F4);
  c.requested_claim.domain.name = 'A_DOMAIN_NEVER_COVERED';
  const out = adapt(c);
  assert.equal(out.minted, false, 'B-2 REGRESSION: the recorded defect must no longer reproduce');
  assert.equal(out.stage, 'DERIVE');
  assert.deepEqual(out.missing, ['COVERAGE']);
  const why = out.unbound.map((u) => u.why).join(' | ');
  assert.match(why, /covers "SAMPLE" and the claim is over "A_DOMAIN_NEVER_COVERED"/);
  assert.match(why, /does not cover this one/);
  assert.equal(admit(c).established, false);
});

test('W3 — correct domain, no established evidence: REFUSED', () => {
  const c = structuredClone(F4);
  coverageOf(c).evidence_root = null;
  const out = adapt(c);
  assert.equal(out.minted, false);
  assert.deepEqual(out.missing, ['COVERAGE']);
  assert.match(out.unbound.map((u) => u.why).join(' | '),
    /no evidence_root: it asserts coverage without rooting in anything/);
});

test('W4 — same relation and evidence, bound to a different subject: REFUSED', () => {
  const c = structuredClone(F4);
  coverageOf(c).subject = 'some:other:derivation:premise0';
  const out = adapt(c);
  assert.equal(out.minted, false);
  assert.deepEqual(out.missing, ['COVERAGE']);
  assert.match(out.unbound.map((u) => u.why).join(' | '),
    /is not a premise of this derivation/);
});

test('W5 ANTI-REFUSAL — a legitimate witness with all bindings is still ACCEPTED', () => {
  // Without this the repair "no witness ever satisfies anything" passes W2-W4 perfectly.
  const c = structuredClone(F4);
  const prem = c.derivation.alternatives[0].premises[0].ref;
  c.derivation.alternatives[0].relation_witnesses = [{
    relation: 'COVERAGE', subject: prem, object: 'SAMPLE', domain: 'SAMPLE',
    evidence_root: 'a-different-but-real-evidence-root',
    provenance: 'hand-written in the test, with every binding present',
  }];
  const out = adapt(c);
  assert.equal(isAuthority(out.token), true, 'a fully bound witness must still satisfy: ' + out.why);
  assert.equal(admit(c).established, true);
});

test('the matcher belongs to the RULE, and a producer has no field to assert satisfaction', () => {
  const rule = ADMITTED_RULES['universal-from-exhaustive-coverage'];
  assert.equal(typeof rule.obligations[0].satisfiedBy, 'function', 'the rule owns the matcher');
  const ctx = bindingContext(F4, 0);
  // a candidate carrying its own claim of satisfaction changes nothing: the matcher never reads it
  const forged = { ...coverageOf(F4), domain: 'ELSEWHERE', satisfies: true, binds: true };
  const { satisfied, rejected } = bindWitnesses(rule, [forged], ctx);
  assert.equal(satisfied.length, 0, 'asserting satisfaction does not produce it');
  assert.match(rejected[0].why, /and the claim is over/);
  // and the schema has no such field at all
  const schema = JSON.parse(readFileSync(
    new URL('../../contracts/entitlement-certificate.v1.3.schema.json', import.meta.url), 'utf8'));
  assert.equal(schema.$defs.relationWitness.additionalProperties, false);
  for (const k of ['satisfies', 'satisfied', 'binds', 'accepted']) {
    assert.ok(!(k in schema.$defs.relationWitness.properties), k + ' must not exist');
  }
});

test('B-3 DRIFT covers SEMANTICS — changing a matcher moves the digest', () => {
  const rule = ADMITTED_RULES['universal-from-exhaustive-coverage'];
  const laxer = { ...rule, obligations: [{ relation: 'COVERAGE', satisfiedBy: (w) => (w.relation === 'COVERAGE' ? null : 'no') }] };
  assert.notEqual(digestOf(laxer), DIGESTS['universal-from-exhaustive-coverage'],
    'a rule that requires the same relation but SATISFIES it more loosely is a different rule');
  // and a v1.2-pinned certificate is refused outright
  const c = structuredClone(F4);
  c.derivation.rule_digest = '018abb658b2d297384410a5f073deaa8e34ffc07b1bf41b974bfefa7ae0d2f7d';
  const out = adapt(c);
  assert.equal(out.stage, 'RULE');
  assert.equal(out.moved, true);
});

test('B-4 — the calculus is not modified for any of this', () => {
  // FOURTH TIME a source scan in this sequence read PROSE as CODE: the first version of this test
  // matched the word "legaknow" inside rules.mjs's own comment saying legaknow is not modified.
  // Whether a file changed is settled by git, not by grepping the file that talks about it.
  const src = readFileSync(new URL('./rules.mjs', import.meta.url), 'utf8')
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.doesNotMatch(src, /import .*legaknow/, 'the registry does not import the kernel');
  assert.doesNotMatch(src, /from ['"].*legaknow/, 'nor reach into it by path');
  // the authoritative check is the diff, asserted in BIND-WITNESS_RESULT.md and reproduced here
  const diff = execSync('git diff --name-only HEAD -- legasus/legaknow/',
    { cwd: new URL('../../../', import.meta.url).pathname.replace(/^\//, ''), encoding: 'utf8' });
  assert.equal(diff.trim(), '', 'legaknow must be byte-unchanged; git says: ' + diff);
});
