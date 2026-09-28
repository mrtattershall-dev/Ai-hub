// THE EXECUTION REGION — the project's behavioural territory, and its boundary.
//
// MEASURED RESULT THAT FORCED THIS LAYER (benchmarks/repoB/slice-granularity.mjs, preregistered): of the
// 24 `version` functions a purpose-connected execution touches, ZERO are fully covered by it, and five
// show two purpose witnesses cutting DIFFERENT slices through the SAME function - sharing 11 sites and
// differing on 9. The slice is a property of the WITNESS, not of the function.
//
//     MODULE is too coarse. FUNCTION is too coarse. The unit is the EVIDENCE-BACKED BEHAVIOURAL REGION,
//     and functions are containers those regions cut through.
//
// This is FUNCTION ENTERED != TARGET SITE REACHED, one level up, and it has the same consequence:
// admitting a whole function into the region grants authority over sites no evidence ever established.
//
// THE BOUNDARY IS NOT INVENTED, IT IS DERIVED. That is the whole point. PURPOSE does not need to imagine
// what to build next; the frontier is a PROPERTY OF THE EVIDENCE GRAPH:
//
//     PURPOSE ROOTS -> EXECUTION WITNESSES -> EVIDENCE GRAPH -> CONNECTED REGION -> BOUNDARY
//
// and the generative step shrinks from "what should this project become?" to "here is one evidenced
// boundary; propose an extension across it". That is an enormously smaller responsibility to hand a
// model, and it is the same move as every other Legasus reduction: make the deterministic part carry the
// structure so the stochastic part only has to carry the novelty.
//
// PROGRESS, DEFINED PHYSICALLY:
//     a justified EXPANSION or STRENGTHENING of the purpose-connected, evidence-backed behavioural region,
//     without unjustified loss of required existing region.
// Not lines. Not commits. Not features ticked off. Not model opinion. Not even function count.
import { LIFECYCLE } from '../legaknow/ledger.mjs';
import { liveWitnesses } from './frontier.mjs';

export const BOUNDARY = {
  UNEXERCISED_BRANCH: 'UNEXERCISED_BRANCH',   // inside a region function, never established
  UNREACHED_CALLEE: 'UNREACHED_CALLEE',       // called from region code, never entered by the region
  STALE_EDGE: 'STALE_EDGE',                   // the evidence for this edge no longer applies
  UNOBSERVABLE_EDGE: 'UNOBSERVABLE_EDGE',     // the apparatus cannot see past here - NOT a negative
  ABSENT_CAPABILITY: 'ABSENT_CAPABILITY',     // the region wants something that does not exist yet
};

const key = (mod, line) => mod + ':' + line;

// A region is built from witnesses, at SITE granularity, retaining which witness established each site.
// Retaining the attribution is what makes the region re-checkable rather than a bag of line numbers.
export function buildRegion({ witnesses, roots, siteMap }) {
  // A STALE or INVALID witness is not an edge and establishes no site (composition attack W2-c, the
  // same class as connectivity() in frontier.mjs, which owns the rule). The exclusions are reported on
  // the region so a STALE_EDGE boundary can be derived from them rather than from a caller's memory.
  const { live, excluded } = liveWitnesses(witnesses);
  witnesses = live;
  const inRegion = new Set(roots);
  let grew = true;
  const reachedFrom = new Map();
  for (const w of witnesses) {
    const s = reachedFrom.get(w.rootSubject) || new Set();
    for (const f of w.entered || []) s.add(f);
    reachedFrom.set(w.rootSubject, s);
  }
  while (grew) {
    grew = false;
    for (const r of [...inRegion]) {
      for (const f of reachedFrom.get(r) || []) {
        if (!inRegion.has(f)) { inRegion.add(f); grew = true; }
      }
    }
  }

  // The sites the region ESTABLISHED, with the witness that established each.
  const sites = new Map();
  const contributing = witnesses.filter((w) => inRegion.has(w.rootSubject));
  for (const w of contributing) {
    for (const l of w.lines || []) {
      const arr = sites.get(l) || [];
      arr.push(w.id ?? w.rootSubject);
      sites.set(l, arr);
    }
  }

  return { subjects: inRegion, sites, witnesses: contributing, siteMap,
    excludedWitnesses: excluded.map((w) => ({ id: w.id ?? w.rootSubject, lifecycle: w.lifecycle })),
    lifecycle: LIFECYCLE.VALID };
}

