// LegaParse SITE SEMANTICS — a site is a legal REGION, not a line.
//
// The reference patch's chosen line is one legal member of an equivalence class, exactly as its
// operation sequence is one legal topological order. Scoring against the line turns an authoring
// accident into an oracle.
//
// THE DEFINITION, fixed before it is used to rescore anything:
//
//   Two candidate positions are SITE-EQUIVALENT for an operation when placing that operation at either
//   position gives it the same structural parent, satisfies the same prerequisite/dependency
//   constraints, grants the same scope visibility, preserves the same ownership and control-flow
//   invariants, and does not change the externally observable semantics relevant to the contract.
//
// THE ANTI-CHEAT: `legalRegion` takes the program and the OPERATION'S REQUIREMENTS. It never sees the
// selector's proposed position. Otherwise the class could be widened after the fact until the answer
// fits, which is the same failure as tuning a tolerance.
//
// TWO METRICS ARE KEPT, never collapsed:
//     EXACT_POSITION_MATCH      derived boundary == reference boundary
//     SITE_EQUIVALENCE_MATCH    derived boundary lies in the same legal region
// Reporting only the second would hide that a03 was placed differently; reporting only the first
// pretends textual identity is semantic correctness.
const NL = String.fromCharCode(10);
const ind = (l) => (l.match(/^[ \t]*/) || [''])[0].length;

// The body range of a structural parent: the module, or a named unit.
function parentRange(lines, parent) {
  if (!parent || parent === 'module') return { lo: 0, hi: lines.length - 1, indent: 0 };
  const name = String(parent).split('.').pop();
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(new RegExp('^(\\s*)(?:def|class)\\s+' + name + '\\b'));
    if (!m) continue;
    const base = m[1].length;
    let end = i;
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].trim()) continue;
      if (ind(lines[j]) <= base) break;
      end = j;
    }
    return { lo: i + 1, hi: end, indent: base + 4 };
  }
  return null;
}

// The last line at or above which a required symbol becomes available.
function definedAt(lines, sym) {
  const re = new RegExp('^\\s*(?:def\\s+' + sym + '\\b|(?:self\\.)?' + sym + '\\s*=(?!=))');
  let last = -1;
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) last = i;
  return last;
}

// The first line at which a provided symbol is consumed, which the definition must precede.
function firstUse(lines, sym, excludeDef = true) {
  const use = new RegExp('\\b' + sym + '\\s*\\(|\\b' + sym + '\\b');
  const def = new RegExp('^\\s*(?:def\\s+' + sym + '\\b|(?:self\\.)?' + sym + '\\s*=(?!=))');
  for (let i = 0; i < lines.length; i++) {
    if (excludeDef && def.test(lines[i])) continue;
    if (use.test(lines[i])) return i;
  }
  return lines.length;
}

// A terminator ends reachability for anything placed after it within the same block.
function terminatorBefore(lines, lo, hi, indent) {
  for (let i = lo; i <= hi && i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    if (ind(lines[i]) === indent && /^\s*(?:return|continue|break|raise)\b/.test(lines[i])) return i;
  }
  return -1;
}

// THE LEGAL REGION for an operation, computed from its requirements alone.
//
//   kind 'sibling_def'  a new definition in a parent body: after everything it requires, before the
//                       first place its own product is consumed.
//   kind 'branch'       a new branch in a control-flow region: within the region, and BEFORE the
//                       fall-through owner, because a branch placed after it never runs.
//   kind 'statement'    a statement in a scope: after its reaching definitions, before its first use.
export function legalRegion(src, op) {
  const lines = src.split(NL);
  const pr = parentRange(lines, op.parent_scope);
  if (!pr) return { ok: false, why: 'parent scope ' + op.parent_scope + ' not found' };

  let lo = pr.lo;
  let hi = pr.hi;
  const bounds = [];
  for (const sym of op.requires || []) {
    const d = definedAt(lines, sym);
    if (d >= 0 && d + 1 > lo) { lo = d + 1; bounds.push('after `' + sym + '` is defined at line ' + d); }
  }
  for (const sym of op.provides || []) {
    const u = firstUse(lines, sym);
    if (u - 1 < hi) { hi = u - 1; bounds.push('before `' + sym + '` is first used at line ' + u); }
  }
  // Reachability: a branch must precede the fall-through owner, and nothing may sit after a terminator
  // in the same block.
  if (op.kind === 'branch' && op.fallthrough_line !== undefined && op.fallthrough_line - 1 < hi) {
    hi = op.fallthrough_line - 1;
    bounds.push('before the fall-through owner at line ' + op.fallthrough_line);
  }
  const t = terminatorBefore(lines, lo, hi, op.indent === undefined ? pr.indent : op.indent);
  if (t >= 0 && t < hi) { hi = t; bounds.push('not past the terminator at line ' + t); }

  return { ok: lo <= hi, lo, hi, parent: op.parent_scope, kind: op.kind, bounds,
    why: lo <= hi ? null : 'constraints leave no legal position' };
}

// STRUCTURAL PARENT of an insertion, which a numeric range cannot express.
//
// Inserting "after line N at indent I" lands in the innermost block whose body sits at indent <= I and
// which contains N. Line 10 of a function may be numerically inside a loop's legal range and still
// belong to the function body rather than the loop - a range check alone called those equivalent, which
// is how the terminator witness failed.
export function structuralParent(src, pos, indent) {
  const lines = src.split(NL);
  let best = null;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)(?:def|class|if|elif|else|for|while|try|except|with)\b/);
    if (!m) continue;
    const base = m[1].length;
    const bodyIndent = base + 4;
    if (bodyIndent > indent) continue;          // deeper than where the new code will live
    let end = i;
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].trim()) continue;
      if (ind(lines[j]) <= base) break;
      end = j;
    }
    if (pos > i && pos <= end && (best === null || i > best.line)) best = { line: i, header: lines[i].trim() };
  }
  return best;
}

// Same region AND same structural parent -> site-equivalent.
export function siteEquivalent(src, op, posA, posB) {
  const r = legalRegion(src, op);
  if (!r.ok) return { equivalent: false, why: r.why, region: r };
  const inA = posA >= r.lo && posA <= r.hi;
  const inB = posB >= r.lo && posB <= r.hi;
  const indent = op.indent === undefined ? 0 : op.indent;
  const pa = structuralParent(src, posA, indent);
  const pb = structuralParent(src, posB, indent);
  const sameParent = (pa ? pa.line : -1) === (pb ? pb.line : -1);
  const equivalent = inA && inB && sameParent;
  return { equivalent, inA, inB, sameParent, region: r,
    parentA: pa ? pa.header : '<module>', parentB: pb ? pb.header : '<module>',
    why: !inA ? 'derived position ' + posA + ' is outside [' + r.lo + ',' + r.hi + ']'
      : !inB ? 'reference position ' + posB + ' is outside [' + r.lo + ',' + r.hi + ']'
        : !sameParent ? 'different structural parent: ' + (pa ? pa.header : '<module>') + ' vs ' + (pb ? pb.header : '<module>')
          : 'same legal region and same structural parent' + (r.bounds.length ? ' (' + r.bounds.join('; ') + ')' : '') };
}

// Both metrics, never collapsed into one.
export function scorePosition(src, op, derived, reference) {
  const eq = siteEquivalent(src, op, derived, reference);
  return {
    EXACT_POSITION_MATCH: derived === reference,
    SITE_EQUIVALENCE_MATCH: eq.equivalent,
    region: eq.region.ok ? [eq.region.lo, eq.region.hi] : null,
    why: eq.why,
  };
}
