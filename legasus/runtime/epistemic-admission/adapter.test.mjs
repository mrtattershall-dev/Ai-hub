// STEP 6/7 — the first real consumer, and the ABLATION that makes each gate load-bearing.
//
// The standard is not "it works". It is: with the integration enabled a fully supported claim is
// admitted, and removing ANY ONE of the three evidence kinds makes admission impossible - each for
// its own reason, through the calculus's own refusal rather than through a check in this file.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { adapt, readable, carriesAuthorityShape, CONTRACT_VERSION } from './adapter.mjs';
import { admit, store, STATE } from './admission.mjs';
import { isAuthority, KIND } from '../../legaknow/calculus.mjs';
import { deps } from './_test-support.mjs';

const DIR = new URL('./fixtures/', import.meta.url);
const NAMES = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
const load = (n) => JSON.parse(readFileSync(new URL(n + '.json', DIR), 'utf8'));
const CERTS = Object.fromEntries(NAMES.map((n) => [n, load(n)]));

// A FULLY SUPPORTED certificate: all three gates pass and the request is licensed.
const SUPPORTED = 'F4';

test('the admission table, printed so the record carries it', () => {
  console.log('\n' + 'cert'.padEnd(6) + 'vector'.padEnd(9) + 'licensed'.padEnd(12)
    + 'state'.padEnd(16) + 'why');
  for (const n of NAMES) {
    const c = CERTS[n];
    const v = ['O', 'D', 'M'].map((g) => (c.frontier.some((f) => f.gate === g) ? 'F' : 'P')).join('');
    const r = admit(c, deps(c));
    console.log(n.padEnd(6) + v.padEnd(9) + String(c.licensed_relation).padEnd(12)
      + r.state.padEnd(16) + r.why.slice(0, 68));
  }
  console.log();
});

test('the fully supported certificate is ADMITTED, and the token is real', () => {
  const r = admit(CERTS[SUPPORTED], deps(CERTS[SUPPORTED]));
  assert.equal(r.state, STATE.ESTABLISHED, r.why);
  assert.equal(r.established, true);
  const out = adapt(CERTS[SUPPORTED], deps(CERTS[SUPPORTED]));
  assert.equal(isAuthority(out.token), true, 'a genuine branded token, not an object this file built');
  assert.equal(out.token.kind, KIND.EPISTEMIC);
  assert.deepEqual(out.token.grant, [], 'epistemic authority carries no grant');
  assert.equal(out.token.constructor, 'DERIVE');
  assert.ok(out.token.ancestry.length, 'and it carries its ancestry');
});

// ---------------------------------------------------------------------------------------------------
// THE ABLATION. Each removal is of EVIDENCE in the certificate, never of a check in this code.

test('ABLATE M — remove the observation evidence: OBSERVE cannot mint, so nothing is admitted', () => {
  const c = structuredClone(CERTS[SUPPORTED]);
  c.measurement.observation.evidential_force = false;      // the observer did not observe
  const out = adapt(c, deps(c));
  assert.equal(out.minted, false);
  assert.equal(out.stage, 'OBSERVE');
  assert.match(out.why, /Authority cannot be inferred from its own absence/);
  assert.equal(admit(c, deps(c)).state, STATE.OBSERVED, 'the run floor survives; the subject claim does not');
  assert.equal(admit(c, deps(c)).established, false);

  // and the same through the OTHER M route: provenance the certificate cannot supply
  const d = structuredClone(CERTS[SUPPORTED]);
  d.measurement.observation.attribution = null;
  const out2 = adapt(d, deps(d));
  assert.equal(out2.minted, false);
  assert.equal(out2.reason, 'PROVENANCE_INCOMPLETE');
  assert.equal(admit(d, deps(d)).established, false);
});

test('ABLATE D — open a required premise: DERIVE is not attempted and the frontier is preserved', () => {
  const c = structuredClone(CERTS[SUPPORTED]);
  for (const a of c.derivation.alternatives) { a.closed = false; a.premises[0].settled = false; }
  c.derivation.passed = false;
  c.derivation.open_frontier = 'premise 0 is not settled';
  const out = adapt(c, deps(c));
  assert.equal(out.minted, false);
  assert.equal(out.stage, 'DERIVE');
  assert.ok(isAuthority(out.observationToken), 'the OBSERVATION still minted - only the derivation failed');
  const r = admit(c, deps(c));
  assert.equal(r.state, STATE.FRONTIER_OPEN);
  assert.equal(r.established, false);
  assert.match(r.why, /premise 0 is not settled/, 'what blocks closure is preserved, not discarded');
});

test('ABLATE O — break the claim relation: a token mints and the REQUEST is still not established', () => {
  // This is the ablation that matters most, because the derivation is untouched and sound.
  const c = structuredClone(CERTS[SUPPORTED]);
  c.licensed_claim = null;
  c.licensed_relation = 'NONE';
  const out = adapt(c, deps(c));
  assert.equal(isAuthority(out.token), true, 'the calculus still mints: the evidence is fine');
  const r = admit(c, deps(c));
  assert.equal(r.established, false, 'and the claim is STILL not admitted');
  assert.equal(r.state, STATE.CANDIDATE);
  assert.match(r.why, /the REQUEST is not established/);
  // narrowed and observational knowledge remains available - nothing is thrown away
  assert.ok(r.floor, 'the run floor survives an O failure');
  assert.ok(Array.isArray(r.collateral), 'collateral observations survive an O failure');
});

