// The two arms. Built from the DEVELOPMENT CASE ONLY (the preserved false report about
// _bondForeclosureFired). Frozen per ABSENCE-ASSERTION_PREREG.md + amendments 1 and 2.
//
// WHY THE ARMS SHARE gather():
//   A1.1 requires both arms to receive the same evidence and the same inspection opportunities.
//   The prescribed checks (spelling/case, wrapper inspection, scope citation) are the BASELINE's
//   contribution, and Legasus is handed their results for free. That is deliberately generous to
//   the arm I expect to lose: it isolates the question the governor actually posed. Gathering
//   answers Q1 (who ESTABLISHES adequacy); the two decide() functions answer Q2 (does Legasus
//   ENFORCE it better). Any cost difference can then only come from evidence an arm needs ON TOP.

import { adapt } from '../adapter.mjs';
import { admit } from '../admission.mjs';
import { store, relationClaim } from '../authority-store.mjs';
import { ADMITTED_RULES, digestOf } from '../rules.mjs';
import {
  DECISION, MEANING, DENIED, grep, identifierSet, computedAccessSites, scopeContained,
} from './harness.mjs';

const digest = (id) => digestOf(ADMITTED_RULES[id]);
const CONTRACT = '1.4.0-frozen-2026-09-21';

/** Regions of this corpus that persist or restore state. The development case was missed partly
 *  because the sweep stopped at the main loader; enumerating the wrappers is the cheap fix. */
