// LegaParse v5 — PROVENANCE-PRESERVING RESOLUTION + OPERATION REQUIREMENTS.
//
// Exactly two stages over v2, and nothing else:
//
//   STAGE 1  concern resolution reads the RELATION clause only. Delta, preservation and incidental
//            text have no nominating authority, so the merged haystack disappears.
//   STAGE 2  given the resolved concern, the DELTA clause decides which participants require
//            modification. Every inclusion carries reason_required; every exclusion carries
//            reason_not_required.
//
// WHY EXCLUSIONS NEED EVIDENCE: without it a selector can become arbitrarily "precise" by dropping
// participants until the candidate set is small. An omission is a claim about the delta and is held to
// the same standard as a role or an edge.
//
// v2 IS NOT EDITED. It stays frozen with its recorded numbers; this is a separate component.
import { allConcerns } from './concernkinds.mjs';
import { edgesFor, legalOrders } from './selectv2.mjs';
import { segment, textOf, provenanceReport } from './clauses.mjs';
import { units } from './concerns.mjs';

const NL = String.fromCharCode(10);
const ESC = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const id = (p) => p.unit + '@' + p.lastLine;

// ---------------------------------------------------------------------------------------------------
// STAGE 1 — resolution on RELATION evidence alone.
function resolveFromRelation(concerns, relationText) {
  const hay = relationText;
  const scored = [];
  for (const c of concerns) {
    const keys = [c.symbol, ...c.participants.map((p) => p.unit.split('.').pop())]
      .filter(Boolean).map((s) => String(s).replace(/^_+/, '').toLowerCase())
      .filter((s) => s.length >= 3);
    const hits = [...new Set(keys.filter((k) => hay.includes(k)))];
    if (hits.length) scored.push({ concern: c, hits });
  }
  if (!scored.length) return { status: 'UNRESOLVED', candidates: [] };
  const top = Math.max(...scored.map((s) => s.hits.length));
  const best = scored.filter((s) => s.hits.length === top);
  // A tie the RELATION cannot break is a real tie. f01 names both existing channels in the relation
  // clause itself, and the honest answer there is abstention rather than a coin toss dressed as a rule.
  if (best.length > 1) return { status: 'AMBIGUOUS', candidates: best };
  return { status: 'RESOLVED', concern: best[0].concern, hits: best[0].hits };
}

// ---------------------------------------------------------------------------------------------------
// STAGE 2 — which participants does THIS delta require?
//
// Each participant already carries a witness naming the concrete syntactic operation it performs. The
// delta names the behaviours that must exist. A participant is required when the delta asks for an
// operation of the kind that participant performs, or names an existing observable that depends on it.
//
// The lexicons below are about PREDICATES - what an operation does - never about subject matter. They
// are still lexicons, and their coverage is a real limit that is reported rather than hidden.

