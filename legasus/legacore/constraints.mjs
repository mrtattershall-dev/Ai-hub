// LegaCore CONSTRAINT DERIVATION.
//
// THE RULE THIS FILE IS BUILT AROUND:
//
//     A constraint does not exist unless its witness can be INDEPENDENTLY REPLAYED.
//
// Otherwise `"op B must follow op A"` is planner prose with a number attached. Every constraint here
// carries a structured witness and a `replay` that re-derives the claim from the source and the
// transaction alone. `verify()` runs those replays over a constraint set and refuses any that cannot
// reproduce itself.
//
// WHAT DERIVATION MAY NOT SEE. The narrowability ground truth - which positions actually fail when the
// probes run - is the ANSWER. Nothing in this file may read it. Constraints are derived from the
// program text and the planned operations; the executable ground truth is used only afterwards, by the
// scorer, to check whether each removed boundary genuinely fails. That separation is the whole reason
// a recovered bit means anything.
//
// COMPOSITION IS MECHANICAL, so every bit has a forensic chain:
//
//     intrinsic region  n  constraint 1  n  constraint 2  n ...  =  transaction-constrained region
//
//        20 boundaries
//        -> ownership constraint      18
//        -> control-flow constraint   12
//        -> symbol availability        7
//        total gain = log2(20/7)
//
// and "where did those bits come from" has a three-witness answer.
//
// STYLE IS NOT A CONSTRAINT. "Put the new helper beside the other helpers" may produce a prettier
// patch and may even reproduce the reference exactly. Unless moving it elsewhere violates semantics it
// is recorded as `canonical_realization` with `gain_bits: 0` and never narrows anything. That keeps the
// quality layer available without letting taste be promoted into semantic necessity.
const NL = String.fromCharCode(10);
const ind = (l) => (l.match(/^[ \t]*/) || [''])[0].length;
const ESC = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Body extents of every compound construct: header line -> last line of its body.
function bodies(src) {
  const lines = src.split(NL);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)(?:def|class|if|elif|else|for|while|try|except|with)\b/);
    if (!m) continue;
    const base = m[1].length;
    let end = i;
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].trim()) continue;
      if (ind(lines[j]) <= base) break;
      end = j;
    }
    if (end > i) out.push({ header: i, base, bodyIndent: base + 4, end, text: lines[i].trim() });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// KIND: ownership_boundary
