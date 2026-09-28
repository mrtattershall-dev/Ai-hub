// GATE 12B — OVERLAP.
//
// Can two normalised domains both apply to one input? That is the whole question. This module knows
// NOTHING about precedence, results, tasks or which behaviour is new. Given the same two domains it
// returns the same answer whatever the surrounding intent - which is exactly what makes the
// must-distinguish pair meaningful later: cases A and B must produce byte-identical output here, and
// only 12C may diverge.
//
//     SATISFIABLE   with a witness value, INDEPENDENTLY VERIFIED against both predicates
//     DISJOINT      with the bound arithmetic that proves the intersection empty
//     UNKNOWN       at least one domain is outside the supported algebra
//
// UNKNOWN IS LOAD-BEARING. `unmodelled` must propagate as uncertainty and must NEVER become "no
// overlap" - a system that silently reads unknown as disjoint would declare precedence unnecessary
// exactly when it cannot tell.
//
// THE WITNESS CARRIES ITS OWN EVIDENCE. The bounds say where an intersection should be; the witness is
// then checked by evaluating BOTH predicates against it directly. If the bounds claim a non-empty
// intersection and no value can be verified, the answer is UNKNOWN, not SATISFIABLE. Same rule as
// everywhere else: the claim carries evidence rather than asserting it.
//
// DELIBERATELY NOT A THEOREM PROVER. It handles the point / interval / universe / complement-point
// forms that 12A produces and nothing else. Broadening the algebra to make a witness set prettier
// would be broadening the claim.

// Does a value satisfy a domain? `null` means the domain cannot answer.
export function satisfies(domain, v) {
  if (!domain) return null;
  switch (domain.kind) {
    case 'universe': return true;
    case 'point': return v === domain.value;
    case 'complement_point': return v !== domain.value;
    case 'interval': {
      const okLo = domain.loOpen ? v > domain.lo : v >= domain.lo;
      const okHi = domain.hiOpen ? v < domain.hi : v <= domain.hi;
      return okLo && okHi;
    }
    default: return null;
  }
}

// An interval view with excluded points, so all four supported forms intersect uniformly.
function view(d) {
  switch (d.kind) {
    case 'universe': return { lo: -Infinity, hi: Infinity, loOpen: true, hiOpen: true, excluded: [] };
    case 'point': return { lo: d.value, hi: d.value, loOpen: false, hiOpen: false, excluded: [] };
    case 'complement_point':
      return { lo: -Infinity, hi: Infinity, loOpen: true, hiOpen: true, excluded: [d.value] };
    case 'interval':
      return { lo: d.lo, hi: d.hi, loOpen: d.loOpen, hiOpen: d.hiOpen, excluded: [] };
    default: return null;
  }
}

function intersect(a, b) {
  const lo = Math.max(a.lo, b.lo);
  const hi = Math.min(a.hi, b.hi);
  const loOpen = (a.lo === lo && a.loOpen) || (b.lo === lo && b.loOpen);
  const hiOpen = (a.hi === hi && a.hiOpen) || (b.hi === hi && b.hiOpen);
  return { lo, hi, loOpen, hiOpen, excluded: [...a.excluded, ...b.excluded] };
}

// Candidate witnesses inside a bounded region. Small and explicit: every one is verified before use,
// so the list only has to be plausible, never complete.
function candidateValues(r) {
  const out = [];
  if (isFinite(r.lo)) { out.push(r.lo, r.lo + 1, Math.ceil(r.lo)); }
  if (isFinite(r.hi)) { out.push(r.hi, r.hi - 1, Math.floor(r.hi)); }
  if (isFinite(r.lo) && isFinite(r.hi)) {
    out.push((r.lo + r.hi) / 2);
    for (let v = Math.ceil(r.lo); v <= Math.floor(r.hi) && out.length < 40; v++) out.push(v);
  }
  out.push(0, 1, -1);
  return [...new Set(out)];
}

export function overlap(a, b) {
  if (!a || !b || a.kind === 'unmodelled' || b.kind === 'unmodelled') {
    return { result: 'UNKNOWN',
      reason: 'at least one domain is outside the supported algebra, so overlap cannot be decided. '
        + 'Unknown is NOT no-overlap.',
      unmodelled: [a && a.kind === 'unmodelled' ? (a.text || 'A') : null,
        b && b.kind === 'unmodelled' ? (b.text || 'B') : null].filter(Boolean) };
  }
  // Two domains over different variables are not comparable by this algebra.
  if (a.variable && b.variable && a.variable !== b.variable) {
    return { result: 'UNKNOWN',
      reason: 'the domains constrain different variables (`' + a.variable + '` and `' + b.variable
        + '`), which this algebra does not relate' };
  }

  const va = view(a);
  const vb = view(b);
  if (!va || !vb) return { result: 'UNKNOWN', reason: 'a domain form has no interval view' };
  const r = intersect(va, vb);

  const emptyByBounds = r.lo > r.hi
    || (r.lo === r.hi && (r.loOpen || r.hiOpen))
    || (r.lo === r.hi && r.excluded.includes(r.lo));
  if (emptyByBounds) {
    return { result: 'DISJOINT',
      reason: 'the intersection is empty by bounds: '
        + (r.loOpen ? '(' : '[') + r.lo + ', ' + r.hi + (r.hiOpen ? ')' : ']')
        + (r.excluded.length ? ' excluding ' + JSON.stringify(r.excluded) : ''),
      bounds: r };
  }

  // The bounds say something should be here. Prove it by evaluating BOTH predicates directly.
  for (const v of candidateValues(r)) {
    if (satisfies(a, v) === true && satisfies(b, v) === true) {
      return { result: 'SATISFIABLE', witness: v,
        verified: { a: satisfies(a, v), b: satisfies(b, v) },
        reason: 'value ' + v + ' satisfies both predicates, checked against each directly rather than '
          + 'inferred from the bounds' };
    }
  }
  return { result: 'UNKNOWN',
    reason: 'the bounds suggest a non-empty intersection but no candidate value could be VERIFIED '
      + 'against both predicates, so satisfiability is not claimed',
    bounds: r };
}