// What operation does this witness perform? Read from the witnessed line, not from the unit's name.
function witnessKind(text, role) {
  const t = String(text || '');
  if (role === 'OWNER') return 'DECLARE';
  if (/\.\s*(?:remove|pop|clear|discard|popitem)\s*\(/.test(t)) return 'REMOVE';
  if (/\.\s*(?:append|extend|add|insert|update)\s*\(/.test(t)) return 'WRITE';
  if (/\[[^\]]*\]\s*=(?!=)/.test(t)) return 'WRITE';
  if (/\bjoin\s*\(|\bformat\s*\(|%\s*\(/.test(t)) return 'RENDER';
  if (/\blen\s*\(/.test(t)) return 'COUNT';
  if (/\bsum\s*\(/.test(t)) return 'SUM';
  if (/\b(?:max|min|sorted)\s*\(/.test(t)) return 'EXTREME';
  if (/\.\s*get\s*\(/.test(t)) return 'LOOKUP';
  if (/\bin\b/.test(t)) return 'MEMBERSHIP';
  return 'READ';
}

// Which operation kinds does the delta ask for? English predicates only.
const DELTA_KINDS = [
  ['WRITE', /\b(?:append|appends|add|adds|record|records|put|puts|store|stores|register|registers|mark|marks|track|tracks)\b/i],
  ['REMOVE', /\b(?:remove|removes|delete|deletes|drop|drops|forget|forgets|clear|clears|undo|undoes|restore|restores)\b/i],
  ['COUNT', /\bhow many\b|\bcount\b|\bnumber of\b/i],
  ['SUM', /\bsum\b|\btotal\b/i],
  ['EXTREME', /\b(?:most|highest|largest|lowest|smallest|busiest|greatest|maximum|minimum)\b/i],
  ['RENDER', /\breport\b|\bjoin(?:s|ed)?\b|\brender(?:s|ed)?\b|\bformat(?:s|ted)?\b|\bas a string\b/i],
  ['LOOKUP', /\bfor (?:that|a given|each)\b|\brecorded for\b|\b0 when\b|\bnone when\b|\bor None when\b/i],
  ['MEMBERSHIP', /\bwhether\b|\bis present\b|\bcontains\b|\bis on\b|\bis in\b/i],
];
function deltaKinds(deltaText) {
  const out = new Set();
  for (const [kind, re] of DELTA_KINDS) if (re.test(deltaText)) out.add(kind);
  return out;
}

// For a REGISTRY participant: which existing units READ the collection the literal sits in? If the
// delta names none of them, nothing the delta asks for depends on that registry.
function registryReaders(src, witnessText) {
  const m = String(witnessText || '').match(/^([A-Za-z_]\w*)\s*=/);
  if (!m) return { name: null, readers: [] };
  const name = m[1];
  const lines = src.split(NL);
  const readers = [];
  for (const u of units(src)) {
    if (u.kind === 'module' || u.kind === 'class') continue;
    for (let i = u.start; i <= u.end && i < lines.length; i++) {
      if (new RegExp('\\b' + ESC(name) + '\\b').test(lines[i])
        && !new RegExp('^\\s*' + ESC(name) + '\\s*=').test(lines[i])) {
        readers.push(u.name); break;
      }
    }
  }
  return { name, readers: [...new Set(readers)] };
}

const namesUnit = (text, unitName) => new RegExp('\\b' + ESC(String(unitName).replace(/^_+/, '')) + '\\b')
  .test(text);

function requirements(src, concern, deltaText) {
  const kinds = deltaKinds(deltaText);
  const ps = concern.participants;
  const decided = [];

  // DISPATCH first: a handler is required only because the branch that routes to it is.
  const dispatchRequired = ps.some((p) => p.role === 'DISPATCH'
    && namesUnit(deltaText, String(p.unit).split('.').pop()));

  for (const p of ps) {
    const short = String(p.unit).split('.').pop();
    const wk = witnessKind(p.witness && p.witness.text, p.role);
    let required = false;
    let reason = null;

    if (p.role === 'OWNER') {
      required = null;                       // decided last: state is declared only if something uses it
      reason = 'pending';
    } else if (p.role === 'REGISTRY') {
      const r = registryReaders(src, p.witness && p.witness.text);
      const named = r.readers.filter((u) => namesUnit(deltaText, u));
      required = named.length > 0;
      reason = required
        ? 'the requested behaviour names `' + named.join('`, `') + '`, which reads `' + r.name + '`'
        : (r.readers.length
          ? 'no operation named in the requested behaviour reads `' + r.name + '` (read only by `'
            + r.readers.join('`, `') + '`)'
          : 'nothing reads `' + r.name + '`');
    } else if (p.role === 'DISPATCH') {
      required = namesUnit(deltaText, short);
      reason = required ? 'the requested behaviour names the dispatcher `' + short + '`'
        : 'the requested behaviour does not name the dispatcher `' + short + '`';
    } else if (p.role === 'HANDLER') {
      required = dispatchRequired;
      reason = required ? 'the dispatch branch that routes to it is required'
        : 'no required dispatch branch routes to it';
    } else {
      required = kinds.has(wk);
      reason = required
        ? 'the requested behaviour asks for a ' + wk + ' operation, witnessed here by `'
          + String(p.witness.text).slice(0, 48) + '`'
        : 'the requested behaviour asks for no ' + wk + ' operation (requested: '
          + ([...kinds].join(', ') || 'none recognised') + ')';
    }
    decided.push({ p, short, role: p.role, witness_kind: wk, required, reason });
  }

  // The OWNER is required exactly when something that uses the state is.
  const anyUse = decided.some((d) => d.role !== 'OWNER' && d.required === true);
  for (const d of decided) {
    if (d.role !== 'OWNER') continue;
    d.required = anyUse;
    d.reason = anyUse ? 'new state must be declared before any required operation can use it'
      : 'no operation on this concern is required, so no new state is needed';
  }
  return decided;
}

// ---------------------------------------------------------------------------------------------------
export function selectSites(task, src) {
  const clauses = segment(task);
  const concerns = allConcerns(src);
  const relation = textOf(clauses, 'RELATION');
  const delta = textOf(clauses, 'DELTA');

  const base = {
    graph_visible: concerns.length > 0,
    concerns_found: concerns.map((c) => c.kind + ':' + c.symbol),
    provenance: provenanceReport(clauses),
    named_relation: relation || null,
    relation_source: clauses.find((c) => c.kind === 'RELATION')
      ? clauses.find((c) => c.kind === 'RELATION').from : null,
    resolved_concern: null, resolution_witness: null,
    participants: [], excluded: [], edges: [], sites: [],
  };
  if (!relation) return { ...base, decision: 'ABSTAIN_NO_RELATION' };

  const r = resolveFromRelation(concerns, relation);
  if (r.status === 'UNRESOLVED') {
    return { ...base, decision: 'ABSTAIN_UNRESOLVED',
      resolution_witness: 'no concern is named by the relation clause; a relation that names nothing '
        + 'in the program is not a relation the program supports' };
  }
  if (r.status === 'AMBIGUOUS') {
    return { ...base, decision: 'ABSTAIN_AMBIGUOUS',
      resolution_witness: r.candidates.map((c) => c.concern.kind + ':' + c.concern.symbol) };
  }

  const decided = requirements(src, r.concern, delta);
  const req = decided.filter((d) => d.required);
  const exc = decided.filter((d) => !d.required);

  // Every required participant must still be a legal, witnessed position; nothing here invents one.
  if (!req.length) {
    return { ...base, decision: 'ABSTAIN_NO_REQUIRED_ROLE',
      resolved_concern: r.concern.kind + ':' + r.concern.symbol,
      resolution_witness: r.hits,
      excluded: exc.map((d) => ({ id: id(d.p), unit: d.p.unit, role: d.role,
        reason_not_required: d.reason })) };
  }

  const reqPs = req.map((d) => d.p);
  const edges = edgesFor(reqPs, src, r.concern);
  const sites = [...new Set(req.flatMap((d) => d.p.witnesses
    .map((w) => (w.realization ? w.realization.line : w.line))))].sort((a, b) => a - b);

  return { ...base,
    decision: 'APPLY',
    resolved_concern: r.concern.kind + ':' + r.concern.symbol,
    resolution_witness: r.hits,
    resolved_from: { clause: 'RELATION', evidence: relation },
    required_roles: req.map((d) => d.role),
    participants: req.map((d) => ({ id: id(d.p), unit: d.p.unit, role: d.role,
      witness: d.p.witness.rule, witness_kind: d.witness_kind, line: d.p.witness.line,
      lines: d.p.lines, reason_required: d.reason })),
    excluded: exc.map((d) => ({ id: id(d.p), unit: d.p.unit, role: d.role,
      witness_kind: d.witness_kind, reason_not_required: d.reason })),
    edges,
    legal_orders: legalOrders(reqPs, edges, 4),
    site_basis: 'ENGINEERING_CHOICE: a new sibling belongs after the witnessed construct ends',
    sites,
  };
}
