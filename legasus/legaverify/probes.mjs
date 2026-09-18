// LEGAVERIFY — CONTRACT-DERIVED PROBES. The verifier's first module, and it exists because of a
// specific near-miss.
//
// THE NEAR-MISS. The scale experiment's probe set was built by hand, and two of its probes - the
// neighbours of the preserved value - were added only because an earlier control happened to catch a
// hole. Those two probes caught 17 of the 14B's 18 semantic leaks. Without them the 14B would have
// scored 239/240 and been reported as having essentially solved the task.
//
//     a verifier built around one model's mistakes will certify another model's smarter mistakes
//
// The 1.5B wrote `n < 10` and was usually right. The 14B wrote `0 < n < 10` - idiomatic, confident,
// and wrong, because the lower bound never existed in the specification. That is not a worse version
// of the small model's error. It is a new KIND of error, and a regression-style probe set cannot
// anticipate a kind it has never seen.
//
// THE FIX IS NOT MORE PROBES. It is probes derived from the CONTRACT rather than from observed
// failures. If the requested domain is `n < 10`, then 9 must match, 10 must not, 11 must not, and
// -1 and -100 and -10000 must all match - regardless of whether any model has ever got those wrong.
// `0 < n < 10` then dies on inputs nobody had to think of in advance.
//
//     REGRESSION PROBES     derived from failures we have seen        always one model behind
//     CONTRACT PROBES       derived from the obligation itself        adversarial to any realization
//
// WHERE THE EXPECTATIONS COME FROM, and this is the part that must not cheat:
//
//   inputs the requested behaviour claims, and that no preserved behaviour wins  -> the requested result
//   everything else                                                              -> WHAT THE ORIGINAL
//                                                                                   PROGRAM ALREADY DOES
//
// The second clause is preservation stated as an oracle, and it reads the CURRENT PROGRAM - an
// OBSERVE-stage fact - never the reference patch. No expectation here is derived from a solution.
const NL = String.fromCharCode(10);

// Values a small integer domain should always be interrogated at, whatever the contract says. Zero and
// its neighbours earn their place because they are the literals models special-case hardest.
const UNIVERSAL = [0, 1, -1];

// Every numeric literal a condition compares against, with the probe triple around it. A boundary is
// only meaningful as three points: inside, on, and outside.
function triple(v) { return [v - 1, v, v + 1]; }

// Interior points of an unbounded-below interval, spaced so that ANY invented lower bound a model
// might write has something below it. `0 < n < 10` dies at -1; `-50 < n < 10` dies at -100;
// `n > -10000 and n < 10` dies at -1000000.
function deepInterior(hi) {
  return [hi - 2, hi - 10, hi - 100, hi - 10000, hi - 1000000];
}

// AN UNBOUNDED END SURVIVES AS `null` THROUGH JSON, AND THAT SILENTLY WEAKENS THIS MODULE.
//
// `parseCondition` returns lo: -Infinity for `n < 10`. JSON.stringify turns that into null, so a
// domain that has been through a file, a wire or a saved artifact arrives with lo: null. The check
// `lo === -Infinity` is then false, the deep-interior probes never fire, and the probe set drops from
// four negative probes to one - losing exactly the probes that kill an invented lower bound.
//
// Measured, not supposed: live domain 4 negative probes, round-tripped 1.
//
// This is hazard 3c in the ledger, which was recorded as "caught before use". It has now been used.
// Both the normalization and the audit below exist because a weaker probe set must never be a silent
// outcome - the whole point of this module is that a wrong realization has nowhere to hide.
export function normalizeDomain(d) {
  if (!d || d.kind !== 'interval') return d;
  const lo = d.lo === null || d.lo === undefined ? -Infinity : d.lo;
  const hi = d.hi === null || d.hi === undefined ? Infinity : d.hi;
  return { ...d, lo, hi };
}

// Does this probe set actually interrogate the ends the contract left open? An unbounded end with no
// probe far into it is a probe set that cannot see an invented bound, and returning one quietly is the
// failure mode this module was written to end.
export function auditProbeSet(requested, values) {
  const d = normalizeDomain(requested);
  const problems = [];
  if (d && d.kind === 'interval') {
    if (d.lo === -Infinity && d.hi !== Infinity) {
      if (!values.some((v) => v <= d.hi - 100)) problems.push('unbounded below, but no probe 100 or more beneath the upper bound');
    }
    if (d.hi === Infinity && d.lo !== -Infinity) {
      if (!values.some((v) => v >= d.lo + 100)) problems.push('unbounded above, but no probe 100 or more beyond the lower bound');
    }
  }
  return problems;
}

