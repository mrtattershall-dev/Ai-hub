// LegaParse: CONCERN KINDS with deterministic ROLE WITNESSES.
//
// Two requirements drive this file, and both are stricter than raw recall.
//
// 1. EXTEND THE REPRESENTATION, NOT THE ANSWER SET. a03 and b02/b03 exposed concern kinds the graph
//    could not see - a variant/dispatch concern, and function-local state. They are modelled here as
//    KINDS. Nothing knows that a03 is about columns or b03 about comments; any rule that effectively
//    means "when you see quoted/date/comments, look here" would be an anchor hidden inside a graph.
//
// 2. EVERY ROLE CARRIES A WITNESS. A role is not a label, it is a claim, and the claim must be traceable
//    to a syntactic or data-flow fact:
//
//        symbol _weights
//          declared in Tally.__init__   -> OWNER      witness: binding assignment at line N
//          written  in Tally.add        -> MUTATOR    witness: indexed assignment at line N
//          read     in Tally.total      -> CONSUMER   witness: reference with no write at line N
//
//    Site selection then becomes a projection from a fact graph rather than a bag of likely locations.
//    A role without a witness is not admissible.
import { units } from './concerns.mjs';

// The syntactic extent of the construct a witness sits on: a def or a branch runs to the last line more
// indented than its header. A plain statement's extent is itself. A new sibling belongs AFTER the extent.
export function extentEnd(lines, i) {
  const ind = (l) => (l.match(/^[ \t]*/) || [''])[0].length;
  if (!/^\s*(?:def|class|if|elif|else|for|while|try|except|with)\b/.test(lines[i] || '')) return i;
  const base = ind(lines[i]);
  let end = i;
  for (let j = i + 1; j < lines.length; j++) {
    if (!lines[j].trim()) continue;
    if (ind(lines[j]) <= base) break;
    end = j;
  }
  return end;
}

const NL = String.fromCharCode(10);
const ESC = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A WITNESS CARRIES TWO DIFFERENT KINDS OF CLAIM and they used to share one object under one name.
//
//   line          CURRENT PROGRAM FACT   the program really does write/read the symbol here
//   realization   ENGINEERING CHOICE     given that fact, a new sibling would go after the extent
//
// Storing the second as a bare `site` field made a decision look like an observation. It is not
// wrong - "after the construct ends" is a sound convention - but a downstream reader could not tell
// that it was choosing something rather than reporting something, and the two have different
// authority: the fact is checkable, the convention is merely defensible. On the six substrate
// sources the two values differ at 4 of 41 witnesses, so the convention is doing real work.
function realized(lines, i, end) {
  return { line: end === undefined ? extentEnd(lines, i) : end,
    fact_kind: 'ENGINEERING_CHOICE',
    rule: 'a new sibling belongs after the witnessed construct ends' };
}

// ---- deterministic role rules. Each returns a witness or null; the FIRST match decides the role, so
// the ordering is itself part of the specification.
const ROLE_RULES = [
  { role: 'OWNER', rule: 'binding assignment to the symbol',
    test: (line, b) => new RegExp('^\\s*(?:self\\.)?' + b + '\\s*=(?!=)').test(line) },
  { role: 'MUTATOR', rule: 'indexed assignment into the symbol',
    test: (line, b) => new RegExp('(?:self\\.)?' + b + '\\s*\\[[^\\]]*\\]\\s*=(?!=)').test(line) },
  { role: 'MUTATOR', rule: 'mutating method call on the symbol',
    test: (line, b) => new RegExp('(?:self\\.)?' + b + '\\s*\\.\\s*(?:append|extend|add|update|pop|remove|clear|insert)\\s*\\(').test(line) },
  { role: 'CONSUMER', rule: 'reference to the symbol with no write on the line',
    test: (line, b) => new RegExp('(?:self\\.)?\\b' + b + '\\b').test(line) },
];

