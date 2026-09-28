// GATE 12D — THE SEMANTIC INTENT CONTRACT.
//
// What the contract says: these behaviours exist, these domains overlap, and on that overlap this
// behaviour has authority. Nothing else.
//
// WHAT IT MUST NEVER CONTAIN: a site, a line number, an ordering, `elif`, "place after", a function
// extent, or any reference identifier. The contract states SEMANTICS and leaves the implementation
// free - that underdetermination is the property, not a shortcoming. A contract admitting exactly one
// implementation would have encoded the patch.
//
// BOUNDS ARE TAGGED, NEVER RAW NUMBERS. `JSON.stringify(-Infinity)` is `null`, and `-5 > null` is
// false, so an unbounded domain round-tripped through JSON silently inverts: `n < 10` stops matching
// negative numbers with no error anywhere. Every bound is therefore encoded as an explicit tagged
// value, and the round trip is checked SEMANTICALLY - the decoded domain must answer identically at
// representative inputs, not merely look equal.
const NL = String.fromCharCode(10);

const encodeBound = (v, inclusive) => {
  if (v === -Infinity) return { kind: 'negative_infinity' };
  if (v === Infinity) return { kind: 'positive_infinity' };
  return { kind: 'finite', value: v, inclusive: !!inclusive };
};
const decodeBound = (b) => {
  if (!b) return null;
  if (b.kind === 'negative_infinity') return { value: -Infinity, inclusive: false };
  if (b.kind === 'positive_infinity') return { value: Infinity, inclusive: false };
  return { value: b.value, inclusive: !!b.inclusive };
};

export function encodeDomain(d) {
  switch (d.kind) {
    case 'point':
      return { kind: 'point', variable: d.variable, value: d.value };
    case 'complement_point':
      return { kind: 'complement_point', variable: d.variable, value: d.value };
    case 'universe':
      return { kind: 'universe' };
    case 'interval':
      return { kind: 'interval', variable: d.variable,
        lower: encodeBound(d.lo, !d.loOpen), upper: encodeBound(d.hi, !d.hiOpen) };
    default:
      return { kind: 'unmodelled', text: d.text || null };
  }
}

export function decodeDomain(e) {
  switch (e.kind) {
    case 'point': return { kind: 'point', variable: e.variable, value: e.value };
    case 'complement_point': return { kind: 'complement_point', variable: e.variable, value: e.value };
    case 'universe': return { kind: 'universe' };
    case 'interval': {
      const lo = decodeBound(e.lower);
      const hi = decodeBound(e.upper);
      return { kind: 'interval', variable: e.variable,
        lo: lo.value, hi: hi.value, loOpen: !lo.inclusive, hiOpen: !hi.inclusive };
    }
    default: return { kind: 'unmodelled', text: e.text || '' };
  }
}

// The contract. `precedence.scope` is `overlap` because authority is claimed ONLY over the contested
// inputs - the rest of each domain is uncontested and needs no ruling.
export function emitContract({ existing, requested, overlapResult, precedence }) {
  const c = {
    contract_version: 'semantic-intent/1',
    behaviors: {
      existing: { domain: encodeDomain(existing.domain), result: existing.result },
      requested: { domain: encodeDomain(requested.domain), result: requested.result },
    },
    overlap: { status: overlapResult.result },
    precedence: null,
    evidence_used: precedence.evidence_used || [],
  };
  if (overlapResult.witness !== undefined) c.overlap.witness = overlapResult.witness;
  if (precedence.outcome === 'PRECEDENCE') {
    c.precedence = { winner: precedence.winner, loser: precedence.loser, scope: 'overlap' };
  } else {
    c.precedence = { outcome: precedence.outcome };
  }
  return c;
}

// Representative probe inputs for the semantic round trip. Chosen to straddle the bounds this algebra
// can express rather than to flatter any particular domain.
export const PROBE_INPUTS = [-1000, -100, -5, -1, 0, 1, 3, 4, 5, 9, 10, 11, 100, 1000];

// Does a decoded domain answer identically to the original at every probe input? Equality of JSON is
// not enough - the whole point of the tagged encoding is that the MEANING survives.
export function semanticRoundTrip(domain, satisfies) {
  const back = decodeDomain(encodeDomain(domain));
  const diffs = [];
  for (const v of PROBE_INPUTS) {
    const a = satisfies(domain, v);
    const b = satisfies(back, v);
    if (a !== b) diffs.push({ input: v, before: a, after: b });
  }
  return { identical: diffs.length === 0, diffs, decoded: back };
}

// A contract must not describe an implementation. Checked against the emitted JSON as a whole, because
// leakage is just as damaging in a `reason` string as in a field name.
const IMPLEMENTATION_WORDS = [
  /\bline\s*\d+/i, /\binsert/i, /\belif\b/i, /\bplace\s+(after|before)/i,
  /\b(after|before)\s+the\s+\w+\s+(check|branch|guard)/i, /\bbranch\b/i, /\bsite\b/i,
  /\bop\d+\b/i, /\breference\b/i, /\bpatch\b/i, /\border\b/i,
];
export function leakageScan(contract) {
  const text = JSON.stringify(contract);
  return IMPLEMENTATION_WORDS.filter((re) => re.test(text)).map(String);
}

export { NL };
