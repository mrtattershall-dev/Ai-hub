// LegaCore CONSTRAINT DERIVATION, revision 6.
//
// GATE 9: uses opfacts2, which records SELF-REFERENTIAL BINDINGS. `total = total * SCALE` reads its
// target before writing it, so the prior binding is a genuine requirement. opfacts.mjs is hashed into
// four freeze files and is not edited; this is a successor.
//
// (revision 5's header follows)
// LegaCore CONSTRAINT DERIVATION, revision 5.
//
// GATE 5: adds `expression_continuation`. A position inside an unclosed bracket is not an insertion
// boundary at all - a CURRENT_PROGRAM_FACT that `bodies()` could not see, because it models compound
// statements and knows nothing about a statement continued across lines.
//
// (revision 4's header follows)
// LegaCore CONSTRAINT DERIVATION, revision 4.
//
// GATE 3 defect: an operation inserted into a function body refers to that function's parameters and
// locals. Revision 3 searched only for module-level bindings, found none, and declared the
// requirement UNRESOLVED - a wrong account with a correct region, on three operations.
//
// Scope is inside the declared supported universe, so this adds a resolution state rather than a
// constraint: RESOLVED_ENCLOSING_SCOPE narrows NOTHING. A parameter is bound for the whole body, so no
// boundary inside that body precedes its availability. Treating it as a module binding would
// manufacture an ordering constraint from a name that was never unavailable.
//
// (revision 3's header follows)
// LegaCore CONSTRAINT DERIVATION, revision 3.
//
// WHAT REVISION 2 GOT RIGHT FOR THE WRONG REASON. On h07 the operation required `_round2` and `math`.
// Only `_round2` resolved; `math` was SILENTLY DROPPED because an import is not a provider form the
// search recognises. The derived region was still correct, because `_round2` sits after the import so
// its constraint already implied the import's. Behavioural success concealed an incomplete proof, and
// the family could not tell that apart from the path working.
//
//     CONSTRAINT SUFFICIENCY and REQUIREMENT COMPLETENESS are separate properties.
//
// Revision 3 changes nothing about which constraints are derived. It makes the OMISSION EXPLICIT:
// every immediate requirement is accounted for as resolved or unresolved, the provider's epistemic
// source is recorded, and `requirement_complete` is false whenever anything could not be resolved. So
// even when another constraint happens to subsume a missing one, LegaCore can say "I reached the same
// legal region, but I do not possess a complete dependency account."
//
// (revision 2's header follows)
// LegaCore CONSTRAINT DERIVATION, revision 2.
//
// `constraints.mjs` is NOT edited: it stays frozen with the prospective result it earned
// (ownership PASS/PASS, control-flow PASS/PASS, symbol_availability FAIL/pass). This is a new
// revision, and g01-g06 are now development data for it.
//
// TWO CHANGES, both general rather than patches to the two operations that failed.
//
// 1. BOUNDARIES REPLACE "AFTER LINE N". The old symbol rule forbade positions from `i - 1` where `i`
//    was the import-time use, which threw away a legal boundary. Insertion points are now boundaries
//    between lines and every conversion lives in `boundaries.mjs`, so no consumer does its own
//    arithmetic on a source line.
//
// 2. OPERATIONS HAVE REQUIREMENTS, NOT JUST PRODUCTS. The old rule modelled only what an operation
//    PROVIDES, so `DEFAULTS.update(_timeouts())` - which defines nothing - was invisible and derived
//    no constraint at all where execution permits 8 of 17 positions. The general concept it lacked:
//
//        an operation can impose ordering because of what it CONSUMES, even when it provides nothing.
//
//    Requirements carry an execution PHASE, so a deferred body reference cannot become an ordering
//    dependency by accident - the mistake this project made once in a witness it wrote itself.
import { operationFacts } from './opfacts2.mjs';
import { beforeLine, afterLine, positionToBoundary } from './boundaries.mjs';
import { scopeProviders } from './scopefacts.mjs';
import { continuationConstraint, openAfterLine } from './continuation.mjs';