// THE BOUNDARY. Everywhere the region's surviving evidence stops while program structure continues.
// Derived wholly from the graph; nothing here consults a plan, a name, or an intention.
export function boundaryOf(region, { calls = {}, absent = [], staleWitnessIds = new Set(),
  unobservable = [] } = {}) {
  const out = [];

  // 1. Sites inside region functions that the region never established. The unexercised branch - the
  //    single largest and most honest source of "what has this project not actually done yet".
  //
  //    MEMBERSHIP IS DECIDED BY SITES, NOT BY NAMES. Traced frames are keyed module.co_name while the
  //    site map is keyed by qualname, and matching those two vocabularies would be a naming heuristic
  //    sitting underneath an architecture whose entire point is that evidence outranks names. A function
  //    is in the region iff the region established at least one site inside it.
  for (const [fn, entry] of Object.entries(region.siteMap || {})) {
    const lines = entry.lines || entry;
    const mod = entry.module || '';
    const missing = lines.filter((l) => !region.sites.has(key(mod, l)));
    if (missing.length < lines.length && missing.length) {
      out.push({ kind: BOUNDARY.UNEXERCISED_BRANCH, subject: fn,
        established: lines.length - missing.length, total: lines.length, missing: missing.slice(0, 12),
        why: 'the region executes this function but has never established ' + missing.length
          + ' of its ' + lines.length + ' sites' });
    }
  }

  // 2. Things region code calls that the region has never entered.
  for (const [from, tos] of Object.entries(calls)) {
    if (!region.subjects.has(from)) continue;
    for (const to of tos) {
      if (!region.subjects.has(to)) {
        out.push({ kind: BOUNDARY.UNREACHED_CALLEE, subject: to, from,
          why: 'region code calls this and the region has never executed it' });
      }
    }
  }

  // 3. Edges whose evidence expired. A boundary that used to be interior.
  for (const w of region.witnesses) {
    if (staleWitnessIds.has(w.id ?? w.rootSubject)) {
      out.push({ kind: BOUNDARY.STALE_EDGE, subject: w.rootSubject,
        why: 'the witness that established this part of the region no longer applies' });
    }
  }

  // 4. Where the apparatus itself stops. NEVER a negative, and never silently omitted - a boundary the
  //    system cannot see past is a different kind of fact from one it has chosen not to cross.
  for (const u of unobservable) {
    out.push({ kind: BOUNDARY.UNOBSERVABLE_EDGE, subject: u.subject,
      why: u.why || 'the apparatus cannot observe past this point; nothing is claimed either way' });
  }

  // 5. Declared absences: the region wants something that does not exist.
  for (const a of absent) {
    out.push({ kind: BOUNDARY.ABSENT_CAPABILITY, subject: a.subject, why: a.why });
  }
  return out;
}

// Region difference, which is what PROGRESS actually measures. Expansion, strengthening, and loss are
// three different things and must never be summed into one number.
export function regionDelta(before, after) {
  const gainedSubjects = [...after.subjects].filter((s) => !before.subjects.has(s));
  const lostSubjects = [...before.subjects].filter((s) => !after.subjects.has(s));
  const gainedSites = [...after.sites.keys()].filter((s) => !before.sites.has(s));
  const lostSites = [...before.sites.keys()].filter((s) => !after.sites.has(s));
  return {
    expanded: gainedSubjects.length > 0,
    strengthened: gainedSites.length > 0 && gainedSubjects.length === 0,
    lost: lostSites.length > 0 || lostSubjects.length > 0,
    gainedSubjects, lostSubjects,
    gainedSites: gainedSites.length, lostSites: lostSites.length,
    // Territory, reported as what it is: sites of established behaviour, not lines of code.
    territoryBefore: before.sites.size, territoryAfter: after.sites.size,
  };
}

// What fraction of the region's own functions are fully established. The measured answer on `packaging`
// was ZERO, which is why this is reported and never assumed.
export function regionDensity(region) {
  let full = 0; let partial = 0; let established = 0; let total = 0;
  for (const [, entry] of Object.entries(region.siteMap || {})) {
    const lines = entry.lines || entry;
    const mod = entry.module || '';
    const hit = lines.filter((l) => region.sites.has(key(mod, l))).length;
    if (!hit) continue;
    established += hit; total += lines.length;
    if (hit === lines.length) full++; else partial++;
  }
  return { full, partial, established, total, density: total ? established / total : 0 };
}
