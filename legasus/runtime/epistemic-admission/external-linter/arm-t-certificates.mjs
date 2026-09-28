// ARM T's certificate construction. Counted as ARM T's implementation effort: the repaired adapter
// builds certificates internally for its own use and does not export them, and it is committed and
// must not be modified during this run. B0 and B1 need none of this.
import { RULE, DOMAIN } from './adapter-eslint-repaired.mjs';
import { relationClaim }
  from '../authority-store.mjs';
import { ADMITTED_RULES, digestOf }
  from '../rules.mjs';

const CONTRACT = '1.4.0-frozen-2026-09-21';
const digest = (id) => digestOf(ADMITTED_RULES[id]);
const PREDICATE = 'the callback returns a value on every code path';

const covered = (rep) => !rep.conditions.excluded && !rep.conditions.ruleNotRun
  && !rep.conditions.analysisIncomplete && !rep.conditions.coverageIncomplete;
const conditionText = (rep) => Object.values(rep.conditions).join('; ');

export function certificatesFor(rep, file, world) {
  const dom = { name: world.claim_domain, contained_in: ['MODULE'] };
  const subject = file + ':callbacks';
  const ok = covered(rep);
  const clean = rep.findings.length === 0;
  const both = ok && clean;
  const ctx = { evidence_scope: world.claim_domain, repository: world.repository,
    claim_domain: world.claim_domain };
  const measurement = (ref, attribution) => ({ capability_demonstrated: true,
    positive_control: { fired: true, ref: 'eslint:rule-enabled' },
    observation: { ref, evidential_force: true, procedure: 'eslint ' + RULE + ' over ' + file,
      context: ctx, attribution },
    instrument: { name: 'eslint ' + RULE, version_digest: 'eslint-10.11.0' } });

  const coveragePredicate = relationClaim('COVERAGE', subject, world.claim_domain);
  const coverage = {
    contract_version: CONTRACT,
    requested_claim: { domain: dom, quantifier: 'POINTWISE', predicate: coveragePredicate },
    licensed_claim: ok ? { domain: dom, quantifier: 'POINTWISE', predicate: coveragePredicate } : null,
    licensed_relation: ok ? 'EQUIVALENT' : 'NONE',
    collateral_observations: [], frontier: ok ? [] : [conditionText(rep)],
    obligation: { passed: ok, unmet: ok ? [] : [conditionText(rep)],
      coverage: { [world.claim_domain]: ok ? 'EXHAUSTIVE' : 'PARTIAL' } },
    derivation: { passed: ok, open_frontier: ok ? null : conditionText(rep),
      rule_id: 'claim-from-direct-observation',
      rule_digest: digest('claim-from-direct-observation'),
      alternatives: [{ closed: ok, relation_witnesses: [],
        premises: [{ ref: subject, decidable_at_site: true, settled: ok }] }] },
    measurement: measurement('eslint:traversal', 'eslint ' + RULE + ' basis: ' + JSON.stringify(rep.basis)),
    run_floor: { instrument: 'eslint', emitted_ref: 'eslint:messages', run_id: file },
    provenance: { producer: 'arm-t', producer_digest: 'external', evidence_refs: [file],
      run_id: file + ':coverage', emitted_at: new Date(0).toISOString() },
  };

  const why = !ok ? conditionText(rep)
    : rep.findings.map((f) => f.ruleId + ' at line ' + f.line + ': ' + f.message).join('; ');
  const universal = {
    contract_version: CONTRACT,
    requested_claim: { domain: dom, quantifier: 'FOR_ALL', predicate: PREDICATE },
    licensed_claim: both ? { domain: dom, quantifier: 'FOR_ALL', predicate: PREDICATE } : null,
    licensed_relation: both ? 'EQUIVALENT' : 'NONE',
    collateral_observations: [], frontier: both ? [] : [why],
    obligation: { passed: both, unmet: both ? [] : [why],
      coverage: { [world.claim_domain]: ok ? 'EXHAUSTIVE' : 'PARTIAL' } },
    derivation: { passed: both, open_frontier: both ? null : why,
      rule_id: 'universal-from-exhaustive-coverage',
      rule_digest: digest('universal-from-exhaustive-coverage'),
      alternatives: [{ closed: both,
        premises: [{ ref: subject, decidable_at_site: true, settled: both }],
        relation_witnesses: [{ relation: 'COVERAGE', subject, object: world.claim_domain,
          domain: world.claim_domain, evidence_root: null,
          provenance: 'eslint traversal of ' + file }] }] },
    measurement: measurement('eslint:messages',
      'eslint ' + RULE + ' reported ' + rep.findings.length + ' finding(s)'),
    run_floor: { instrument: 'eslint', emitted_ref: 'eslint:messages', run_id: file },
    provenance: { producer: 'arm-t', producer_digest: 'external', evidence_refs: [file],
      run_id: file, emitted_at: new Date(0).toISOString() },
  };
  return { coverage, universal };
}
