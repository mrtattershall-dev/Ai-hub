// GATE 12A — BEHAVIOURAL PREDICATES.
//
// A behaviour is a guarded mapping: "when this condition holds of the input, the result is that". Both
// halves of a precedence question are behaviours - one already in the program, one requested by the
// task - and neither overlap nor precedence can be asked before they are extracted.
//
// TWO SOURCES, DELIBERATELY DIFFERENT SHAPES:
//
//   EXISTING   read from the program: `if <cond>: return <value>` inside a unit
//   REQUESTED  read from the task's delta clause: a condition and a result stated in English
//
// WHAT THIS MUST NOT DO. Per LEGASUS_V7.md the reference patch, its site, its order and its branch
// shape may not answer a precedence question. This module never sees them: it reads the SOURCE (which
// is a current program fact) and the TASK TEXT (which is the specification). It also does not use
// source order - the order predicates appear in is recorded for reporting only and is never evidence.
//
// DOMAIN REPRESENTATION. A condition is normalised to an interval or a point over one variable, which
// is enough for the comparison/equality guards this milestone claims and no more. Anything it cannot
// normalise is returned as `unmodelled` rather than guessed at, so overlap can decline to answer
// instead of inventing a domain.
const NL = String.fromCharCode(10);

// THE CANONICAL MEMBERSHIP PREDICATE LIVES HERE, with the domain model that defines it.
//
// It used to exist twice - once in `legacore/ordering.mjs` and once in `legaverify/probes.mjs` - kept in
// agreement by discipline. Adding the `set` kind exposed that immediately: the ordering copy returned
// false for every set, so `DECIDE` would have called every pair of sets DISJOINT and cheerfully derived
// no precedence at all, while `PROVE` scored them correctly. Silent disagreement between two stages
// about what a domain MEANS is the worst shape of defect this project has.
//
// That is hazard 9's permanent rule, which this file now obeys rather than restates:
//
//     any artifact compared across components has exactly ONE canonical implementation.
//
// `ordering.mjs` and `probes.mjs` both import this one and re-export it, and a test asserts they are
// the same function object rather than merely agreeing today.
export function normalizeDomain(d) {
  if (!d || d.kind !== 'interval') return d;
  const lo = d.lo === null || d.lo === undefined ? -Infinity : d.lo;
  const hi = d.hi === null || d.hi === undefined ? Infinity : d.hi;
  return { ...d, lo, hi };
}

export function containsPoint(domain, v) {
  const d = normalizeDomain(domain);
  if (!d) return false;
  switch (d.kind) {
    case 'point': return v === d.value;
    case 'complement_point': return v !== d.value;
    case 'universe': return true;
    case 'interval': {
      const okLo = d.lo === -Infinity || (d.loOpen ? v > d.lo : v >= d.lo);
      const okHi = d.hi === Infinity || (d.hiOpen ? v < d.hi : v <= d.hi);
      return okLo && okHi;
    }
    case 'set': return d.values.includes(v);
    case 'prefix': return typeof v === 'string' && v.startsWith(d.prefix);
    case 'suffix': return typeof v === 'string' && v.endsWith(d.suffix);
    default: return false;
  }
}

// ---- numeric domains over a single variable.
// { kind: 'interval', lo, hi, loOpen, hiOpen } with -Infinity/Infinity for unbounded ends,
// { kind: 'point', value }, { kind: 'set', values }, { kind: 'universe' }, or
// { kind: 'unmodelled', text }.
// Strip ONE wrapping pair of parentheses, and only when they are actually a matched pair around the
// whole expression.
//
// The previous version stripped a leading `(` or a trailing `)` independently, which was harmless while
// every condition was a bare comparison and became a silent defect the moment `n in (1, 5, 9)` existed:
// the trailing paren was removed, the membership pattern no longer matched, and the domain came back
// `unmodelled` instead of a set. It would also have mangled `(a) and (b)` into `a) and (b`.
function stripWrappingParens(s) {
  let t = s;
  for (;;) {
    if (!(t.startsWith('(') && t.endsWith(')'))) return t;
    let depth = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '(') depth++;
      else if (t[i] === ')') {
        depth--;
        // The opening paren closed before the end, so the outer pair is not a wrapper.
        if (depth === 0 && i !== t.length - 1) return t;
      }
    }
    if (depth !== 0) return t;
    t = t.slice(1, -1).trim();
  }
}

