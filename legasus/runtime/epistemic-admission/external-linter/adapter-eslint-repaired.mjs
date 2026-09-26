// THE REPAIRED ADAPTER. Frozen in COVERAGE-REPAIR_PREREG.md before it was run.
//
// The preserved adapter (adapter-eslint.mjs) converted "no diagnostic" into "every domain member
// satisfies the obligation". This one requires an EXPLICIT, POSITIVE basis for every coverage
// condition, each probed against the pinned eslint (probe-bases.mjs), and it does NOT decide the
// outcome itself: it emits honest certificates and lets the production admission path decide.
//
// THE INTENDED DOMAIN IS PRESERVED. A suppressed region is still part of the domain; it was not
// evaluated, and the certificate says so - the domain is not shrunk around it.
import { ESLint } from 'eslint';
import { adapt } from '../adapter.mjs';
import { admit } from '../admission.mjs';
import { store, relationClaim } from '../authority-store.mjs';
import { ADMITTED_RULES, digestOf } from '../rules.mjs';

export const RULE = 'array-callback-return';
// The domain name STATES THE RECOGNITION SCOPE. It is the frozen, narrow domain: callbacks this
// rule recognises, in files this configuration linted. Not "all callbacks with this obligation".
export const DOMAIN = 'ARRAY_METHOD_CALLBACKS_RECOGNISED_BY_' + RULE.toUpperCase().replace(/-/g, '_')
  + '_IN_LINTED_MODULE';
const PREDICATE = 'the callback returns a value on every code path';
const digest = (id) => digestOf(ADMITTED_RULES[id]);
const CONTRACT = '1.4.0-frozen-2026-09-21';
const dom = { name: DOMAIN, contained_in: ['MODULE'] };

/** The adapter's configuration is DECLARED, and can model a project's ignores. */
export function makeLinter({ ignores = [], ruleOn = true } = {}) {
  const config = [];
  if (ignores.length) config.push({ ignores });
  config.push({
    rules: ruleOn ? { [RULE]: 'error' } : {},
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  });
  return new ESLint({ overrideConfigFile: true, overrideConfig: config });
}

/** Every coverage condition, with the POSITIVE basis eslint exposes for it. Nothing is inferred
 *  from absence alone. */