// A structural insertion at indent I placed strictly inside the body of a sibling construct whose body
// sits deeper than I terminates that body early and orphans the rest of it. This is what actually
// breaks e05 op2: a method dropped part-way through __init__ ends the constructor, so the declaration
// that follows lands outside the method and every later access fails.
function ownershipBoundary(ctx) {
  const { src, indent } = ctx;
  const out = [];
  for (const b of bodies(src)) {
    if (b.bodyIndent <= indent) continue;          // not deeper than the insertion: cannot be split
    const forbidden = [];
    for (let p = b.header; p < b.end; p++) forbidden.push(p);
    if (!forbidden.length) continue;
    out.push({
      kind: 'ownership_boundary',
      claim: 'the insertion must not fall inside the body of `' + b.text + '` (lines '
        + (b.header + 1) + '-' + b.end + ')',
      witness: { rule: 'body_split', header_line: b.header, body_end: b.end,
        body_indent: b.bodyIndent, insertion_indent: indent,
        detail: 'that body is indented to ' + b.bodyIndent + ', deeper than the insertion indent '
          + indent + ', so an insertion inside it terminates the body early and orphans lines '
          + '(p+1)-' + b.end },
      forbids: forbidden,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// KIND: control_flow_boundary
// Nothing placed after a terminator at the same indent in the same block ever executes. A dispatch
// branch after the fall-through return is dead code that still type-checks.
function controlFlowBoundary(ctx) {
  const { src, indent, parentRange } = ctx;
  const lines = src.split(NL);
  const out = [];
  if (!parentRange) return out;
  for (let i = parentRange.lo; i <= parentRange.hi && i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    if (ind(lines[i]) !== indent) continue;
    if (!/^\s*(?:return|continue|break|raise)\b/.test(lines[i])) continue;
    const forbidden = [];
    for (let p = i; p <= parentRange.hi; p++) forbidden.push(p);
    out.push({
      kind: 'control_flow_boundary',
      claim: 'the insertion must precede the terminator at line ' + i,
      witness: { rule: 'unreachable_after_terminator', terminator_line: i,
        terminator: lines[i].trim(), indent,
        detail: 'line ' + i + ' terminates this block at the insertion indent, so anything placed '
          + 'after it in the same block never executes' },
      forbids: forbidden,
    });
    break;                                          // the FIRST terminator is the binding one
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// KIND: symbol_availability
// A definition must precede any use that executes at IMPORT time. A mention inside a def or class body
// is deferred - Python resolves it when that function RUNS - and is deliberately not a constraint here.
// Treating a textual mention as a dependency manufactures false constraints, which this project has
// already caught once in a witness it wrote itself.
function symbolAvailability(ctx) {
  const { src, provides, parentRange } = ctx;
  const lines = src.split(NL);
  const out = [];
  for (const sym of provides || []) {
    let bodyOf = -1;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.trim()) continue;
      const head = l.match(/^(\s*)(?:def|class)\b/);
      if (head) { bodyOf = head[1].length; continue; }
      if (bodyOf >= 0 && ind(l) > bodyOf) continue;             // deferred
      if (ind(l) <= bodyOf) bodyOf = -1;
      if (new RegExp('^\\s*(?:def\\s+' + ESC(sym) + '\\b|(?:self\\.)?' + ESC(sym) + '\\s*=(?!=))').test(l)) continue;
      if (!new RegExp('\\b' + ESC(sym) + '\\b').test(l)) continue;
      const forbidden = [];
      const hi = parentRange ? parentRange.hi : lines.length - 1;
      for (let p = i - 1; p <= hi; p++) if (p >= 0) forbidden.push(p);
      out.push({
        kind: 'symbol_availability',
        claim: '`' + sym + '` must be defined before line ' + i + ', which uses it at import time',
        witness: { rule: 'import_time_use', use_line: i, symbol: sym, text: l.trim(),
          detail: 'line ' + i + ' sits at module level outside any def or class, so it executes when '
            + 'the module loads; a definition placed after it does not exist yet' },
        forbids: forbidden,
      });
      break;                                        // the FIRST import-time use is the binding one
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// KIND: canonical_realization — recorded, never narrowing.
// This is the style negative control made into a first-class output rather than an omission. It fires
// on exactly the reasoning that would be tempting to count, and carries gain_bits 0 by construction.
function canonicalRealization(ctx) {
  const { src, indent, siblingKind } = ctx;
  if (!siblingKind) return [];
  const lines = src.split(NL);
  const near = [];
  for (let i = 0; i < lines.length; i++) {
    if (ind(lines[i]) === indent && new RegExp('^\\s*' + siblingKind + '\\b').test(lines[i])) near.push(i);
  }
  if (!near.length) return [];
  return [{
    kind: 'canonical_realization',
    claim: 'convention would place the new `' + siblingKind + '` beside the existing ones at lines '
      + near.join(', '),
    witness: { rule: 'sibling_proximity', sibling_lines: near,
      detail: 'moving the insertion away from these does not violate any semantic requirement, so '
        + 'this is a preference about the resulting patch and not a fact about legality' },
    forbids: [],                                    // deliberately empty: style narrows NOTHING
    gain_bits: 0,
    scope: 'engineering_choice',
  }];
}

const DERIVERS = [ownershipBoundary, controlFlowBoundary, symbolAvailability, canonicalRealization];

// ---------------------------------------------------------------------------------------------------
// Derive, then COMPOSE by intersection, recording the effect of each constraint in order so the chain
// is forensic rather than a single final number.
export function constrain(ctx, candidates) {
  const raw = DERIVERS.flatMap((d) => d(ctx));
  let region = [...candidates];
  const chain = [];
  let n = 0;
  for (const c of raw) {
    const before = region.length;
    const forbid = new Set(c.forbids || []);
    const after = region.filter((p) => !forbid.has(p));
    const removed = before - after.length;
    const gain = c.scope === 'engineering_choice' || after.length === 0 || removed === 0
      ? 0 : Math.log2(before / after.length);
    chain.push({
      constraint_id: 'c' + (++n),
      operation_id: ctx.operation_id || null,
      kind: c.kind,
      claim: c.claim,
      witness: c.witness,
      before_region: before,
      after_region: after.length,
      effect: removed ? 'removed ' + removed + ' boundary(ies)' : 'removed none',
      gain_bits: gain,
      scope: c.scope || 'transaction_derived',
      removed_positions: region.filter((p) => forbid.has(p)),
    });
    // A constraint that empties the region is refused rather than applied: an operation with nowhere
    // legal to go means the derivation is wrong, not that the program is impossible.
    if (after.length > 0) region = after;
  }
  const total = candidates.length && region.length
    ? Math.log2(candidates.length / region.length) : 0;
  return { candidates: candidates.length, region, constrained: region.length,
    total_gain_bits: total, chain };
}

// ---------------------------------------------------------------------------------------------------
// REPLAY. Each witness is re-derived from the source and transaction; a constraint whose claim cannot
// be reproduced is not admissible, regardless of how good its number looked.
export function verify(ctx, chain) {
  const lines = ctx.src.split(NL);
  const out = [];
  for (const c of chain) {
    let ok = false;
    let why = 'unknown kind';
    const w = c.witness || {};
    if (c.kind === 'ownership_boundary') {
      const b = bodies(ctx.src).find((x) => x.header === w.header_line);
      ok = !!b && b.end === w.body_end && b.bodyIndent === w.body_indent && b.bodyIndent > ctx.indent;
      why = ok ? 'body extent re-derived and still deeper than the insertion indent'
        : 'body extent does not re-derive';
    } else if (c.kind === 'control_flow_boundary') {
      const l = lines[w.terminator_line] || '';
      ok = ind(l) === w.indent && /^\s*(?:return|continue|break|raise)\b/.test(l);
      why = ok ? 'terminator re-found at the recorded line and indent' : 'no terminator at that line';
    } else if (c.kind === 'symbol_availability') {
      const l = lines[w.use_line] || '';
      ok = ind(l) === 0 && new RegExp('\\b' + ESC(w.symbol) + '\\b').test(l)
        && !new RegExp('^\\s*(?:def\\s+' + ESC(w.symbol) + '\\b)').test(l);
      why = ok ? 'import-time use re-found at module level' : 'no module-level use at that line';
    } else if (c.kind === 'canonical_realization') {
      ok = c.gain_bits === 0 && (!c.removed_positions || c.removed_positions.length === 0);
      why = ok ? 'style recorded with zero gain and no narrowing, as required'
        : 'STYLE NARROWED SOMETHING - this is the forbidden promotion of taste to necessity';
    }
    out.push({ constraint_id: c.constraint_id, kind: c.kind, replayed: ok, why });
  }
  return { all_replayed: out.every((r) => r.replayed), results: out };
}

export { bodies };
