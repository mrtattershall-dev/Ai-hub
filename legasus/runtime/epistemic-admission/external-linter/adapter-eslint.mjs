// TRANSLATION: one external obligation (eslint `array-callback-return`) into a Legasus certificate.
//
// The obligation, in the linter's words: "Enforce return statements in callbacks of array methods".
// As a claim: FOR ALL callbacks passed to array methods in this module, the callback returns a value
// on every code path.
//
// WHAT THE LINTER GIVES US
//   - it visits every array-method callback in the file (its traversal is exhaustive over the file)
//   - it reports a machine-readable finding per violating callback: ruleId + line + message
//   - silence means: visited, and no violation found
//
// WHAT LEGASUS NEEDS, and this is the whole translation
//   - a UNIVERSAL claim over a domain
//   - a COVERAGE witness rooted in established authority that the domain was covered exhaustively
//   - a derivation whose premises are settled and decidable
//
// EVERY PLACE A HUMAN CHOSE SOMETHING THE FROZEN RULES DID NOT DETERMINE IS MARKED `STEERING:`.
import { ESLint } from 'eslint';
import { adapt } from '../adapter.mjs';
import { admit, STATE } from '../admission.mjs';
import { store, relationClaim } from '../authority-store.mjs';
import { ADMITTED_RULES, digestOf } from '../rules.mjs';

// TRANSLATION OBSTACLE 1, recorded rather than smoothed over.
//
// The first attempt left rule_digest null and the runtime refused outright:
//   "derivation carries no rule identity. A derivation whose rule this runtime cannot resolve is
//    one whose obligations it cannot enforce."
//
// That refusal is CORRECT, and it says something structural about plugging in an external verifier:
// eslint has no idea what a Legasus rule digest is and can never supply one. So the ADAPTER supplies
// it - which means THE ADAPTER IS THE PRODUCER and eslint is the INSTRUMENT. The external tool does
// not become a Legasus producer by being wrapped; something on this side takes responsibility for
// rule identity, and that something is code I wrote.
const digest = (id) => digestOf(ADMITTED_RULES[id]);

const RULE = 'array-callback-return';
// STEERING 1: the domain name. The linter has no notion of a domain; I named one.
const DOMAIN = 'ARRAY_METHOD_CALLBACKS_IN_MODULE';
// STEERING 2: the predicate wording. Taken from the rule's own description, lightly reworded.
const PREDICATE = 'the callback returns a value on every code path';

export async function lint(file) {
  const eslint = new ESLint({ overrideConfigFile: true,
    overrideConfig: { rules: { [RULE]: 'error' } } });
  const [r] = await eslint.lintFiles([file]);
  return { file, findings: r.messages.filter((m) => m.ruleId === RULE)
    .map((m) => ({ ruleId: m.ruleId, line: m.line, message: m.message })) };
}

// The RELATION certificate: the linter's traversal established COVERAGE over the domain.
// STEERING 3: treating "eslint visited the whole file" as EXHAUSTIVE coverage of the domain. The
// linter does not say this; it is an inference from how the tool works, and it is the single
// largest assumption in this translation.
function coverageCertificate(file, subject) {
  const predicate = relationClaim('COVERAGE', subject, DOMAIN);
  return {
    contract_version: '1.4.0-frozen-2026-09-21',
    requested_claim: { domain: { name: DOMAIN, contained_in: ['MODULE'] },
      quantifier: 'POINTWISE', predicate },
    licensed_claim: { domain: { name: DOMAIN, contained_in: ['MODULE'] },
      quantifier: 'POINTWISE', predicate },
    licensed_relation: 'EQUIVALENT',
    collateral_observations: [], frontier: [],
    obligation: { passed: true, unmet: [], coverage: { [DOMAIN]: 'EXHAUSTIVE' } },
    derivation: { passed: true, open_frontier: null,
      rule_id: 'claim-from-direct-observation',
      rule_digest: digest('claim-from-direct-observation'),
      alternatives: [{ closed: true, relation_witnesses: [],
        premises: [{ ref: subject, decidable_at_site: true, settled: true }] }] },
    measurement: { capability_demonstrated: true,
      positive_control: { fired: true, ref: 'eslint:rule-enabled' },
      observation: { ref: 'eslint:traversal', evidential_force: true,
        procedure: 'eslint ' + RULE + ' over ' + file,
        context: { evidence_scope: DOMAIN, repository: 'external-corpus', claim_domain: DOMAIN },
        attribution: 'eslint ' + RULE + ': every array-method callback in the file is visited' },
      instrument: { name: 'eslint ' + RULE, version_digest: 'eslint-builtin' } },
    run_floor: { instrument: 'eslint', emitted_ref: 'eslint:messages', run_id: file },
    provenance: { producer: 'eslint', producer_digest: 'external', evidence_refs: [file],
      run_id: file + ':coverage', emitted_at: new Date(0).toISOString() },
  };
}

