// I-1..I-5 — the installed closure fingerprints, checked BEHAVIOURALLY.
//
// Predictions frozen in INSTALL-FINGERPRINTS_PREREG.md. The checkpoint is "identity tracking
// changed; inference behaviour did not", so I-2 compares verdicts against a snapshot taken before
// the change rather than asserting that the new hashes exist.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { DIGESTS, UNPINNABLE, ADMITTED_RULES, legacyDigestOf, resolveRule } from './rules.mjs';
import { fingerprintOf } from './fingerprint.mjs';
import { adapt } from './adapter.mjs';
import { admit } from './admission.mjs';
import { deps } from './_test-support.mjs';
import { snapshot } from './behaviour-snapshot.mjs';

// THE BASELINE, captured by running behaviour-snapshot.mjs BEFORE rules.mjs was changed. Recorded
// here as data so the comparison is against what the runtime actually did, not a remembered claim.
const BASELINE = {
  F1: { state: 'FRONTIER_OPEN', established: false, stage: 'DERIVE', licensed: 'NONE',
    bound: null, rule: 'existential-from-established-member' },
  F2: { state: 'FRONTIER_OPEN', established: false, stage: 'DERIVE', licensed: 'NONE',
    bound: null, rule: null },
  F3: { state: 'OBSERVED', established: false, stage: 'OBSERVE', licensed: 'NONE',
    bound: null, rule: null },
  F3p: { state: 'OBSERVED', established: false, stage: 'OBSERVE', licensed: 'NONE',
    bound: null, rule: null },
  F4: { state: 'ESTABLISHED', established: true, stage: null, licensed: 'EQUIVALENT',
    bound: 'COVERAGE', rule: 'universal-from-exhaustive-coverage' },
  F5: { state: 'OBSERVED', established: false, stage: 'OBSERVE', licensed: 'NONE',
    bound: null, rule: null },
};

const MODULES = [
  ...['rules.mjs', 'authority-store.mjs'].map((f) => ({ path: f,
    source: readFileSync(new URL('./' + f, import.meta.url), 'utf8') })),
  ...['calculus.mjs', 'observation.mjs'].map((f) => ({ path: 'legaknow/' + f,
    source: readFileSync(new URL('../../legaknow/' + f, import.meta.url), 'utf8') })),
];

test('the installed identities, and which moved', () => {
  console.log('');
  for (const [id, d] of Object.entries(DIGESTS)) {
    const old = legacyDigestOf(ADMITTED_RULES[id]);
    console.log('  ' + id.padEnd(38) + d.slice(0, 14) + '  moved=' + (d !== old));
  }
  console.log('');
});

test('I-1 — a certificate pinned to the LEGACY identity is refused, never falls back', () => {
  const cert = JSON.parse(readFileSync(new URL('./fixtures/F4.json', import.meta.url), 'utf8'));
  cert.derivation.rule_digest = legacyDigestOf(ADMITTED_RULES['universal-from-exhaustive-coverage']);
  const out = adapt(cert, deps(cert));
  assert.equal(out.minted, false);
  assert.equal(out.stage, 'RULE');
  assert.equal(out.moved, true);
  assert.equal(admit(cert, deps(cert)).established, false);
});

test('I-2 — after the explicit re-pin, EVERY verdict is what it was before installation', () => {
  // The checkpoint. Identity tracking changed; inference behaviour did not.
  const now = snapshot({ repin: false });   // the fixtures carry the producer's own re-pinned values
  for (const k of Object.keys(BASELINE)) {
    assert.deepEqual(now[k], BASELINE[k], k + ' changed: ' + JSON.stringify(now[k]));
  }
});

test('I-3 — a SEMANTIC dependency change still moves the installed identity', () => {
  const rule = ADMITTED_RULES['universal-from-exhaustive-coverage'];
  const before = fingerprintOf(rule, MODULES);
  const mutated = MODULES.map((m) => (m.path !== 'authority-store.mjs' ? m : { ...m,
    source: m.source.replace('c.examined < ctx.requiredExtent', 'c.examined !== ctx.requiredExtent') }));
  assert.notEqual(mutated[1].source, MODULES[1].source, 'the mutation applied');
  const after = fingerprintOf(rule, mutated);
  assert.equal(after.ok, true, after.why);
  assert.notEqual(after.digest, before.digest);
  assert.equal(before.digest, DIGESTS['universal-from-exhaustive-coverage'],
    'and the unmutated fingerprint is the one actually installed');
});

test('I-4 — an IRRELEVANT change leaves every installed identity byte-identical', () => {
  // a comment edit, and a change to a function nothing in any closure calls
  const mutated = MODULES.map((m) => (m.path !== 'rules.mjs' ? m : { ...m,
    source: m.source.replace('// THE ADMITTED RULE REGISTRY', '// THE ADMITTED RULE REGISTRY (edited)')
      .replace('export const RULE_MOVED = ', 'export const UNUSED_HELPER = () => 1;\nexport const RULE_MOVED = ') }));
  assert.notEqual(mutated[0].source, MODULES[0].source, 'the mutation applied');
  for (const [id, rule] of Object.entries(ADMITTED_RULES)) {
    const f = fingerprintOf(rule, mutated);
    assert.equal(f.ok, true, f.why);
    assert.equal(f.digest, DIGESTS[id], id + ' moved on an irrelevant change');
  }
});

test('I-5 — a rule whose closure is UNRESOLVED cannot be pinned, and resolveRule REFUSES it', () => {
  assert.deepEqual(UNPINNABLE, {}, 'all three rules currently resolve');
  // and the refusal path exists rather than being hypothetical: a rule id with no identity
  const r = resolveRule({ rule_id: 'rule-with-no-identity', rule_digest: 'x'.repeat(64) });
  assert.equal(r.ok, false);
  assert.match(r.why, /not an admitted rule of this runtime/);
  // the UNPINNABLE branch itself, exercised through fingerprintOf's own refusal
  const opaque = [{ path: 'o.mjs',
    source: 'import { mystery } from \'ext\';\nfunction m(w) { return mystery(w); }\n' }];
  const f = fingerprintOf({ name: 'x', version: '1',
    obligations: [{ relation: 'R', satisfiedBy: new Function('w', 'return m(w);') }] }, opaque);
  assert.equal(f.ok, false);
  assert.equal(f.digest, undefined, 'no identity is produced for an unresolvable rule');
});

test('the legacy digest is retained ONLY to show the migration, and is not consulted', () => {
  const src = readFileSync(new URL('./rules.mjs', import.meta.url), 'utf8')
    .replace(/\r/g, '').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.match(src, /export const legacyDigestOf/);
  assert.doesNotMatch(src, /legacyDigestOf\(/, 'nothing in the registry calls it');
});