test('all three present — the supported claim is admitted; each removal alone prevents it', () => {
  const base = admit(CERTS[SUPPORTED], deps(CERTS[SUPPORTED]));
  assert.equal(base.established, true);
  const ablations = {
    M: (c) => { c.measurement.observation.evidential_force = false; },
    D: (c) => { for (const a of c.derivation.alternatives) a.closed = false; },
    O: (c) => { c.licensed_claim = null; c.licensed_relation = 'NONE'; },
  };
  for (const [gate, mutate] of Object.entries(ablations)) {
    const c = structuredClone(CERTS[SUPPORTED]);
    mutate(c);
    assert.equal(admit(c, deps(c)).established, false, 'removing ' + gate + ' alone must prevent admission');
  }
});

// ---------------------------------------------------------------------------------------------------
// THE TWO CHEATS THE DESIGN EXISTS TO PREVENT

test('CHEAT 1 — a perfectly formed certificate mints NOTHING by being well formed', () => {
  // Hand-built, schema-shaped, and claiming everything. No constructor succeeds, so no token exists.
  const forged = structuredClone(CERTS[SUPPORTED]);
  forged.measurement.observation.evidential_force = false;
  forged.measurement.capability_demonstrated = true;
  forged.obligation.passed = true;
  forged.derivation.passed = true;
  assert.equal(readable(forged), null, 'it is perfectly readable');
  assert.equal(adapt(forged, deps(forged)).minted, false, 'and still mints nothing');
  assert.equal(admit(forged, deps(forged)).established, false);
});

test('CHEAT 2 — a certificate that carries authority shape is refused UNREAD, at any depth', () => {
  for (const path of [['authorized'], ['authority'], ['grant'], ['isAuthority'],
    ['requested_claim', 'token'], ['measurement', 'observation', 'permission']]) {
    const c = structuredClone(CERTS[SUPPORTED]);
    let cur = c;
    for (const k of path.slice(0, -1)) cur = cur[k];
    cur[path[path.length - 1]] = true;
    assert.ok(carriesAuthorityShape(c), path.join('.') + ' must be detected');
    const out = adapt(c, deps(c));
    assert.equal(out.minted, false, path.join('.'));
    assert.equal(out.stage, 'READ');
    assert.match(out.why, /application for authority and never authority/);
  }
});

test('an older certificate is refused: a version this adapter cannot check it must not read', () => {
  // Asserted against the adapter's OWN declared version rather than a literal, so this test does not
  // go stale every time the contract moves - which is exactly how it failed on the v1.2 bump.
  for (const older of ['1.0.0-frozen-2026-09-21', '1.1.0-frozen-2026-09-21']) {
    const c = structuredClone(CERTS[SUPPORTED]);
    c.contract_version = older;
    assert.match(readable(c), new RegExp('this adapter consumes ' + CONTRACT_VERSION.split('-')[0]),
      older);
    assert.equal(adapt(c, deps(c)).minted, false, older);
  }
});

test('the store admits only what admit() passes', () => {
  const s = store();
  s.offer(CERTS[SUPPORTED], deps(CERTS[SUPPORTED]));
  for (const n of NAMES.filter((x) => x !== SUPPORTED)) s.offer(CERTS[n], deps(CERTS[n]));
  assert.equal(s.established.length, 1, 'exactly the one supported certificate entered the store');
  assert.equal(s.established[0].claim.predicate, CERTS[SUPPORTED].licensed_claim.predicate);
});

// ---------------------------------------------------------------------------------------------------
// INDEPENDENCE, asserted structurally rather than promised in a comment.

test('the adapter imports no semantic bridge, and builds no token of its own', () => {
  // CODE, not prose. The first version of this test scanned raw text and failed on the adapter's own
  // comment explaining that it does NOT call delegate - a measure seeing the wrong thing, which is
  // the failure this whole line of work is about. Comments are stripped before asserting.
  // `\r` is stripped FIRST. JS `.` does not match \r, so on a CRLF file `//.*$` cannot reach
  // end-of-string and the comment TEXT survives with only the `//` removed - which made this test
  // match `commit(` inside admission.mjs's own comment saying commit is not a consumer here.
  // Fifth instance in this sequence of a measure reading something other than what it meant to.
  const strip = (s) => s.replace(/\r/g, '').split('\n')
    .map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  const src = strip(readFileSync(new URL('./adapter.mjs', import.meta.url), 'utf8'));
  const adm = strip(readFileSync(new URL('./admission.mjs', import.meta.url), 'utf8'));

  assert.doesNotMatch(src, /legascreen/, 'the research instrument must not migrate into runtime');
  assert.doesNotMatch(src, /readProduction|readSpecification/, 'bridge readers must not be reused');
  assert.doesNotMatch(src, /\bdelegate\s*\(/, 'no permission is originated here');
  assert.doesNotMatch(src, /import[^;]*\bdelegate\b/, 'delegate is not even imported');
  assert.doesNotMatch(src, /\bcommit\s*\(/, 'commit consumes NORMATIVE authority and is not a consumer here');
  assert.doesNotMatch(src, /attribution:\s*['"`]/, 'attribution must never be synthesized');
  // the only calculus entry points it uses
  const calls = [...src.matchAll(/\b(observe|derive|delegate|commit|token)\s*\(/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(calls)].sort(), ['derive', 'observe'],
    'observe() and derive() are the only constructors called; got ' + [...new Set(calls)]);

  assert.doesNotMatch(adm, /legascreen/);
  assert.doesNotMatch(adm, /\b(observe|derive|delegate|commit)\s*\(/,
    'the consumer does not call constructors itself - it asks whether authority covers the action');
});

test('every fixture is the frozen contract version', () => {
  for (const n of NAMES) assert.equal(CERTS[n].contract_version, CONTRACT_VERSION, n);
});
