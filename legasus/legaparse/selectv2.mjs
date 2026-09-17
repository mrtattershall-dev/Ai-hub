// LegaParse SITE SELECTION v2 — task-grounded concern resolution, emitting a SUBGRAPH.
//
// TWO DESIGN CONSTRAINTS, both load-bearing.
//
// 1. NO "BEST CONCERN" FALLBACK. v2 resolves the relation the TASK names onto the concern graph. If it
//    cannot be resolved uniquely and structurally, selection fails. Ranking concerns by size is
//    task-free and let a loop index (`state:i`) nominate sites and score 4/4 by coincidence. Removing
//    the fallback kills that at the correct level: `i` has no evidentiary relationship to the request,
//    so it never earns authority to nominate anything. This is the architectural equivalent of deleting
//    an unsafe default branch.
//
// 2. DO NOT COLLAPSE STRUCTURE INTO AN UNORDERED LIST. `sites = [A,B,C,D]` discards exactly what
//    LegaCore needs next. A site set can be 100% correct and the transaction still fail because the
//    sequence is wrong - this project has already seen an insertion placed after a `continue` be
//    technically correct and dead. So v2 returns participants WITH roles, witnesses, and dependency
//    edges, and ordering is derived from those edges rather than from source order.
//
// Source order sometimes coincides with edit order; it is not the rule. A helper may have to exist
// before its caller, state before its mutation. The order comes from dependency constraints.
import { allConcerns } from './concernkinds.mjs';

const REL = [
  /\bthe same way as\b([^.]*)/i,
  /\bwritten like\b([^.]*)/i,
  /\b(?:just )?like\b\s+(?:the\s+)?([^.]*)/i,
  /\banalogous to\b([^.]*)/i,
];

export function extractRelation(task) {
  if (task.analogy && String(task.analogy).trim()) {
    return { named: true, text: String(task.analogy), from: 'analogy field' };
  }
  const g = String(task.goal || '');
  for (const re of REL) {
    const m = g.match(re);
    if (m) return { named: true, text: m[0], from: 'relation phrase in the goal' };
  }
  return { named: false, text: null, from: null };
}

// Resolve the named relation onto a concern. A concern matches when its symbol, or a unit that
// participates in it, is named by the relation text. Unique match required.
function resolve(concerns, relText, goal) {
  const hay = (relText + ' ' + goal).toLowerCase();
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
  if (best.length > 1) return { status: 'AMBIGUOUS', candidates: best };
  return { status: 'RESOLVED', concern: best[0].concern, witness: best[0].hits };
}

// Dependency edges derived from WITNESSED ROLES, not from source position.
//   every non-OWNER participant depends on the OWNER   - state must exist before it is written or read
//   DISPATCH depends on HANDLER                        - the branch calls the handler
export function edgesFor(participants) {
  const edges = [];
  const owners = participants.filter((p) => p.role === 'OWNER');
  const handlers = participants.filter((p) => p.role === 'HANDLER');
  for (const p of participants) {
    for (const o of owners) {
      if (o !== p) edges.push({ from: id(o), to: id(p), why: 'state must be declared before it is ' + (p.role === 'MUTATOR' ? 'written' : 'read') });
    }
    if (p.role === 'DISPATCH') {
      for (const h of handlers) edges.push({ from: id(h), to: id(p), why: 'the dispatch branch calls the handler' });
    }
  }
  return edges;
}
const id = (p) => p.unit + '@' + p.lastLine;

// Every legal order is a topological order of the derived graph. There may be several; the reference
// patch's authoring sequence is only one of them, and treating it as THE order would smuggle in a new
// oracle.
export function legalOrders(participants, edges, limit = 8) {
  const ids = participants.map(id);
  const incoming = new Map(ids.map((i) => [i, 0]));
  for (const e of edges) if (incoming.has(e.to)) incoming.set(e.to, incoming.get(e.to) + 1);
  const out = [];
  const walk = (avail, done, deg) => {
    if (out.length >= limit) return;
    if (!avail.length) { out.push([...done]); return; }
    for (const n of avail) {
      const d = new Map(deg);
      const nextAvail = avail.filter((x) => x !== n);
      for (const e of edges) if (e.from === n && d.has(e.to)) {
        d.set(e.to, d.get(e.to) - 1);
        if (d.get(e.to) === 0) nextAvail.push(e.to);
      }
      walk(nextAvail.filter((x) => d.get(x) === 0 || !edges.some((e) => e.to === x)), [...done, n], d);
    }
  };
  walk(ids.filter((i) => incoming.get(i) === 0), [], incoming);
  return out;
}

export function isLegalOrder(order, edges) {
  const pos = new Map(order.map((n, i) => [n, i]));
  return edges.every((e) => !pos.has(e.from) || !pos.has(e.to) || pos.get(e.from) < pos.get(e.to));
}

// ---- the pipeline, with explicit abstention reasons
export function selectSites(task, src) {
  const concerns = allConcerns(src);
  const rel = extractRelation(task);
  const base = {
    graph_visible: concerns.length > 0,
    concerns_found: concerns.map((c) => c.kind + ':' + c.symbol),
    named_relation: rel.text, relation_source: rel.from,
    resolved_concern: null, resolution_witness: null,
    participants: [], edges: [], sites: [],
  };
  if (!rel.named) return { ...base, decision: 'ABSTAIN_NO_RELATION' };
  const r = resolve(concerns, rel.text, String(task.goal || ''));
  if (r.status === 'UNRESOLVED') return { ...base, decision: 'ABSTAIN_UNRESOLVED' };
  if (r.status === 'AMBIGUOUS') {
    return { ...base, decision: 'ABSTAIN_AMBIGUOUS',
      resolution_witness: r.candidates.map((c) => c.concern.symbol) };
  }
  const ps = r.concern.participants;
  const edges = edgesFor(ps);
  return { ...base,
    decision: 'APPLY',
    resolved_concern: r.concern.kind + ':' + r.concern.symbol,
    resolution_witness: r.witness,
    participants: ps.map((p) => ({ id: id(p), unit: p.unit, role: p.role,
      witness: p.witness.rule, line: p.witness.line, lines: p.lines })),
    edges,
    sites: [...new Set(ps.flatMap((p) => p.witnesses.map((w) => w.line)))].sort((a, b) => a - b),
  };
}
