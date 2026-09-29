'use strict';
// =============================================================================
// PERSISTENCE (spine decision #3) — save & reload the engine SAFELY.
// =============================================================================
// RD-007 already split the two serializations: AI-facing context is legible
// columnar text of a retrieved slice; ON-DISK is byte-optimal and the model
// never reads it. This closes the on-disk half: what exactly do we write so a
// reload reproduces the world without breaking the invariants everything else
// depends on?
//
// The decision (measured in persistence_test.js): persist ONLY authoritative
// state + the identity high-water mark; REBUILD everything derived on load.
//   * store: live entities (uuid,type,parent,name,refs,component fields),
//            tombstones (RD-004.6), the uuidSeq counter, the tick.
//   * do NOT store: derived indexes (RD-001) — a stored index can go stale or
//            be tampered and load as a silent lie (the RD-017 failure at the
//            storage layer). Rebuilding on load is stale-proof by construction.
//   * NEVER reset the uuid counter to a count — a reload that does so recycles
//            a tombstoned UUID (RD-004/004.6 freelist bug via save/load). The
//            high-water mark is persisted and restored so ids are never reused.
//
// Format is JSON here (zero-dep, inspectable). RD-007 permits a binary on-disk
// form later; the CONTRACT is "authoritative-only + rebuild", independent of
// whether the bytes are JSON or packed. Zero deps.
// =============================================================================

const { Engine, World, TYPE, TYPE_NAME, NO_ROW } = require('./engine.js');
const { installRule } = require('./behavior.js');

const SCHEMA_VERSION = 1;

// ---- SAVE: authoritative state only. Derived indexes are deliberately absent.
function save(engine) {
  const w = engine.w;
  const entities = [];
  for (let e = 0; e < w.count; e++) {
    if (w.destroyed[e]) continue;                    // dead entities live on as tombstones
    const r = w.componentIndex[e];
    const ent = {
      uuid: w.uuid[e],
      type: w.type[e],
      parent: w.parent[e] >= 0 ? w.uuid[w.parent[e]] : null,   // by UUID, not index (RD-004)
      name: w.name[e],
      refs: w.refs[e].slice(),
      orderKey: w.orderKey[e],   // RD-005.3 sibling position (authoritative, not derived)
    };
    for (const [f, spec] of Object.entries(w.schema.defs[w.type[e]].fields)) {   // RD-024: schema-driven
      if (spec.pool === false) continue;                                          // (key order = decl order,
      ent[f] = w.pools[w.type[e]][f][r];                                          //  byte-identical to pre-registry)
    }
    entities.push(ent);
  }
  // RD-B6.1 (fuzz P6): a destroyed row's PARENT pointer is decision-bearing —
  // cycle validation walks chains THROUGH dead rows (conservative-correct:
  // an undo can resurrect the dead link, RD-020). Persist it for exactly the
  // tombstones reachable as dangling ancestors from a live entity; verdicts
  // can only ever enter dead territory through a live entity's dangling
  // parent, so the reachable set is identical on both fork branches (an
  // unreachable dead row's pointer can never influence anything and is
  // deliberately NOT saved, keeping re-saves byte-deterministic).
  const deadReach = new Map();   // tombstone uuid -> its row's parent uuid | null
  for (let e = 0; e < w.count; e++) {
    if (w.destroyed[e]) continue;
    let cur = w.parent[e], hops = 0;
    while (cur >= 0 && w.destroyed[cur] && hops++ <= w.count) {
      if (deadReach.has(w.uuid[cur])) break;
      deadReach.set(w.uuid[cur], w.parent[cur] >= 0 ? w.uuid[w.parent[cur]] : null);
      cur = w.parent[cur];
    }
  }
  const tombstones = [...w.tombstones.entries()].map(([uuid, t]) =>
    ({ uuid, type: t.type, lastName: t.lastName, ...(deadReach.has(uuid) ? { parent: deadReach.get(uuid) } : {}) }));
  return {
    v: SCHEMA_VERSION,
    uuidSeq: w._uuidSeq,   // the identity high-water mark — the load-time linchpin
    // RD-B6.1 (review finding #3): capacity is AUTHORITATIVE, not a tuning hint.
    // The RD-B2 count-expr range proof validates against [0, capacity] and the
    // world-full boundary is capacity — an unpersisted capacity made rule
    // revalidation verdicts and spawn headroom depend on what the LOADER passed.
    capacity: w.capacity,
    tick: engine.tick,
    entities,
    tombstones,
    // RD-B6: installed rules persist as their SOURCE JSON (authored content,
    // world data), in install order. Never the compiled fn. Quarantined rules
    // (failed a prior load's revalidation) are carried too — NO SILENT LOSS:
    // a rule that was ever authored either runs or stays visible with its
    // errors; a save/load round-trip may move a rule between the two sets but
    // can never make one vanish.
    rules: engine.ruleSources ? [...engine.ruleSources.values()] : [],
    rulesQuarantined: (engine.ruleQuarantine ?? []).map(q => ({ rule: q.rule, errors: q.errors })),
    // RD-024: the world's VOCABULARY travels with the world, same rationale as
    // rules (authored content, world data). Additive+optional: old saves load
    // with the default farm schema; still schema v1.
    schemaDefs: w.schema.defs,
  };
}