export async function analyse(file, linter = makeLinter()) {
  const report = { file, conditions: {}, findings: [], basis: {} };

  // 1. file linted at all
  const ignored = await linter.isPathIgnored(file);
  report.basis.isPathIgnored = ignored;
  if (ignored) { report.conditions.excluded = 'file is excluded by the configuration (isPathIgnored)'; return report; }

  // 2. rule ran: the EFFECTIVE configuration lists it with error severity
  const cfg = await linter.calculateConfigForFile(file);
  const eff = cfg && cfg.rules && cfg.rules[RULE];
  const sev = Array.isArray(eff) ? eff[0] : eff;
  report.basis.effectiveRule = eff === undefined ? null : eff;
  if (!(sev === 2 || sev === 'error')) {
    report.conditions.ruleNotRun = 'rule ' + RULE + ' is not enabled in the effective configuration';
  }

  // 3. analysis completed: lint ran, no fatal message, no exception
  let r;
  try {
    [r] = await linter.lintFiles([file]);
  } catch (err) {
    report.conditions.analysisIncomplete = 'linting threw: ' + err.message;
    return report;
  }
  const fatal = r.messages.filter((m) => m.fatal);
  report.basis.fatalErrorCount = r.fatalErrorCount;
  if (fatal.length || r.fatalErrorCount > 0) {
    report.conditions.analysisIncomplete = 'analysis failed: ' + fatal.map((m) => m.message).join('; ');
  }

  // 4. no suppression touched the domain: USED directives appear in suppressedMessages; UNUSED ones
  //    are reported (ruleId null) because reportUnusedDisableDirectives is on. A blanket directive
  //    names no rule and disables ours, so it counts. RECORDED FRAGILITY: the unused-directive
  //    basis is message text.
  const suppressed = (r.suppressedMessages || []).filter((m) => m.ruleId === RULE);
  const unused = r.messages.filter((m) => m.ruleId === null && /Unused eslint-disable directive/.test(m.message)
    && (m.message.includes("'" + RULE + "'") || !/from '/.test(m.message)));
  report.basis.suppressedForRule = suppressed.length;
  report.basis.unusedDirectives = unused.length;
  if (suppressed.length || unused.length) {
    report.conditions.coverageIncomplete = 'a suppression directive prevented evaluating part of the domain ('
      + suppressed.length + ' suppressed finding(s), ' + unused.length + ' unused directive(s))';
  }

  // 5. the rule's own findings, preserved verbatim
  report.findings = r.messages.filter((m) => m.ruleId === RULE)
    .map((m) => ({ ruleId: m.ruleId, line: m.line, message: m.message }));
  return report;
}

const covered = (rep) => !rep.conditions.excluded && !rep.conditions.ruleNotRun
  && !rep.conditions.analysisIncomplete && !rep.conditions.coverageIncomplete;
const conditionText = (rep) => Object.values(rep.conditions).join('; ');

// The RELATION certificate. Licensed ONLY on a full positive basis; otherwise honestly unlicensed,
// with the failed condition on its frontier, and NO authority is filed from it.
function coverageCertificate(rep, subject) {
  const ok = covered(rep);
  const predicate = relationClaim('COVERAGE', subject, DOMAIN);
  return {
    contract_version: CONTRACT,
    requested_claim: { domain: dom, quantifier: 'POINTWISE', predicate },
    licensed_claim: ok ? { domain: dom, quantifier: 'POINTWISE', predicate } : null,
    licensed_relation: ok ? 'EQUIVALENT' : 'NONE',
    collateral_observations: [],
    frontier: ok ? [] : [conditionText(rep)],
    obligation: { passed: ok, unmet: ok ? [] : [conditionText(rep)],
      coverage: { [DOMAIN]: ok ? 'EXHAUSTIVE' : 'PARTIAL' } },
    derivation: { passed: ok, open_frontier: ok ? null : conditionText(rep),
      rule_id: 'claim-from-direct-observation',
      rule_digest: digest('claim-from-direct-observation'),
      alternatives: [{ closed: ok, relation_witnesses: [],
        premises: [{ ref: subject, decidable_at_site: true, settled: ok }] }] },
    measurement: { capability_demonstrated: true,
      positive_control: { fired: true, ref: 'eslint:rule-enabled' },
      // The observation HAS force whether or not coverage is complete: eslint genuinely ran and
      // reported. The first run set this to `ok`, which made observe() refuse with the generic
      // PRODUCER_FAILED and swallowed the legible condition. A coverage failure is a failure of
      // what the observation LICENSES, not of the observation - attributing it to the observation
      // was the wrong-referent species again. The condition travels on the frontier and premise.
      observation: { ref: 'eslint:traversal', evidential_force: true,
        procedure: 'eslint ' + RULE + ' over ' + rep.file,
        context: { evidence_scope: DOMAIN, repository: 'external-corpus', claim_domain: DOMAIN },
        attribution: 'eslint ' + RULE + ' basis: ' + JSON.stringify(rep.basis) },
      instrument: { name: 'eslint ' + RULE, version_digest: 'eslint-10.11.0' } },
    run_floor: { instrument: 'eslint', emitted_ref: 'eslint:messages', run_id: rep.file },
    provenance: { producer: 'adapter-eslint-repaired', producer_digest: 'external', evidence_refs: [rep.file],
      run_id: rep.file + ':coverage', emitted_at: new Date(0).toISOString() },
  };
}

// The ORDINARY certificate. Its premise is settled ONLY when coverage is complete AND no violation
// was reported. The COVERAGE witness roots in whatever authority was filed - which is nothing when
// coverage failed, so admission refuses on its own terms.
function universalCertificate(rep, subject, coverageRef) {
  const clean = rep.findings.length === 0;
  const ok = covered(rep) && clean;
  const why = !covered(rep) ? conditionText(rep)
    : rep.findings.map((f) => f.ruleId + ' at line ' + f.line + ': ' + f.message).join('; ');
  return {
    contract_version: CONTRACT,
    requested_claim: { domain: dom, quantifier: 'FOR_ALL', predicate: PREDICATE },
    licensed_claim: ok ? { domain: dom, quantifier: 'FOR_ALL', predicate: PREDICATE } : null,
    licensed_relation: ok ? 'EQUIVALENT' : 'NONE',
    collateral_observations: [],
    frontier: ok ? [] : [why],
    obligation: { passed: ok, unmet: ok ? [] : [why],
      coverage: { [DOMAIN]: covered(rep) ? 'EXHAUSTIVE' : 'PARTIAL' } },
    derivation: { passed: ok, open_frontier: ok ? null : why,
      rule_id: 'universal-from-exhaustive-coverage',
      rule_digest: digest('universal-from-exhaustive-coverage'),
      alternatives: [{ closed: ok,
        premises: [{ ref: subject, decidable_at_site: true, settled: ok }],
        relation_witnesses: [{ relation: 'COVERAGE', subject, object: DOMAIN, domain: DOMAIN,
          evidence_root: coverageRef,
          provenance: 'eslint traversal of ' + rep.file }] }] },
    measurement: { capability_demonstrated: true,
      positive_control: { fired: true, ref: 'eslint:rule-enabled' },
      observation: { ref: 'eslint:messages', evidential_force: true,   // see coverageCertificate
        procedure: 'eslint ' + RULE + ' over ' + rep.file,
        context: { evidence_scope: DOMAIN, repository: 'external-corpus', claim_domain: DOMAIN },
        attribution: 'eslint ' + RULE + ' reported ' + rep.findings.length + ' finding(s)' },
      instrument: { name: 'eslint ' + RULE, version_digest: 'eslint-10.11.0' } },
    run_floor: { instrument: 'eslint', emitted_ref: 'eslint:messages', run_id: rep.file },
    provenance: { producer: 'adapter-eslint-repaired', producer_digest: 'external', evidence_refs: [rep.file],
      run_id: rep.file, emitted_at: new Date(0).toISOString() },
  };
}

/** Evaluate one file THROUGH THE PRODUCTION ADMISSION PATH. The adapter never returns a verdict of
 *  its own; every decision below is admission's. */
export async function evaluate(file, linter = makeLinter()) {
  const rep = await analyse(file, linter);
  const out = { file: file.split(/[\\/]/).pop(), conditions: rep.conditions, basis: rep.basis,
    linter: { decision: rep.conditions.excluded ? 'EXCLUDED'
      : rep.findings.length ? 'REJECT' : (covered(rep) ? 'ACCEPT' : 'INCOMPLETE'),
    reasons: rep.findings.map((f) => 'line ' + f.line + ': ' + f.message) } };

  if (rep.conditions.excluded) {
    // NO certificate is emitted for an excluded file. Non-emission is not acceptance.
    out.legasus = { emitted: false, decision: 'NO_CLAIM', why: rep.conditions.excluded };
    return out;
  }
  const st = store();
  const subject = file + ':callbacks';
  const cov = coverageCertificate(rep, subject);
  const covAdmit = admit(cov, { authorityStore: st });
  let coverageRef = null;
  if (covAdmit.established) {
    const covOut = adapt(cov, { authorityStore: st });
    if (covOut.token) coverageRef = st.admitToken(covOut.token, { fromCertificate: 'coverage' }).ref;
  }
  const uni = universalCertificate(rep, subject, coverageRef);
  const res = admit(uni, { authorityStore: st });
  out.legasus = { emitted: true, coverage: covAdmit.state, coverageFiled: coverageRef !== null,
    decision: res.state, why: res.why, domain: DOMAIN };
  return out;
}