// The ORDINARY certificate: the universal claim the obligation is about.
function universalCertificate(file, subject, findings, coverageRef) {
  const clean = findings.length === 0;
  return {
    contract_version: '1.4.0-frozen-2026-09-21',
    requested_claim: { domain: { name: DOMAIN, contained_in: ['MODULE'] },
      quantifier: 'FOR_ALL', predicate: PREDICATE },
    // NOT A CHOICE: when the linter reports a violation the universal is false, so nothing about
    // the request is licensed. That is the linter's decision, carried across unchanged.
    licensed_claim: clean
      ? { domain: { name: DOMAIN, contained_in: ['MODULE'] }, quantifier: 'FOR_ALL',
        predicate: PREDICATE }
      : null,
    licensed_relation: clean ? 'EQUIVALENT' : 'NONE',
    collateral_observations: [],
    frontier: clean ? [] : findings.map((f) => f.ruleId + ' at line ' + f.line + ': ' + f.message),
    obligation: { passed: clean, unmet: clean ? [] : findings.map((f) => f.message),
      coverage: { [DOMAIN]: 'EXHAUSTIVE' } },
    derivation: { passed: clean, open_frontier: clean ? null : findings[0].message,
      rule_id: 'universal-from-exhaustive-coverage',
      rule_digest: digest('universal-from-exhaustive-coverage'),
      alternatives: [{ closed: clean,
        premises: [{ ref: subject, decidable_at_site: true, settled: clean }],
        relation_witnesses: [{ relation: 'COVERAGE', subject, object: DOMAIN, domain: DOMAIN,
          evidence_root: coverageRef,
          provenance: 'eslint traversal of ' + file }] }] },
    measurement: { capability_demonstrated: true,
      positive_control: { fired: true, ref: 'eslint:rule-enabled' },
      observation: { ref: 'eslint:messages', evidential_force: true,
        procedure: 'eslint ' + RULE + ' over ' + file,
        context: { evidence_scope: DOMAIN, repository: 'external-corpus', claim_domain: DOMAIN },
        attribution: 'eslint ' + RULE + ' reported ' + findings.length + ' finding(s)' },
      instrument: { name: 'eslint ' + RULE, version_digest: 'eslint-builtin' } },
    run_floor: { instrument: 'eslint', emitted_ref: 'eslint:messages', run_id: file },
    provenance: { producer: 'eslint', producer_digest: 'external', evidence_refs: [file],
      run_id: file, emitted_at: new Date(0).toISOString() },
  };
}

export async function evaluate(file) {
  const { findings } = await lint(file);
  const st = store();
  const subject = file + ':callbacks';

  const cov = coverageCertificate(file, subject);
  const covAdmit = admit(cov, { authorityStore: st });
  const covOut = adapt(cov, { authorityStore: st });
  let coverageRef = null;
  if (covOut.token) coverageRef = st.admitToken(covOut.token, { fromCertificate: 'coverage' }).ref;

  const uni = universalCertificate(file, subject, findings, coverageRef);
  const res = admit(uni, { authorityStore: st });

  return {
    file: file.split(/[\\/]/).pop(),
    linter: { decision: findings.length ? 'REJECT' : 'ACCEPT',
      ruleIds: [...new Set(findings.map((f) => f.ruleId))],
      reasons: findings.map((f) => 'line ' + f.line + ': ' + f.message) },
    legasus: { coverage: covAdmit.state, decision: res.state, why: res.why },
  };
}