const WRAPPER_MARKERS = /function\s+(saveGame|loadGame)\b|_orig(Save|Load)|jgSave|jgLoad|JSON\.parse\s*\(\s*localStorage|localStorage\.setItem/;

/** SHARED evidence gathering. Runs the BASELINE's prescribed checks. Charges the ledger. */
export function gather(claim, corpus, ledger, initial) {
  const ev = {
    initial, searches: [{ from: initial.from, to: initial.to }], hits: [],
    spelling_risk: [], wrapper_regions: [], computed_sites: null, notes: [],
  };
  const asserted = claim.asserted_scope;
  const core = initial.query;

  // 1. the prescribed whole-scope search, CASE-INSENSITIVE. Scope alone was never the whole fix.
  const wide = grep(corpus, ledger, core, { ci: true, from: asserted.from, to: asserted.to });
  if (wide === DENIED) { ev.notes.push('budget denied the wide search'); return ev; }
  ev.searches.push({ from: wide.from, to: wide.to });
  ev.hits = [...wide.hit_lines];

  // 2. the prescribed spelling/case check, against the code's ACTUAL identifiers rather than
  //    against my belief about them. This is the check whose absence produced the dev case.
  const ids = identifierSet(corpus, ledger, asserted.from, asserted.to);
  if (ids !== DENIED) {
    const lc = core.toLowerCase();
    for (const id of ids) {
      if (!id.toLowerCase().includes(lc)) continue;
      if (id.includes(core)) continue;          // the original query would have found this one
      ev.spelling_risk.push(id);                // it would NOT: e.g. _bondForeclosureFired vs foreclosureFired
    }
    ev.spelling_risk.sort();
  }

  // 3. resolve each risky spelling explicitly, up to three.
  for (const id of ev.spelling_risk.slice(0, 3)) {
    const r = grep(corpus, ledger, id, { ci: false, from: asserted.from, to: asserted.to });
    if (r === DENIED) { ev.notes.push('budget denied spelling follow-up for ' + id); break; }
    ev.searches.push({ from: r.from, to: r.to });
    for (const l of r.hit_lines) if (!ev.hits.includes(l)) ev.hits.push(l);
  }

  // 4. the prescribed wrapper inspection: enumerate every save/load region, not just the first.
  const wr = grep(corpus, ledger, 'function loadGame', { ci: true, from: 1, to: corpus.lines.length });
  if (wr !== DENIED) {
    ev.wrapper_regions = corpus.lines.reduce((acc, l, i) => {
      if (WRAPPER_MARKERS.test(l)) acc.push(i + 1);
      return acc;
    }, []);
  }

  // 5. RUNTIME meaning cannot rest on lexical evidence (A2.2).
  if (claim.meaning === MEANING.RUNTIME) {
    const cs = computedAccessSites(corpus, ledger, asserted.from, asserted.to);
    ev.computed_sites = cs === DENIED ? null : cs;
  }

  ev.hits.sort((a, b) => a - b);
  // 6. the prescribed scope citation, and adequacy as fixed in A1.3 / A2.2.
  ev.coverage = {
    asserted, searched: ev.searches,
    contained: scopeContained(asserted, ev.searches),
    query_adequate: ev.spelling_risk.length === 0 || ev.spelling_risk.slice(0, 3).length === ev.spelling_risk.length,
    meaning_supported: claim.meaning !== MEANING.RUNTIME
      || (ev.computed_sites !== null && ev.computed_sites.length === 0),
    wrappers_covered: ev.wrapper_regions.every((l) => l >= asserted.from && l <= asserted.to)
      || ev.wrapper_regions.length === 0,
  };
  return ev;
}

/** BASELINE: decide procedurally from the gathered evidence. */
export function baselineDecide(claim, ev) {
  const c = ev.coverage;
  if (!c) return { decision: DECISION.UNRESOLVED, why: 'evidence gathering was cut short: ' + ev.notes.join('; ') };
  if (ev.hits.length > 0) {
    return { decision: DECISION.REFUSE,
      why: 'counterexample: ' + ev.hits.length + ' occurrence(s), first at line ' + ev.hits[0]
        + (ev.spelling_risk.length ? '; reached only via spelling variant(s) ' + ev.spelling_risk.join(', ') : '') };
  }
  if (!c.meaning_supported) {
    return { decision: DECISION.UNRESOLVED,
      why: 'claim meaning is RUNTIME; lexical evidence cannot settle it and '
        + (ev.computed_sites === null ? 'computed-access bounding was not affordable'
          : ev.computed_sites.length + ' computed-access site(s) remain unbounded') };
  }
  if (!c.contained) {
    return { decision: DECISION.UNRESOLVED,
      why: 'searched scope does not contain the asserted scope; a narrow search supports only a correspondingly narrow claim' };
  }
  if (!c.query_adequate) {
    return { decision: DECISION.UNRESOLVED, why: 'unresolved spelling variants remain: ' + ev.spelling_risk.join(', ') };
  }
  return { decision: DECISION.ACCEPT, why: 'no occurrence in a scope that contains the claim, with queries checked against the identifier set' };
}

/** LEGASUS: same evidence, decided by the production admission path. NO new rule is introduced -
 *  this is the PR4a test: can an absence claim be expressed with an ALREADY ADMITTED rule. */
export function legasusDecide(claim, ev) {
  const c = ev.coverage;
  if (!c) return { decision: DECISION.UNRESOLVED, why: 'evidence gathering was cut short', extension: null };

  const subject = claim.id + ':searched-scope';
  const DOMAIN = claim.domain;
  const dom = { name: DOMAIN, contained_in: ['FILE'] };
  const covOk = c.contained && c.query_adequate && c.meaning_supported;
  const covWhy = !c.contained ? 'searched scope does not contain the asserted scope'
    : !c.query_adequate ? 'queries do not cover the identifier set'
      : !c.meaning_supported ? 'lexical evidence cannot settle a RUNTIME claim' : '';

  const st = store();
  const cov = {
    contract_version: CONTRACT,
    requested_claim: { domain: dom, quantifier: 'POINTWISE', predicate: relationClaim('COVERAGE', subject, DOMAIN) },
    licensed_claim: covOk ? { domain: dom, quantifier: 'POINTWISE', predicate: relationClaim('COVERAGE', subject, DOMAIN) } : null,
    licensed_relation: covOk ? 'EQUIVALENT' : 'NONE',
    collateral_observations: [], frontier: covOk ? [] : [covWhy],
    obligation: { passed: covOk, unmet: covOk ? [] : [covWhy], coverage: { [DOMAIN]: covOk ? 'EXHAUSTIVE' : 'PARTIAL' } },
    derivation: { passed: covOk, open_frontier: covOk ? null : covWhy,
      rule_id: 'claim-from-direct-observation', rule_digest: digest('claim-from-direct-observation'),
      alternatives: [{ closed: covOk, relation_witnesses: [],
        premises: [{ ref: subject, decidable_at_site: true, settled: covOk }] }] },
    measurement: { capability_demonstrated: true,
      positive_control: { fired: true, ref: 'harness:grep-returns-known-hit' },
      observation: { ref: 'harness:searches', evidential_force: true,
        procedure: 'frozen analyses over ' + claim.corpus,
        context: { evidence_scope: DOMAIN, repository: 'dust-harvest-corpus', claim_domain: DOMAIN },
        attribution: 'searched ' + JSON.stringify(ev.searches) },
      instrument: { name: 'absence-harness', version_digest: 'frozen-2026-09-22' } },
    run_floor: { instrument: 'absence-harness', emitted_ref: 'harness:searches', run_id: claim.id },
    provenance: { producer: 'absence-arm-legasus', producer_digest: 'internal',
      evidence_refs: [claim.corpus], run_id: claim.id + ':coverage', emitted_at: new Date(0).toISOString() },
  };
  const covAdmit = admit(cov, { authorityStore: st });
  let coverageRef = null;
  if (covAdmit.established) {
    const out = adapt(cov, { authorityStore: st });
    if (out.token) coverageRef = st.admitToken(out.token, { fromCertificate: 'coverage' }).ref;
  }

  const clean = ev.hits.length === 0;
  const ok = covOk && clean;
  const why = !clean ? ('counterexample at line ' + ev.hits[0]) : covWhy;
  const abs = {
    contract_version: CONTRACT,
    requested_claim: { domain: dom, quantifier: 'FOR_ALL', predicate: claim.predicate },
    licensed_claim: ok ? { domain: dom, quantifier: 'FOR_ALL', predicate: claim.predicate } : null,
    licensed_relation: ok ? 'EQUIVALENT' : 'NONE',
    collateral_observations: [], frontier: ok ? [] : [why],
    obligation: { passed: ok, unmet: ok ? [] : [why], coverage: { [DOMAIN]: covOk ? 'EXHAUSTIVE' : 'PARTIAL' } },
    derivation: { passed: ok, open_frontier: ok ? null : why,
      rule_id: 'universal-from-exhaustive-coverage', rule_digest: digest('universal-from-exhaustive-coverage'),
      alternatives: [{ closed: ok, premises: [{ ref: subject, decidable_at_site: true, settled: ok }],
        relation_witnesses: [{ relation: 'COVERAGE', subject, object: DOMAIN, domain: DOMAIN,
          evidence_root: coverageRef, provenance: 'frozen analyses over ' + claim.corpus }] }] },
    measurement: cov.measurement,
    run_floor: { instrument: 'absence-harness', emitted_ref: 'harness:searches', run_id: claim.id },
    provenance: { producer: 'absence-arm-legasus', producer_digest: 'internal',
      evidence_refs: [claim.corpus], run_id: claim.id, emitted_at: new Date(0).toISOString() },
  };
  const res = admit(abs, { authorityStore: st });

  const decision = res.established ? DECISION.ACCEPT
    : (!clean ? DECISION.REFUSE : DECISION.UNRESOLVED);
  return { decision, why: res.why || why, state: res.state,
    coverage: covAdmit.state, coverageFiled: coverageRef !== null,
    extension: null };   // PR4a: no new rule was needed. Recorded per-run, not assumed.
}