function classify(line, bare) {
  for (const r of ROLE_RULES) {
    if (r.test(line, bare)) return { role: r.role, rule: r.rule };
  }
  return null;
}

// ---- KIND 1 and 2: state concerns (attribute, module constant, function-local), unified.
// v1 saw only function-local inside ONE function; concerns.mjs saw attributes and module constants. The
// unification is the point: a concern is state plus participants, wherever the state is declared.
export function stateConcerns(src) {
  const lines = src.split(NL);
  const us = units(src);
  const syms = new Map();
  const note = (name, scope) => { if (!syms.has(name)) syms.set(name, scope); };
  for (const m of src.matchAll(/\bself\.(_?[A-Za-z]\w*)\s*(?:=|\[)/g)) note(m[1], 'attribute');
  for (const m of src.matchAll(/^([A-Z_][A-Z0-9_]*)\s*=/gm)) note(m[1], 'module');
  // FUNCTION-LOCAL state: a name bound to a container or None inside any unit. b02's `pending`, b03's
  // `depth`, and the accumulators v1 could only see one function at a time.
  for (const m of src.matchAll(/^\s+([a-z_]\w*)\s*=\s*(?:\[\]|\{\}|None|0|""|''|set\(\))\s*$/gm)) note(m[1], 'local');

  const out = [];
  for (const [bare, scope] of syms) {
    // A local name is confined to the unit that declares it. Without this, a loop index in one function
    // matches a parameter of the same name in another and fabricates a concern out of a coincidence.
    const owner = scope === 'local'
      ? us.find((u) => u.kind !== 'module' && u.kind !== 'class'
          && Array.from({ length: u.end - u.start + 1 }, (_, k) => u.start + k)
            .some((i) => new RegExp('^\\s+' + ESC(bare) + '\\s*=').test(lines[i])))
      : null;
    const b = ESC(bare);
    const participants = [];
    for (const u of (owner ? [owner] : us)) {
      const idxs = u.kind === 'module' ? (u.moduleLines || [])
        : Array.from({ length: u.end - u.start + 1 }, (_, k) => u.start + k);
      const witnesses = [];
      for (const i of idxs) {
        if (!new RegExp('(?:self\\.)?\\b' + b + '\\b').test(lines[i])) continue;
        const c = classify(lines[i], b);
        if (c) witnesses.push({ line: i, role: c.role, rule: c.rule, fact_kind: 'CURRENT_PROGRAM_FACT', realization: realized(lines, i), text: lines[i].trim().slice(0, 72) });
      }
      if (!witnesses.length) continue;
      // The unit's role is the strongest role any of its witnesses supports. THIS IS A SUMMARIZATION
      // CONVENTION, not a program fact: a unit that both binds and reads the symbol is reported as
      // OWNER and its CONSUMER witness disappears from `role`. The full list stays in `witnesses`, so
      // nothing is destroyed, but `role` alone must not be read as the unit's complete relationship.
      // Status on real data: UNDETERMINED. 35 of 36 participants across the six substrate sources hold
      // exactly one witness, so a collapse could only have been exposed once and was not. Zero
      // observed collapses is therefore not evidence of correctness - the test barely had the chance
      // to fire, and a source with a genuine read-and-write unit is needed to settle it.
      const rank = { OWNER: 3, MUTATOR: 2, CONSUMER: 1 };
      const best = witnesses.reduce((a, w) => (rank[w.role] > rank[a.role] ? w : a), witnesses[0]);
      participants.push({ unit: u.qual, kind: u.kind, role: best.role, witness: best,
        witnesses, lines: witnesses.map((w) => w.line),
        lastLine: witnesses[witnesses.length - 1].line, unitStart: u.start, unitEnd: u.end });
    }
    const nested = participants.filter((p) => p.kind !== 'class' && p.kind !== 'module');
    const kept = participants.filter((p) => p.kind !== 'class'
      || !p.lines.every((i) => nested.some((n) => i >= n.unitStart && i <= n.unitEnd)));
    if (scope === 'local' && kept.length === 1 && kept[0].witnesses.length >= 2) {
      // Per-witness participation: the declaration, each write and each read are separate positions.
      const ps = kept[0].witnesses.map((w) => ({ unit: kept[0].unit, kind: kept[0].kind, role: w.role,
        witness: w, witnesses: [w], lines: [w.line], lastLine: w.line,
        unitStart: kept[0].unitStart, unitEnd: kept[0].unitEnd }));
      out.push({ kind: 'state', scope, symbol: bare, participants: ps });
    } else if (kept.length >= 2) out.push({ kind: 'state', scope, symbol: bare, participants: kept });
  }
  return out;
}

// ---- KIND 3: VARIANT / DISPATCH concerns.
// A variant is a literal that a program treats as a case: it appears in a collection, in an equality
// test, and often in the name of the unit that handles it. a03's "quoted" is one; so is any enum-ish
// string in any program. The rules are about SHAPE, not about which literal it is.
export function variantConcerns(src) {
  const lines = src.split(NL);
  const us = units(src);
  const counts = new Map();
  for (const m of src.matchAll(/["']([a-z][a-z0-9_]{2,})["']/gi)) {
    counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  }
  const out = [];
  for (const [lit, n] of counts) {
    if (n < 2) continue;
    const L = ESC(lit);
    const inCollection = new RegExp('[\\[{][^\\]}]*["\']' + L + '["\']');
    const inTest = new RegExp('(?:==|!=|\\bin\\b)\\s*["\']' + L + '["\']|["\']' + L + '["\']\\s*(?:==|!=)');
    const participants = [];
    for (const u of us) {
      const idxs = u.kind === 'module' ? (u.moduleLines || [])
        : Array.from({ length: u.end - u.start + 1 }, (_, k) => u.start + k);
      const witnesses = [];
      for (const i of idxs) {
        const line = lines[i];
        if (inCollection.test(line)) witnesses.push({ line: i, role: 'REGISTRY', rule: 'literal listed in a collection', fact_kind: 'CURRENT_PROGRAM_FACT', realization: realized(lines, i), text: line.trim().slice(0, 72) });
        else if (inTest.test(line)) witnesses.push({ line: i, role: 'DISPATCH', rule: 'literal compared in a branch test', fact_kind: 'CURRENT_PROGRAM_FACT', realization: realized(lines, i), text: line.trim().slice(0, 72) });
      }
      // A unit whose NAME carries the variant handles it, regardless of where the literal appears.
      if (u.kind === 'def' && new RegExp('_?' + L + '\\b', 'i').test(u.name)) {
        witnesses.push({ line: u.start, role: 'HANDLER', rule: 'unit name carries the variant', fact_kind: 'CURRENT_PROGRAM_FACT', realization: realized(lines, u.start, u.end), text: lines[u.start].trim().slice(0, 72) });
      }
      if (!witnesses.length) continue;
      // MULTIPLICITY IS PRESERVED. Each independently witnessed occurrence is its own participant;
      // one unit may participate at several sites in the same role. Compressing to one-per-unit is what
      // lost a03's second registry entry, and the compression is not recoverable downstream.
      for (const w of witnesses) {
        participants.push({ unit: u.qual, kind: u.kind, role: w.role, witness: w, witnesses: [w],
          lines: [w.line], lastLine: w.line, unitStart: u.start, unitEnd: u.end });
      }
    }
    const roles = new Set(participants.map((p) => p.role));
    // A real variant participates in at least two DIFFERENT roles - otherwise it is just a repeated
    // string. This is what keeps ordinary words out of the graph.
    if (participants.length >= 2 && roles.size >= 2) {
      out.push({ kind: 'variant', scope: 'variant', symbol: lit, participants });
    }
  }
  return out;
}

export function allConcerns(src) {
  return [...stateConcerns(src), ...variantConcerns(src)]
    .sort((a, b) => b.participants.length - a.participants.length);
}