const saveText = (engine) => JSON.stringify(save(engine));

// ---- LOAD: reconstruct authoritative state, then rebuild derived indexes.
function load(obj, capacityHint) {
  if (!obj || obj.v !== SCHEMA_VERSION) throw new Error(`persistence: unsupported schema ${obj && obj.v}`);
  // capacity restores from the snapshot (RD-B6.1); the hint may only RAISE it
  // (an explicit caller choice — a raised capacity legitimately widens count-
  // expr intervals at revalidation). Old saves without the field keep the
  // legacy floor. Additive+optional, so still schema v1.
  const cap = Math.max(obj.capacity ?? 0, capacityHint || 0, 64,
    obj.entities.length * 2 + (obj.tombstones?.length ?? 0));  // headroom incl. possible stubs
  const g = new Engine(cap, obj.schemaDefs ? { schemaDefs: obj.schemaDefs } : {});
  const w = g.w;

  // pass 1: materialise every live entity (parent wired in pass 2 by uuid)
  const parentUuid = [];
  for (const ent of obj.entities) {
    const e = w.count++;
    w.type[e] = ent.type; w.destroyed[e] = 0;
    w.uuid[e] = ent.uuid; w.byUuid.set(ent.uuid, e);
    w.name[e] = ent.name; w.refs[e] = (ent.refs || []).slice();
    w.orderKey[e] = ent.orderKey ?? e;   // RD-005.3
    w.parent[e] = -1; parentUuid[e] = ent.parent;
    const row = w._poolNext[ent.type]++; w.componentIndex[e] = row;
    for (const [f, spec] of Object.entries(w.schema.defs[ent.type].fields)) {     // RD-024: schema-driven
      if (spec.pool === false) continue;
      const val = ent[f] ?? spec.init ?? 0;
      // RD-035 audit: load is an INGRESS from UNTRUSTED data (a save file), and it wrote
      // field values straight into the typed pools with no range check — so a corrupted
      // or tampered save loaded out-of-range values (999 -> 231 Uint8 wrap), breaking the
      // "every value satisfies its schema" invariant AFTER load (the same shape as the
      // createChild hole, one ingress over). Validate here: a corrupt save is rejected
      // WHOLE, naming the field — reject, never wrap/repair (RD-018).
      if (!Number.isInteger(val) || val < spec.range[0] || val > spec.range[1])
        throw new Error(`corrupt save: ${w.schema.TYPE_NAME[ent.type]}.${f} = ${JSON.stringify(ent[f])} outside declared range [${spec.range[0]}, ${spec.range[1]}]`);
      w.pools[ent.type][f][row] = val;
    }
  }
  for (const t of obj.tombstones || []) w.tombstones.set(t.uuid, { type: t.type, lastName: t.lastName });
  // pass 2: resolve parent uuids -> indices.
  // RD-B6.1 (found by the fuzzer's P6 reload-fork arm): a DANGLING parent edge
  // — child of an entity deleted before save; RD-005.2 keeps it SURFACED, not
  // cascaded — must survive the reload. The previous behavior ("child loads as
  // a root") made the reloaded branch observably diverge from the branch that
  // never saved: parentOf(child) answered the tombstoned uuid vs null, sibling
  // sets (and therefore move-key computation) differed, and GC parity broke
  // (a dangling parent is exactly what keeps a tombstone alive in RD-019.1).
  // A tombstoned parent re-materializes as a STUB destroyed row — the same
  // representation the original process holds: row present, destroyed=1,
  // absent from byUuid, tombstone metadata intact. componentIndex is poisoned
  // with NO_ROW (componentIndex is Uint32 — a literal -1 would WRAP to the
  // same bits but make every `< 0` check silently dead; the engine's pool-
  // field accessors throw on NO_ROW): a stub has no pool row, and nothing may
  // ever read fields of a destroyed entity. A tombstone GC'd before save
  // still degrades to root —
  // its metadata is gone, honestly (the RD-019.1/T8 shape).
  // Stub chains: a stub's own parent resolves recursively (dead chains from
  // the persisted tombstone.parent field — see save()), so cycle walks make
  // the SAME traversal, and reach the same verdicts, as the never-saved
  // branch. stubs.set happens before the recursion: frozen dead chains are
  // acyclic (P4 held when they were live), but don't hang if that's ever wrong.
  const tombParent = new Map();
  for (const t of obj.tombstones || []) if (t.parent !== undefined) tombParent.set(t.uuid, t.parent);
  const stubs = new Map();
  const materialize = (pu) => {              // uuid -> entity index, or -1
    const pe = w.byUuid.get(pu);
    if (pe !== undefined) return pe;
    const ts = w.tombstones.get(pu);
    if (!ts) return -1;                      // GC'd pre-save: degrades to root (T8 honesty)
    let se = stubs.get(pu);
    if (se !== undefined) return se;
    if (w.count >= w.capacity) throw new Error(`persistence: capacity ${w.capacity} too small for tombstone stubs`);
    se = w.count++;
    stubs.set(pu, se);
    w.type[se] = ts.type; w.destroyed[se] = 1;
    w.uuid[se] = pu;                         // NOT in byUuid — destroyed entities never are
    w.name[se] = ts.lastName; w.refs[se] = [];
    w.orderKey[se] = 0; w.componentIndex[se] = NO_ROW;
    const pp = tombParent.get(pu);
    w.parent[se] = pp != null ? materialize(pp) : -1;
    return se;
  };
  for (let e = 0, n = w.count; e < n; e++) {
    const pu = parentUuid[e];
    if (pu != null) w.parent[e] = materialize(pu);
  }

  // restore identity high-water mark BEFORE any future spawn — never recycle.
  w._uuidSeq = obj.uuidSeq;
  g.tick = obj.tick || 0;

  // REBUILD derived indexes (RD-001) from authoritative data. Stale-proof: the
  // on-disk form had no index to disagree with, so this cannot load a lie.
  const ix = w.rebuildIndexes();
  w.byType = ix.byType; w.childrenOf = ix.childrenOf; w.referrersOf = ix.referrersOf;

  // RD-B6: reinstall persisted rules by RE-RUNNING the wire against the
  // RELOADED world — revalidation is load-bearing, not a formality. A
  // match.uuid rule whose target no longer resolves LIVE must surface as a
  // localized error (deleted vs missing, RD-004.6), never reinstall as a
  // silent no-op and never be dropped. Quarantined rules from the previous
  // session are retried the same way (validity can only be decided against
  // THIS world). g.ruleLoadReport records every rule's outcome; failures also
  // land in g.ruleQuarantine (which save() persists — no silent loss).
  const pending = [...(obj.rules || []), ...(obj.rulesQuarantined || []).map(q => q.rule)];
  g.ruleLoadReport = [];
  g.ruleQuarantine = [];
  for (const src of pending) {
    const r = installRule(g, src);
    g.ruleLoadReport.push(r.ok ? { name: src.name, ok: true } : { name: src?.name, ok: false, errors: r.errors });
    if (!r.ok) g.ruleQuarantine.push({ rule: src, errors: r.errors });
  }
  return g;
}

const loadText = (text, capacityHint) => load(JSON.parse(text), capacityHint);

module.exports = { save, saveText, load, loadText, SCHEMA_VERSION };