const NL = String.fromCharCode(10);
const ind = (l) => (l.match(/^[ \t]*/) || [''])[0].length;
const ESC = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

// Which lines of a file execute when it is imported? Everything not inside a `def` body. A class body
// executes; a method body does not. Same phase rule as `opfacts`, applied to whole files.
function immediateLines(src) {
  const lines = src.split(NL);
  const flags = new Array(lines.length).fill(false);
  const stack = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const col = ind(raw);
    while (stack.length && col <= stack[stack.length - 1].indent) stack.pop();
    flags[i] = !stack.some((s) => s.kind === 'def');
    if (/^\s*def\b/.test(raw)) stack.push({ kind: 'def', indent: col });
    else if (/^\s*class\b/.test(raw)) stack.push({ kind: 'class', indent: col });
    else if (/:\s*$/.test(raw)) stack.push({ kind: 'block', indent: col });
  }
  return flags;
}

// Where an existing module-level symbol is bound.
function bindingLine(src, sym) {
  const lines = src.split(NL);
  const re = new RegExp('^(?:def\\s+' + ESC(sym) + '\\b|class\\s+' + ESC(sym) + '\\b|'
    + ESC(sym) + '\\s*=(?!=))');
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) return i;
  return -1;
}

// The first line that CONSUMES a symbol at import time.
function immediateUseLine(src, sym) {
  const lines = src.split(NL);
  const imm = immediateLines(src);
  const use = new RegExp('\\b' + ESC(sym) + '\\b');
  const def = new RegExp('^\\s*(?:def\\s+' + ESC(sym) + '\\b|class\\s+' + ESC(sym) + '\\b|'
    + ESC(sym) + '\\s*=(?!=))');
  for (let i = 0; i < lines.length; i++) {
    if (!imm[i] || !lines[i].trim()) continue;
    if (def.test(lines[i])) continue;
    if (use.test(lines[i].replace(/(['"])(?:\\.|(?!\1)[^\\])*\1/g, '""'))) return i;
  }
  return -1;
}

// ---- ownership_boundary and control_flow_boundary are carried over unchanged. They passed both
// halves prospectively; changing them now would forfeit that standing for no reason.
function ownershipBoundary(ctx) {
  const { src, indent } = ctx;
  const out = [];
  for (const b of bodies(src)) {
    if (b.bodyIndent <= indent) continue;
    const forbidden = [];
    for (let p = b.header; p < b.end; p++) forbidden.push(p);
    if (!forbidden.length) continue;
    out.push({ kind: 'ownership_boundary',
      claim: 'the insertion must not fall inside the body of `' + b.text + '` (lines '
        + (b.header + 1) + '-' + b.end + ')',
      witness: { rule: 'body_split', header_line: b.header, body_end: b.end,
        body_indent: b.bodyIndent, insertion_indent: indent,
        detail: 'that body is indented to ' + b.bodyIndent + ', deeper than the insertion indent '
          + indent + ', so an insertion inside it terminates the body early and orphans the rest' },
      forbids: forbidden });
  }
  return out;
}

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
    out.push({ kind: 'control_flow_boundary',
      claim: 'the insertion must precede the terminator at line ' + i,
      witness: { rule: 'unreachable_after_terminator', terminator_line: i,
        terminator: lines[i].trim(), indent,
        detail: 'line ' + i + ' terminates this block at the insertion indent, so anything placed '
          + 'after it in the same block never executes' },
      forbids: forbidden });
    break;
  }
  return out;
}

// ---- symbol_availability, rewritten from OPERATION FACTS rather than provider guesses.
//
// Two directions, and the second is the one that did not exist before:
//
//   PROVIDED   a symbol this operation defines is consumed at import time on line u
//              -> legal at any boundary <= beforeLine(u)
//   REQUIRED   a symbol this operation consumes at import time is bound on line b
//              -> legal at any boundary >= afterLine(b)
//
// DEFERRED requirements are read and deliberately produce nothing. They are reported in the audit so
// a reader can see the rule considered them and declined, rather than never having looked.
function symbolAvailability(ctx) {
  const { src, code } = ctx;
  if (!code) return [];
  const facts = operationFacts(code);
  const out = [];

  for (const sym of facts.provides) {
    const u = immediateUseLine(src, sym);
    if (u < 0) continue;
    const limit = beforeLine(u);
    out.push({ kind: 'symbol_availability',
      claim: '`' + sym + '` must be defined at or before boundary B' + limit
        + ', because line ' + u + ' consumes it at import time',
      witness: { rule: 'provided_before_immediate_use', direction: 'provides',
        symbol: sym, use_line: u, boundary: limit,
        detail: 'line ' + u + ' executes when the module loads and reads `' + sym + '`; a definition '
          + 'placed after that boundary does not exist yet. B' + limit + ' itself is legal - it '
          + 'inserts immediately before the use.' },
      forbidsAfterBoundary: limit });
  }

  for (const sym of facts.requires_immediate) {
    // ENCLOSING SCOPE FIRST. A parameter or local of the unit this operation sits in resolves the
    // account and constrains nothing, so it must be checked before both the module search and the
    // unresolved declaration - otherwise a perfectly available name is reported as a gap.
    const scoped = scopeProviders(src, ctx.parentRange, sym);
    if (scoped) {
      out.push({ kind: 'scope_availability',
        claim: '`' + sym + '` is provided by the enclosing unit (' + scoped.provider + ') and '
          + 'imposes no ordering',
        witness: { rule: 'enclosing_scope_provider', direction: 'requires_immediate',
          symbol: sym, provider: 'enclosing_scope', binding_line: scoped.line,
          scope_provider: scoped.provider, why: scoped.why, detail: scoped.detail },
        forbids: [], gain_bits: 0, scope: 'scope_resolution' });
      continue;
    }
    const b = bindingLine(src, sym);
    if (b < 0) {
      // UNRESOLVED. Still manufacture no constraint - but say so, with a witness, instead of
      // returning the same silence as "this operation has no requirement here".
      out.push({ kind: 'unresolved_requirement',
        claim: '`' + sym + '` is required at import time and NO supported provider form was found',
        witness: { rule: 'unresolved_immediate_requirement', symbol: sym,
          searched: 'module-level def, class, or assignment binding',
          detail: 'the requirement is real and may impose ordering, but this deriver has no '
            + 'representation for its provider - an import, a star-import, a builtin or an injected '
            + 'name. Deriving nothing here is NOT the same answer as "there is no dependency".' },
        forbids: [], gain_bits: 0, scope: 'unresolved' });
      continue;
    }
    // EPISTEMIC SOURCE. A provider already present in the original program is a CURRENT PROGRAM FACT;
    // one that exists only because another planned operation creates it is a TRANSACTION FACT. The v4
    // sweep found exactly this collapse in `edgesFor`, so the two are labelled rather than merged.
    const providerKind = ctx.origin && bindingLine(ctx.origin, sym) >= 0
      ? 'existing_definition' : 'planned_operation';
    const limit = afterLine(b);
    out.push({ kind: 'symbol_availability',
      claim: 'this operation must sit at or after boundary B' + limit
        + ', because it loads `' + sym + '` at import time and `' + sym + '` is bound on line ' + b,
      witness: { rule: 'immediate_requirement_after_binding', direction: 'requires_immediate',
        symbol: sym, binding_line: b, boundary: limit, provider: providerKind,
        detail: 'this operation executes when the module loads and reads `' + sym + '`, which does '
          + 'not exist until line ' + b + '. An operation can impose ordering through what it '
          + 'CONSUMES even when it provides nothing.' },
      forbidsBeforeBoundary: limit });
  }

  if (facts.requires_deferred.length) {
    out.push({ kind: 'deferred_requirement',
      claim: 'deferred references ' + facts.requires_deferred.map((s) => '`' + s + '`').join(', ')
        + ' impose NO ordering',
      witness: { rule: 'deferred_phase', symbols: facts.requires_deferred,
        detail: 'these names are read inside function bodies, so Python resolves them when those '
          + 'functions RUN, not when the module loads. A textual mention is not a dependency.' },
      forbids: [], gain_bits: 0, scope: 'phase_analysis' });
  }
  return out;
}

function canonicalRealization(ctx) {
  const { src, indent, siblingKind } = ctx;
  if (!siblingKind) return [];
  const lines = src.split(NL);
  const near = [];
  for (let i = 0; i < lines.length; i++) {
    if (ind(lines[i]) === indent && new RegExp('^\\s*' + siblingKind + '\\b').test(lines[i])) near.push(i);
  }
  if (!near.length) return [];
  return [{ kind: 'canonical_realization',
    claim: 'convention would place the new `' + siblingKind + '` beside the existing ones at lines '
      + near.join(', '),
    witness: { rule: 'sibling_proximity', sibling_lines: near,
      detail: 'moving the insertion away from these violates no semantic requirement, so this is a '
        + 'preference about the resulting patch and not a fact about legality' },
    forbids: [], gain_bits: 0, scope: 'engineering_choice' }];
}

// The continuation rule needs the candidate set, which the other derivers do not, so it is applied
// inside `constrain` rather than added to this list.
const DERIVERS = [ownershipBoundary, controlFlowBoundary, symbolAvailability, canonicalRealization];

export function constrain(ctx, candidates) {
  const cont = continuationConstraint(ctx.src, candidates);
  const raw = [...(cont ? [cont] : []), ...DERIVERS.flatMap((d) => d(ctx))];
  let region = [...candidates];
  const chain = [];
  let n = 0;
  for (const c of raw) {
    const before = region.length;
    let after;
    if (c.forbidsAfterBoundary !== undefined) {
      after = region.filter((p) => positionToBoundary(p) <= c.forbidsAfterBoundary);
    } else if (c.forbidsBeforeBoundary !== undefined) {
      after = region.filter((p) => positionToBoundary(p) >= c.forbidsBeforeBoundary);
    } else {
      const forbid = new Set(c.forbids || []);
      after = region.filter((p) => !forbid.has(p));
    }
    const removed = before - after.length;
    const gain = c.scope === 'engineering_choice' || c.scope === 'phase_analysis'
      || c.scope === 'unresolved' || c.scope === 'scope_resolution'
      || after.length === 0 || removed === 0 ? 0 : Math.log2(before / after.length);
    chain.push({ constraint_id: 'c' + (++n), operation_id: ctx.operation_id || null,
      kind: c.kind, claim: c.claim, witness: c.witness,
      before_region: before, after_region: after.length,
      effect: removed ? 'removed ' + removed + ' boundary(ies)' : 'removed none',
      gain_bits: gain, scope: c.scope || 'transaction_derived',
      removed_positions: region.filter((p) => !after.includes(p)) });
    if (after.length > 0) region = after;
  }
  const total = candidates.length && region.length
    ? Math.log2(candidates.length / region.length) : 0;

  // THE ACCOUNT, not just the answer. Every immediate requirement appears here exactly once.
  const resolved = chain.filter((c) => (c.kind === 'symbol_availability' || c.kind === 'scope_availability')
    && c.witness && c.witness.direction === 'requires_immediate')
    .map((c) => ({ symbol: c.witness.symbol, provider: c.witness.provider, line: c.witness.binding_line }));
  const unresolved = chain.filter((c) => c.kind === 'unresolved_requirement')
    .map((c) => ({ symbol: c.witness.symbol, reason: 'no supported provider representation' }));
  return { candidates: candidates.length, region, constrained: region.length,
    total_gain_bits: total, chain,
    requirement_resolution: { resolved, unresolved },
    constraint_status: { requirement_complete: unresolved.length === 0 } };
}

export function verify(ctx, chain) {
  const lines = ctx.src.split(NL);
  const imm = immediateLines(ctx.src);
  const out = [];
  for (const c of chain) {
    let ok = false;
    let why = 'unknown kind';
    const w = c.witness || {};
    if (c.kind === 'ownership_boundary') {
      const b = bodies(ctx.src).find((x) => x.header === w.header_line);
      ok = !!b && b.end === w.body_end && b.bodyIndent === w.body_indent && b.bodyIndent > ctx.indent;
      why = ok ? 'body extent re-derived and still deeper than the insertion indent' : 'body extent does not re-derive';
    } else if (c.kind === 'control_flow_boundary') {
      const l = lines[w.terminator_line] || '';
      ok = ind(l) === w.indent && /^\s*(?:return|continue|break|raise)\b/.test(l);
      why = ok ? 'terminator re-found at the recorded line and indent' : 'no terminator at that line';
    } else if (c.kind === 'symbol_availability' && w.direction === 'provides') {
      ok = immediateUseLine(ctx.src, w.symbol) === w.use_line && imm[w.use_line] === true;
      why = ok ? 'import-time use independently re-derived at the recorded line' : 'use line does not re-derive';
    } else if (c.kind === 'symbol_availability' && w.direction === 'requires_immediate') {
      const f = operationFacts(ctx.code || '');
      ok = f.requires_immediate.includes(w.symbol) && bindingLine(ctx.src, w.symbol) === w.binding_line;
      why = ok ? 'immediate requirement and provider both independently re-derived'
        : 'requirement or binding does not re-derive';
    } else if (c.kind === 'expression_continuation') {
      ok = (w.positions || []).every((p) => openAfterLine(ctx.src, p) > 0)
        && (w.positions || []).length === (c.removed_positions || []).length;
      why = ok ? 'every recorded position re-derives as sitting inside an unclosed bracket'
        : 'a recorded position does not re-derive as an open continuation';
    } else if (c.kind === 'scope_availability') {
      const f = operationFacts(ctx.code || '');
      const again = scopeProviders(ctx.src, ctx.parentRange, w.symbol);
      ok = f.requires_immediate.includes(w.symbol) && !!again
        && again.provider === w.scope_provider && (c.removed_positions || []).length === 0;
      why = ok ? 'the enclosing-scope provider re-derives and nothing was narrowed'
        : 'either the scope provider does not re-derive or it narrowed something';
    } else if (c.kind === 'unresolved_requirement') {
      const f = operationFacts(ctx.code || '');
      ok = f.requires_immediate.includes(w.symbol) && bindingLine(ctx.src, w.symbol) < 0
        && (c.removed_positions || []).length === 0;
      why = ok ? 'the requirement re-derives and still has no resolvable provider; nothing was narrowed'
        : 'either the requirement does not re-derive, a provider IS findable, or it narrowed something';
    } else if (c.kind === 'deferred_requirement') {
      const f = operationFacts(ctx.code || '');
      ok = (w.symbols || []).every((s) => f.requires_deferred.includes(s))
        && (c.removed_positions || []).length === 0;
      why = ok ? 'deferred phase re-derived and nothing was narrowed'
        : 'A DEFERRED REFERENCE NARROWED SOMETHING - the forbidden promotion of a mention to a dependency';
    } else if (c.kind === 'canonical_realization') {
      ok = c.gain_bits === 0 && (!c.removed_positions || c.removed_positions.length === 0);
      why = ok ? 'style recorded with zero gain and no narrowing, as required'
        : 'STYLE NARROWED SOMETHING - the forbidden promotion of taste to necessity';
    }
    out.push({ constraint_id: c.constraint_id, kind: c.kind, replayed: ok, why });
  }
  return { all_replayed: out.every((r) => r.replayed), results: out };
}
