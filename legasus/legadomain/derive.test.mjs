// LEGADOMAIN — the six controls that must hold before this layer receives any authority.
//
//   1  DOMAIN-RELEVANT POSITIVE   same local operation, different declared domains, different contracts
//   2  DOMAIN-IRRELEVANT NEGATIVE changing the domain must change NOTHING where it has no bearing
//   3  REPOSITORY OVERRIDE        repository evidence defeats a domain default
//   4  UNKNOWN                    insufficient knowledge yields UNKNOWN, never a generic best practice
//   5  POLICY SEPARATION          a subjective objective needs a named owner to enter the contract
//   6  SEMANTIC LEAST PRIVILEGE   rich domain truth stays internal; the prompt gets only the residue
//
// Controls 4, 5 and 6 are the ones that stop this becoming a plausible-sounding oracle. The first three
// only show it can say something; those three show it knows what it is not entitled to say.
import test from 'node:test';
import assert from 'node:assert';
import { AUTHORITY } from './authority.mjs';
import { deriveObligations, projectForProposal, verificationRequirements } from './derive.mjs';

const TASK = { requirements: [] };
const subjects = (xs) => xs.map((o) => o.subject).sort();

test('CONTROL 1 — the same operation under different declared domains yields different contracts', () => {
  const game = deriveObligations({ task: TASK, domain: 'GAME', operation: 'SAVE' });
  const biz = deriveObligations({ task: TASK, domain: 'BUSINESS', operation: 'SAVE' });

  assert.ok(subjects(game.obligations).includes('persist:progression'));
  assert.ok(subjects(biz.obligations).includes('persist:durable_record'));
  assert.notDeepEqual(subjects(game.obligations), subjects(biz.obligations),
    'SAVE means different things, and the word alone does not say which');

  // And both derive PROHIBITIONS, which is the part syntax cannot supply at all.
  assert.ok(subjects(game.prohibitions).includes('persist:renderer_handles'));
  assert.ok(subjects(biz.prohibitions).includes('persist:form_ui_state'));
});

test('CONTROL 2 — changing the domain changes NOTHING where the domain has no bearing', () => {
  const a = deriveObligations({ task: TASK, domain: 'GAME', operation: 'CLAMP_NUMERIC_RANGE' });
  const b = deriveObligations({ task: TASK, domain: 'BUSINESS', operation: 'CLAMP_NUMERIC_RANGE' });
  assert.equal(a.domainRelevant, false);
  assert.equal(b.domainRelevant, false);
  assert.deepEqual(a.obligations, b.obligations);
  assert.deepEqual(a.prohibitions, b.prohibitions);
  assert.equal(a.obligations.length, 0,
    'an operation the domain does not touch must acquire no domain obligations at all');
});

test('CONTROL 3 — repository evidence DEFEATS a domain default', () => {
  // The domain says inventory is normally persisted. THIS game deliberately does not persist it.
  const observed = [{ subject: 'persist:inventory', requirement: 'MUST_NOT_PERSIST',
    source: 'roguelike_run_reset', why: 'this program discards inventory between runs, by design' }];
  const d = deriveObligations({ task: TASK, programFacts: observed, domain: 'GAME', operation: 'SAVE' });

  assert.ok(subjects(d.prohibitions).includes('persist:inventory'),
    'games usually do X must not override this game intentionally does Y');
  assert.ok(!subjects(d.obligations).includes('persist:inventory'));

  const held = d.prohibitions.find((o) => o.subject === 'persist:inventory');
  assert.equal(held.authority, AUTHORITY.REPOSITORY_FACT);
  assert.ok(held.defeated && held.defeated.length === 1, 'and the defeated default is RECORDED');
  assert.equal(held.defeated[0].authority, AUTHORITY.DOMAIN_DEFAULT);
});

test('CONTROL 3b — the TASK outranks even a domain INVARIANT, and the override is recorded', () => {
  const task = { requirements: [{ subject: 'persist:frame_cache', requirement: 'MUST_PERSIST',
    why: 'this tool deliberately snapshots the frame cache for a replay debugger' }] };
  const d = deriveObligations({ task, domain: 'GAME', operation: 'SAVE' });
  const held = [...d.obligations, ...d.prohibitions].find((o) => o.subject === 'persist:frame_cache');
  assert.equal(held.authority, AUTHORITY.TASK_SPECIFICATION);
  assert.equal(held.requirement, 'MUST_PERSIST');
  assert.ok(held.defeated.some((x) => x.authority === AUTHORITY.DOMAIN_INVARIANT));
});