export function containsPoint(domain, v) {
  domain = normalizeDomain(domain);
  if (!domain) return false;
  switch (domain.kind) {
    case 'point': return v === domain.value;
    case 'complement_point': return v !== domain.value;
    case 'universe': return true;
    case 'interval': {
      const okLo = domain.lo === -Infinity || (domain.loOpen ? v > domain.lo : v >= domain.lo);
      const okHi = domain.hi === Infinity || (domain.hiOpen ? v < domain.hi : v <= domain.hi);
      return okLo && okHi;
    }
    default: return false;
  }
}

// The probe VALUES, derived only from the shape of the contract.
export function probeValues({ requested, existing = [] }) {
  requested = normalizeDomain(requested);
  existing = existing.map((b) => ({ ...b, domain: normalizeDomain(b.domain) }));
  const vs = new Set(UNIVERSAL);
  const add = (v) => { if (Number.isFinite(v)) vs.add(v); };

  if (requested) {
    if (requested.kind === 'interval') {
      if (requested.hi !== Infinity) triple(requested.hi).forEach(add);
      if (requested.lo !== -Infinity) triple(requested.lo).forEach(add);
      // An unbounded end is exactly where an invented bound would hide, so probe far into it.
      if (requested.lo === -Infinity && requested.hi !== Infinity) deepInterior(requested.hi).forEach(add);
      if (requested.hi === Infinity && requested.lo !== -Infinity) {
        deepInterior(-requested.lo).map((x) => -x).forEach(add);
      }
    } else if (requested.kind === 'point') {
      triple(requested.value).forEach(add);
    } else if (requested.kind === 'complement_point') {
      triple(requested.value).forEach(add);
    }
  }

  // Every existing behaviour's own boundary, so a realization cannot buy the new behaviour by
  // disturbing an old one just outside where anybody looked.
  for (const b of existing) {
    const d = b.domain;
    if (!d) continue;
    if (d.kind === 'point' || d.kind === 'complement_point') triple(d.value).forEach(add);
    else if (d.kind === 'interval') {
      if (d.lo !== -Infinity) triple(d.lo).forEach(add);
      if (d.hi !== Infinity) triple(d.hi).forEach(add);
    }
  }
  const out = [...vs].sort((a, b) => a - b);
  const gaps = auditProbeSet(requested, out);
  if (gaps.length) {
    throw new Error('probe set is insufficient for the contract: ' + gaps.join('; ')
      + ' - refusing to return a probe set that cannot see an invented bound');
  }
  return out;
}

// The EXPECTATION for each value, from the contract plus the current program.
//
// `originalResult(v)` is supplied by the caller and must evaluate the UNMODIFIED program. That is an
// OBSERVE fact. Passing anything derived from a proposed or reference implementation would turn this
// into an oracle that certifies whatever it was shown, which is the failure this module exists for.
export function contractProbes({ requested, requestedResult, preserved, preservedWins, existing = [] },
  originalResult) {
  const values = probeValues({ requested, existing });
  const out = [];
  for (const v of values) {
    const claimed = containsPoint(requested, v);
    const heldBack = preservedWins && containsPoint(preserved, v);
    const expected = claimed && !heldBack ? requestedResult : originalResult(v);
    out.push({
      input: v,
      expected,
      why: claimed && !heldBack ? 'the requested behaviour claims this input'
        : heldBack ? 'the preserved behaviour wins this input'
          : 'outside the requested domain, so the existing behaviour must survive',
    });
  }
  return out;
}

// Run a probe set against a candidate program. `run` executes the program on one input.
export function checkProbes(probes, run) {
  const failures = [];
  for (const p of probes) {
    let got;
    try { got = run(p.input); } catch (e) { got = 'ERROR: ' + String(e.message).slice(0, 40); }
    if (got !== p.expected) failures.push({ ...p, got });
  }
  return { passed: failures.length === 0, failures, total: probes.length };
}

export { NL };