export function parseCondition(text) {
  const t = stripWrappingParens(String(text || '').trim());
  if (!t) return { kind: 'unmodelled', text: String(text || '') };

  let m = t.match(/^([A-Za-z_]\w*)\s*==\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return { kind: 'point', variable: m[1], value: Number(m[2]) };

  m = t.match(/^([A-Za-z_]\w*)\s*(<=|>=|<|>)\s*(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const v = Number(m[3]);
    if (m[2] === '<') return { kind: 'interval', variable: m[1], lo: -Infinity, hi: v, loOpen: true, hiOpen: true };
    if (m[2] === '<=') return { kind: 'interval', variable: m[1], lo: -Infinity, hi: v, loOpen: true, hiOpen: false };
    if (m[2] === '>') return { kind: 'interval', variable: m[1], lo: v, hi: Infinity, loOpen: true, hiOpen: true };
    return { kind: 'interval', variable: m[1], lo: v, hi: Infinity, loOpen: false, hiOpen: true };
  }

  m = t.match(/^([A-Za-z_]\w*)\s*!=\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return { kind: 'complement_point', variable: m[1], value: Number(m[2]) };

  // ---- SET MEMBERSHIP, and it is here because every claim in this program so far rests on integer
  // INTERVALS over one function shape. Intervals make containment easy and make one relation
  // unreachable: two intervals that overlap without nesting are rare in a specification, and prefixes
  // or ranges cannot express "shares some values with you but neither contains the other" naturally.
  //
  // Finite sets can express all three relations, which is what makes them the right second domain kind:
  //
  //     {1,3,5} vs {3,5}     CONTAINMENT, and the subset must win where they overlap
  //     {1,3}   vs {5,7}     DISJOINT, so any order is legal
  //     {1,3}   vs {3,5}     INTERSECTING WITHOUT CONTAINMENT - the UNDETERMINED case, which the
  //                          architecture must REFUSE rather than order arbitrarily
  //
  // A set is also not an interval in disguise: {1, 5, 9} has no lo/hi that describes it, so anything
  // downstream that secretly assumed bounds will break here rather than quietly agree.
  m = t.match(/^([A-Za-z_]\w*)\s+in\s*[([{]([^)\]}]*)[)\]}]$/);
  if (m) {
    const raw = m[2].split(',').map((x) => x.trim()).filter((x) => x.length);
    if (raw.length && raw.every((x) => /^-?\d+(?:\.\d+)?$/.test(x))) {
      // Sorted and de-duplicated, so two spellings of the same set are the same domain.
      const values = [...new Set(raw.map(Number))].sort((x, y) => x - y);
      return { kind: 'set', variable: m[1], values };
    }
    // ---- STRING ATOMS. The same `set` kind, with string members instead of numbers.
    //
    // This is where the assumption that atoms are NUMBERS gets tested. A set of strings has no
    // arithmetic at all: no neighbours, no triple around a member, no gaps to probe between "cat" and
    // "dog". Anything downstream that reached for a number will fail here rather than quietly agree.
    if (raw.length && raw.every((x) => /^(["'])(?:(?!\1).)*\1$/.test(x))) {
      const values = [...new Set(raw.map((x) => x.slice(1, -1)))].sort();
      return { kind: 'set', variable: m[1], atom: 'string', values };
    }
  }

  // ---- PREFIX and SUFFIX domains. The relation that makes these worth having is CONTAINMENT WITH A
  // COMPLETELY DIFFERENT IMPLEMENTATION:
  //
  //     startswith("a")  strictly contains  startswith("admin_")
  //
  // Every string beginning "admin_" begins "a", so narrow-before-broad is derivable - and there is no
  // interval, no neighbouring integer, no `triple(v)` and no sparse-set gap anywhere in that reasoning.
  // If `DECIDE` can still derive the precedence and `PROVE` can still validate it, the architecture is
  // reasoning over semantic relations rather than over numeric convention.
  m = t.match(/^([A-Za-z_]\w*)\s*\.\s*startswith\s*\(\s*(["'])((?:(?!\2).)*)\2\s*\)$/i);
  if (m) return { kind: 'prefix', variable: m[1], atom: 'string', prefix: m[3] };

  m = t.match(/^([A-Za-z_]\w*)\s*\.\s*endswith\s*\(\s*(["'])((?:(?!\2).)*)\2\s*\)$/i);
  if (m) return { kind: 'suffix', variable: m[1], atom: 'string', suffix: m[3] };

  m = t.match(/^([A-Za-z_]\w*)\s*==\s*(["'])((?:(?!\2).)*)\2$/);
  if (m) return { kind: 'set', variable: m[1], atom: 'string', values: [m[3]] };

  return { kind: 'unmodelled', text: t };
}

// Which kind of atom does this domain range over? Comparing a numeric domain to a string one is not a
// relation this algebra can decide, and saying so is the correct answer rather than a failure.
export function atomKindOf(d) {
  if (!d) return null;
  if (d.atom === 'string') return 'string';
  switch (d.kind) {
    case 'interval': case 'point': case 'complement_point': return 'number';
    case 'set': return d.values.every((v) => typeof v === 'number') ? 'number'
      : d.values.every((v) => typeof v === 'string') ? 'string' : null;
    case 'prefix': case 'suffix': return 'string';
    case 'universe': return null;
    default: return null;
  }
}

// ---- EXISTING behaviours, read from the program.
// `if <cond>: return <value>` at any depth inside a unit. The fall-through `return <value>` with no
// guard is recorded as the universe, because it applies whenever nothing above it did - which is a
// statement about the program, not about order.
export function existingBehaviours(src, unitName) {
  const lines = src.split(NL);
  const out = [];
  let inUnit = !unitName;
  let unitIndent = -1;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const head = raw.match(/^(\s*)def\s+(\w+)\s*\(/);
    if (head) {
      inUnit = !unitName || head[2] === unitName;
      unitIndent = head[1].length;
      continue;
    }
    if (!inUnit) continue;
    if (unitIndent >= 0 && raw.trim() && (raw.match(/^\s*/)[0].length <= unitIndent)) { inUnit = !unitName; continue; }

    const guarded = raw.match(/^\s*if\s+(.+?)\s*:\s*$/);
    if (guarded) {
      const next = lines[i + 1] || '';
      const ret = next.match(/^\s*return\s+(.+?)\s*$/);
      if (ret) out.push({ source: 'program', line: i, condition: guarded[1], domain: parseCondition(guarded[1]), result: ret[1].trim() });
      continue;
    }
    const bare = raw.match(/^\s*return\s+(.+?)\s*$/);
    if (bare && raw.match(/^\s*/)[0].length === unitIndent + 4) {
      out.push({ source: 'program', line: i, condition: null, domain: { kind: 'universe' }, result: bare[1].trim(), fallthrough: true });
    }
  }
  return out;
}

// ---- REQUESTED behaviour, read from the task's delta text.
//
// English condition forms, kept to the shapes a specification actually uses. A form this does not
// recognise yields `unmodelled` and the pipeline declines rather than guessing - the same discipline
// as an unresolved provider.
const COND_FORMS = [
  [/\b([a-z_]\w*)\s*(?:is\s+)?below\s+(-?\d+)/i, (m) => m[1] + ' < ' + m[2]],
  [/\b([a-z_]\w*)\s*(?:is\s+)?under\s+(-?\d+)/i, (m) => m[1] + ' < ' + m[2]],
  [/\b([a-z_]\w*)\s*(?:is\s+)?(?:greater than|above|over)\s+(-?\d+)/i, (m) => m[1] + ' > ' + m[2]],
  [/\b([a-z_]\w*)\s*(?:is\s+)?(?:less than)\s+(-?\d+)/i, (m) => m[1] + ' < ' + m[2]],
  [/\b([a-z_]\w*)\s*(?:is\s+)?(?:equal to|exactly)\s+(-?\d+)/i, (m) => m[1] + ' == ' + m[2]],
  [/\b([a-z_]\w*)\s*(<=|>=|<|>|==)\s*(-?\d+)/, (m) => m[1] + ' ' + m[2] + ' ' + m[3]],
  // Set membership in prose: "for the values 1, 3 and 5" / "n is one of 1, 3, 5".
  [/\b([a-z_]\w*)\s*(?:is\s+)?(?:one of|among|in)\s+((?:-?\d+)(?:\s*(?:,|and|or)\s*-?\d+)+)/i,
    (m) => m[1] + ' in (' + m[2].split(/\s*(?:,|and|or)\s*/).map((x) => x.trim())
      .filter((x) => x.length).join(', ') + ')'],
];

// A specification usually names the quantity generically - "values below 10" - rather than by the
// parameter name. Binding a generic subject to the variable is a real reading capability, but it is
// only unambiguous when the unit has exactly ONE parameter. With several parameters "values" could mean
// any of them, and the honest answer is to decline rather than pick.
const GENERIC_SUBJECT = new Set(['value', 'values', 'number', 'numbers', 'input', 'inputs',
  'item', 'items', 'result', 'results', 'they', 'it', 'them']);

export function requestedBehaviour(deltaText, variable, opts) {
  const soleParameter = !!(opts && opts.soleParameter);
  const t = String(deltaText || '');
  let condition = null;
  for (const [re, build] of COND_FORMS) {
    const m = t.match(re);
    if (!m) continue;
    let expr = build(m);
    const subject = expr.split(' ')[0];
    if (variable && subject !== variable) {
      // Rebind a GENERIC subject to the sole parameter; refuse anything else.
      if (soleParameter && GENERIC_SUBJECT.has(subject.toLowerCase())) {
        expr = variable + expr.slice(subject.length);
      } else {
        continue;
      }
    }
    condition = expr;
    break;
  }
  const res = t.match(/return\s+"([^"]+)"|returns?\s+"([^"]+)"|reported as\s+"([^"]+)"|as\s+"([^"]+)"/i);
  const result = res ? '"' + (res[1] || res[2] || res[3] || res[4]) + '"' : null;
  return {
    source: 'requested_delta',
    condition,
    domain: condition ? parseCondition(condition) : { kind: 'unmodelled', text: t.slice(0, 60) },
    result,
  };
}

export { NL };