test('CONTROL 4 — insufficient knowledge yields UNKNOWN, not a generic best practice', () => {
  const d = deriveObligations({ task: TASK, domain: 'EMBEDDED_FIRMWARE', operation: 'SAVE' });
  assert.equal(d.obligations.length, 0);
  assert.equal(d.prohibitions.length, 0);
  assert.equal(d.unknowns.length, 1);
  assert.equal(d.unknowns[0].authority, AUTHORITY.UNKNOWN);
  assert.match(d.unknowns[0].why, /No generic best practice is substituted/);

  // A declared domain that simply says nothing about THIS operation behaves the same way.
  const d2 = deriveObligations({ task: TASK, domain: 'GAME', operation: 'MIGRATE_SCHEMA' });
  assert.equal(d2.obligations.length, 0);
  assert.equal(d2.unknowns.length, 1);
});

test('CONTROL 5 — a subjective objective is INERT until an owner declares it', () => {
  const without = deriveObligations({ task: TASK, domain: 'GAME', operation: 'SAVE' });
  const allSubjects = [...without.obligations, ...without.prohibitions, ...without.other]
    .map((o) => o.subject);
  assert.ok(!allSubjects.includes('save:interval'),
    'autosave every five minutes is a product decision and may not enter a contract by itself');
  assert.ok(without.inert.some((i) => i.subject === 'save:interval'
    && /named owner/.test(i.reason)));

  // Give it an owner and it becomes a bounded, attributable obligation.
  const withOwner = deriveObligations({ task: TASK, domain: 'GAME', operation: 'SAVE',
    policyOwners: { 'save:interval': 'GAME_MOBILE_RESOURCE_POLICY' } });
  const adopted = withOwner.other.find((o) => o.subject === 'save:interval');
  assert.ok(adopted, 'an owned policy may enter');
  assert.equal(adopted.authority, AUTHORITY.DOMAIN_POLICY);
  assert.equal(adopted.owner, 'GAME_MOBILE_RESOURCE_POLICY');
  // And the unowned one beside it stays out.
  assert.ok(withOwner.inert.some((i) => i.subject === 'save:size'));
});

test('CONTROL 6 — SEMANTIC LEAST PRIVILEGE: rich internally, minimal to PROPOSE', () => {
  const d = deriveObligations({ task: TASK, domain: 'GAME', operation: 'SAVE' });
  const internal = [...d.obligations, ...d.prohibitions];
  assert.ok(internal.length >= 4, 'the contract is rich');

  // This particular proposal only writes the progression field.
  const p = projectForProposal(d, { handles: ['persist:progression'] });
  assert.deepEqual(subjects(p.included), ['persist:progression']);
  assert.ok(p.withheld.length >= 3, 'everything else is withheld');
  for (const w of p.withheld) {
    assert.ok(w.reason && w.reason.length > 10, 'and every withholding states a reason: ' + w.subject);
  }

  // The facts withheld are TRUE and RELEVANT. That is the point: relevant does not mean revealable.
  assert.ok(p.withheld.some((w) => w.subject === 'persist:renderer_handles'));

  // PROVE, by contrast, gets everything.
  const checks = verificationRequirements(d);
  assert.ok(checks.length >= internal.length,
    'the verifier is not subject to the projection - it must see the whole contract');
  assert.ok(checks.some((c) => c.subject === 'persist:renderer_handles' && c.check === 'ABSENT_AFTER_SAVE'));
});

test('the projection is not vacuous — a proposal that touches more is told more', () => {
  // A projection that always returned nothing would pass control 6 and be useless.
  const d = deriveObligations({ task: TASK, domain: 'BUSINESS', operation: 'SAVE' });
  const narrow = projectForProposal(d, { handles: ['persist:ownership'] });
  const wide = projectForProposal(d, { handles: ['persist:ownership', 'persist:audit_state',
    'persist:cached_view'] });
  assert.equal(narrow.included.length, 1);
  assert.equal(wide.included.length, 3);
  assert.ok(wide.withheld.length < narrow.withheld.length);
});

test('EQUAL-AUTHORITY DISAGREEMENT is a conflict, never a silent merge', () => {
  const facts = [
    { subject: 'persist:ownership', requirement: 'MUST_PERSIST', source: 'module A' },
    { subject: 'persist:ownership', requirement: 'MUST_NOT_PERSIST', source: 'module B' },
  ];
  const d = deriveObligations({ task: TASK, programFacts: facts, domain: 'BUSINESS', operation: 'SAVE' });
  assert.equal(d.conflicts.length, 1);
  assert.match(d.conflicts[0].why, /nothing here is entitled to pick/);
});

test('NEGATIVE CONTROL — a layer that derived nothing would pass most of this suite', () => {
  // So the positive side is asserted explicitly: GAME/SAVE must produce obligations AND prohibitions that
  // no amount of reading the function signature could supply.
  const d = deriveObligations({ task: TASK, domain: 'GAME', operation: 'SAVE' });
  assert.ok(d.obligations.length >= 2);
  assert.ok(d.prohibitions.length >= 2);
  assert.equal(d.domainRelevant, true);
});
