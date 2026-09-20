// A SEMANTIC BRIDGE between a production decision and a calculus proposition.
//
// PRODUCTION      justification.covers(granted, required)
//                 "is this granted scope broad enough to license what is being asked for?"
// SPECIFICATION   calculus.delegate({from, grant, to, context})
//                 "may authority held over one world move to another?"
//
// Production does not import the calculus and does not know it exists. Both, independently, answer
// something about whether authority at one scope reaches another scope.
//
// AND THEY ARE NOT THE SAME QUESTION. The quantifiers run in OPPOSITE directions:
//
//     covers     iterates the dimensions the REQUIREMENT names; the grant must match or be ANY
//     delegate   iterates the dimensions the GRANTOR pins;   the grantee must match, and may ADD
//
// So granted {repository: S1} against required {} is PERMITTED by covers - nothing was asked for -
// and REFUSED by delegate - a grant over one world is not a grant over every world. That difference
// is REAL and is a property of two different questions, not a defect in either side. Declaring these
// EQUIVALENT would make the bridge manufacture disagreements, which is exactly the failure BRIDGE-1
// exists to be able to see.
//
// So this file declares TWO bridges over the same pair:
//
//   WIDE        relation PARTIAL      licenses NO verdict; every comparison is UNMAPPABLE
//   RESTRICTED  relation EQUIVALENT   licensed ONLY on the domain where the requirement names
//                                     exactly the dimensions the grant pins - where the two
//                                     quantifiers range over the same set and the questions
//                                     genuinely coincide
//
// The restriction is stated as a DOMAIN PREDICATE on the observed call, not as a filter applied
// after seeing which cases agreed.
import { RELATION } from '../bridge.mjs';

const PROV = 'justification.mjs covers(): "Is `granted` broad enough to license `required`? null means'
  + ' not established over this dimension at all, which licenses nothing. ANY licenses anything."'
  + '  ||  calculus.mjs DELEGATE: "Every dimension the grantor\'s context establishes must be present'
  + ' and equal in the grantee\'s; the grantee may add dimensions."';

export const ENDPOINTS = { production: 'legasus/legaknow/justification.mjs',
  specification: 'legasus/legaknow/calculus.mjs' };

export const WIDE = {
  production_subject: 'justification.mjs::covers',
  production_observation: 'ok: boolean, missing: string[]',
  specification_subject: 'calculus.mjs::delegate',
  specification_proposition: 'authority over a world may move to another world only without widening',
  relation: RELATION.PARTIAL,
  provenance: PROV + '  ||  RELATION PARTIAL because the two quantify over different dimension sets.',
  evidence: 'read from the two source comments and confirmed by the opposite answers on'
    + ' granted={repository:S1}, required={}',
};

export const RESTRICTED = {
  ...WIDE,
  relation: RELATION.EQUIVALENT,
  domain: 'the requirement names exactly the dimensions the grant pins',
  provenance: PROV + '  ||  RELATION EQUIVALENT only on the stated domain, where both quantifiers'
    + ' range over the same dimension set.',
  reason_correspondence: { DIMENSION_MISMATCH: 'WORLD_CHANGED' },
};

// THE DOMAIN PREDICATE. Stated as a property of the observed call, decided before any comparison.
export const inDomain = (granted, required) => {
  const g = Object.keys(granted || {}).filter((k) => granted[k] !== null && granted[k] !== undefined);
  const r = Object.keys(required || {}).filter((k) => required[k] !== null && required[k] !== undefined);
  return g.length > 0 && g.length === r.length && g.every((k) => r.includes(k));
};

// THE INPUT VOCABULARY CHECK, and the reason it exists.
//
// The first run of this bridge reported 965 RESULT_DISAGREEMENTs, all of one shape: `covers` treats
// ANY as "licenses anything", and the calculus context HAS NO WILDCARD - `delegate` compares with
// !== and refuses. Production holds a concept the specification cannot represent, and the bridge
// silently coerced it into a finding against production.
//
//     THAT IS THE EXACT FAILURE THIS SLICE EXISTS TO BE ABLE TO SEE, COMMITTED BY THE BRIDGE ITSELF.
//
// Representability is a property of the INPUTS, not of the two answers, so it has to be decided
// before the answers are compared. A concept with no counterpart is UNMAPPABLE - a capability gap in
// the SPECIFICATION - and never evidence against production.
// The SECOND vocabulary gap was found the same way, on the four cases the first repair left behind.
// Two of them had granted and required IDENTICAL and the specification still refused, because
// `delegate` compares context values with !== and the scopes carried an UNADMITTED object - so the
// specification was deciding on REFERENCE IDENTITY of a nested object.
//
// The rule is therefore general rather than a special case for UNADMITTED: a scope value that is not
// a primitive has no faithful counterpart, because strict equality over it answers a question about
// references rather than about worlds. Stripping it instead would be the BRIDGE claiming the drop is
// meaning-preserving, which is the fabrication this slice exists to avoid.
export const unrepresentable = (granted, required) => {
  for (const [side, sc] of [['granted', granted], ['required', required]]) {
    for (const [d, v] of Object.entries(sc || {})) {
      if (typeof v === 'symbol') {
        return side + '.' + d + ' is ANY, a wildcard scope. The calculus context has no wildcard:'
          + ' delegate compares contexts with !== and cannot express "licenses anything".';
      }
      if (v !== null && typeof v === 'object') {
        return side + '.' + d + ' is a non-primitive scope value (' + d + '). The calculus compares'
          + ' context values with !==, so it would decide on reference identity rather than on the'
          + ' world; production treats this axis as recorded-not-authoritative and ignores it.';
      }
    }
  }
  return null;
};

// Readers. Each turns one side's RAW output into { result, reasonClass }. A raw output the reader
// cannot classify yields result null, which the comparator reports as UNMAPPABLE rather than guessing.
export const readProduction = (out) => {
  if (!out || typeof out.ok !== 'boolean') return { result: null };
  if (out.ok) return { result: 'PERMITTED', reasonClass: 'ALL_DIMENSIONS_SATISFIED' };
  const m = String((out.missing || [])[0] || '');
  if (/never established/.test(m)) return { result: 'REFUSED', reasonClass: 'NOT_ESTABLISHED' };
  if (/asked for/.test(m)) return { result: 'REFUSED', reasonClass: 'DIMENSION_MISMATCH' };
  return { result: 'REFUSED' };                      // refused, reason unclassified -> UNMAPPABLE
};

export const readSpecification = (tok) => {
  if (!tok || typeof tok !== 'object') return { result: null };
  if (tok.minted === false) {
    const why = String(tok.why || '');
    if (/drops or changes/.test(why)) return { result: 'REFUSED', reasonClass: 'WORLD_CHANGED' };
    return { result: 'REFUSED' };                    // refused for a reason outside the bridge
  }
  return { result: 'PERMITTED', reasonClass: 'ALL_DIMENSIONS_SATISFIED' };
};

// THE TRANSLATION. Production facts -> the specification's own constructors. This builds no authority
// object itself; it calls delegate, which mints or refuses on its own terms.
export const toSpecification = (C, granted, required) => C.delegate({
  from: C.delegate({ from: 'OWNER', grant: ['act'], to: 'holder', context: { ...granted } }),
  grant: ['act'], to: 'grantee', context: { ...required },
});
