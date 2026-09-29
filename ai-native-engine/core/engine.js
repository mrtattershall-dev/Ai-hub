'use strict';
// =============================================================================
// AI-NATIVE ENGINE — INTEGRATED CORE
// =============================================================================
// The "big open move" from STATE.md: every RD so far was an isolated prototype.
// This wires the DECIDED ones into ONE coherent core that speaks a single
// protocol for player edits, AI-proposed edits, undo, and plugins alike.
//
// What is composed here, and the decision each clause implements:
//   RD-004  / RD-004.6 : UUID identity assigned once, never recycled; delete =
//                        tombstone; reference resolution returns EXPLICIT
//                        absence (live / deleted / missing), never a value.
//   RD-006  / RD-008   : Structure-of-Arrays packed world; entities are integer
//                        indices; hot state in dense typed arrays.
//   RD-001             : authoritative world + DERIVED indexes (byType,
//                        childrenOf, referrersOf) so AI relationship queries are
//                        O(result), not O(N).
//   RD-002  / RD-003   : every edit flows Claim -> Schedule -> Validate ->
//                        Commit/Reject. Layered; each layer owns one problem.
//   RD-017             : indexes are TRANSACTIONAL state — staged and committed
//                        ATOMICALLY with the data; a reject applies neither.
//   RD-005 /.1 /.2     : same-tick writes to one field resolve by FIELD
//                        SEMANTICS (fold where a fold exists, else DEFER);
//                        semantics live in component metadata (type.field);
//                        structural merges enforce acyclicity + no silent orphan.
//   RD-007             : AI context = legible columnar text of a RETRIEVED SLICE.
//   RD-014             : a proposal passes a deterministic, GOAL-DERIVED contract
//                        gate before commit; agents propose, the gate disposes.
//
// Anchoring case, driven end-to-end in the test: Crop #142 — A harvests, B
// waters, same tick — the live P2P last-write-wins bug from Dust & Harvest.
// Zero deps, Node v24, `node core/integration_test.js`.
// =============================================================================

const TYPE = { CROP: 0, FISH: 1, ENEMY: 2, ZONE: 3 };
const TYPE_NAME = ['crop', 'fish', 'enemy', 'zone'];

// --- RD-005.1: fold semantics keyed by `type.field`. Undeclared => 'defer'. ---
// 'additive'|'max'|'min'|'set-union' are FOLDABLE (deterministic, lossless).
// 'label'/'structural'/anything-undeclared => DEFER (surface, author resolves).
const FOLD_SCHEMA = new Map(Object.entries({
  'crop.water':   'max',        // two waterings -> the wetter wins, lossless
  'crop.growth':  'max',
  'enemy.hp':     'min',        // two hits -> the lower hp (more damage) wins
  'zone.tally':   'additive',   // contributions sum
  'crop.name':    'label',      // opaque -> defer
  'crop.destroyed':'structural',// lifecycle -> defer to validator, never folded
}));
// which entity type legitimately owns each writable field (name is universal).
// A write to a field the target's type doesn't own is a cross-pool corruption
// (e.g. hp on a crop lands in an unrelated enemy's row) — an engine invariant,
// rejected regardless of how the caller reached submit().
const FIELD_OWNER = { water: TYPE.CROP, growth: TYPE.CROP, hp: TYPE.ENEMY, tally: TYPE.ZONE };
// RD-B2: engine-invariant value ranges (mirrors protocol.js FIELD_SPEC — the
// protocol rejects earlier with better localization; the engine is the
// backstop, exactly the FIELD_OWNER split RD-018 established). Found in
// RD-B1/A5: registered systems do NOT cross the protocol, so without this an
// in-process op's water=999 silently truncated to 231 in the Uint8 pool.
const FIELD_RANGE = { water: [0, 255], growth: [0, 255], hp: [0, 65535], tally: [0, 4294967295] };
// RD-022 CLAIM TTL CAP: the unconditional backstop against denial-of-progress
// at the claim layer. A claim is a soft, short-horizon coordination lease
// (RD-002 design intent: "someone's already doing that"), not a lock — every
// measured multi-tick action so far spans single-digit ticks (prototypes 3-4,
// capstone 3, fuzz 2), so 64 is ~16-32x headroom while bounding the worst case
// a vanished actor can deny an entity to a fixed horizon. Measured without it:
// claim{ticks:1e9} committed and blocked another actor 1000/1000 submits — the
// D&H denial-of-progress shape one level up — and the RD-018 wire passes any
// positive integer through, so an untrusted model reached it. Long holds are
// expressed as RENEWALS (holder re-claims, measured legal), which require the
// actor to still be alive — exactly the liveness signal a TTL is for.
// Enforced at the validate layer (whole-tx rejection, localized reason —
// never clamped: a clamp lets the author silently believe a hold it doesn't
// have; measured in experiments/032_claim_ttl). ticks must also be a positive
// integer <= cap: pre-fix, NaN made a zombie claim (never blocks, never
// swept), Infinity blocked forever, and a string '5' string-concatenated
// into `until`. decisions/RD-022_claim_ttl.md.
// Per-instance override: set `engine.claimTtlMax` (an opt kept OFF the
// constructor deliberately; the cap is engine policy, not per-world tuning).
const CLAIM_TTL_MAX = 64;

const foldSemantics = (type, field) => FOLD_SCHEMA.get(`${TYPE_NAME[type]}.${field}`) ?? 'defer';
const isFoldable = (sem) => sem === 'additive' || sem === 'max' || sem === 'min' || sem === 'set-union';

// --- RD-024: the SCHEMA REGISTRY — the world's vocabulary as instance data. ---
// The module-level tables above remain exported (back-compat) and describe the
// DEFAULT schema; a World built without an explicit schema behaves
// byte-identically to the pre-registry engine. Field spec:
//   { range:[lo,hi], fold?:'additive'|'max'|'min', init?:n,
//     pool:false (per-entity field: fold declared, no typed-array pool),
//     slice:false|number (context-slice column: hide, or explicit order) }
function makeSchema(defs) {
  const s = { defs: defs.map((d) => ({ name: d.name, fields: JSON.parse(JSON.stringify(d.fields ?? {})),
      ...(d.spatial ? { spatial: { x: d.spatial.x, y: d.spatial.y } } : {}) })),
    TYPE: {}, TYPE_NAME: [], OWNER: {}, RANGE: {}, FOLD: new Map(), sliceCols: [],
    spatial: {} /* RD-025: typeName -> {x,y} field names; coords stay ORDINARY fields */,
    ownersOf: new Map() /* field -> Set(typeIdx) — PER-TYPE namespace (RD-024: paddle.y and ball.y coexist) */ };
  for (const d of s.defs) if (d.spatial) s.spatial[d.name] = d.spatial;
  const cols = [];
  for (const d of s.defs) { s.TYPE[d.name.toUpperCase()] = s.TYPE_NAME.length; s.TYPE_NAME.push(d.name); }
  for (let t = 0; t < s.defs.length; t++) {
    for (const [f, spec] of Object.entries(s.defs[t].fields)) {
      if (spec.fold) s.FOLD.set(`${s.defs[t].name}.${f}`, spec.fold);
      if (spec.pool === false) continue;                    // per-entity field, no pool/owner/range
      s.OWNER[f] ??= t; s.RANGE[f] ??= spec.range;          // flat views kept for back-compat (first owner wins)
      (s.ownersOf.get(f) ?? s.ownersOf.set(f, new Set()).get(f)).add(t);
      if (spec.slice !== false && !cols.some((c) => c[0] === f))
        cols.push([f, typeof spec.slice === 'number' ? spec.slice : 1e9, cols.length]);
    }
  }
  s.sliceCols = cols.sort((a, b) => (a[1] - b[1]) || (a[2] - b[2])).map((c) => c[0]);
  s.fieldSpec = (t, f) => { const sp = s.defs[t]?.fields?.[f]; return sp && sp.pool !== false ? sp : undefined; };
  return s;
}
// RD-028: signed ranges get signed pools. Unsigned widths are unchanged, so every
// pre-RD-028 schema picks the identical array type (the compat bar depends on it).
const poolArrayFor = ([lo, hi]) => (lo >= 0
  ? (hi <= 255 ? Uint8Array : hi <= 65535 ? Uint16Array : Uint32Array)
  : (lo >= -128 && hi <= 127 ? Int8Array : lo >= -32768 && hi <= 32767 ? Int16Array : Int32Array));
// Field declaration order = persistence key order (growth before water — the
// pre-registry save wrote ent.growth first); slice numbers = the pre-registry
// context-slice column order (water, growth, hp; tally never had a column).
const DEFAULT_SCHEMA_DEFS = [
  { name: 'crop', fields: { growth: { range: [0, 255], fold: 'max', init: 0, slice: 1 },
                            water:  { range: [0, 255], fold: 'max', init: 0, slice: 0 },
                            name: { fold: 'label', pool: false }, destroyed: { fold: 'structural', pool: false } } },
  { name: 'fish', fields: {} },
  { name: 'enemy', fields: { hp: { range: [0, 65535], fold: 'min', init: 100, slice: 2 } } },
  { name: 'zone', fields: { tally: { range: [0, 4294967295], fold: 'additive', init: 0, slice: false } } },
];
function fold(sem, a, b) {
  switch (sem) {
    case 'additive':  return a + b;
    case 'max':       return Math.max(a, b);
    case 'min':       return Math.min(a, b);
    case 'set-union': return [...new Set([...a, ...b])];
    default: throw new Error(`fold() called on non-foldable semantics ${sem}`);
  }
}

// --- small index helpers (Set-valued maps), shared by live + staged views ----
const addTo  = (m, k, v) => { (m.get(k) ?? m.set(k, new Set()).get(k)).add(v); };
const delFrom = (m, k, v) => { const s = m.get(k); if (s) { s.delete(v); if (!s.size) m.delete(k); } };

// "NO pool row" sentinel for componentIndex (RD-B6.1: a persistence stub is a
// destroyed row with no component pool row). componentIndex is Uint32, so a
// "-1" write wraps to this value — sentinel checks MUST compare === NO_ROW,
// never `< 0` (which can never be true and silently checks nothing).
const NO_ROW = 0xFFFFFFFF;

// =============================================================================
// The world substrate (RD-006/008 SoA) + identity (RD-004) + indexes (RD-001).
// =============================================================================
class World {
  constructor(capacity = 1024, schema = null) {
    this.capacity = capacity;
    this.count = 0;
    // RD-024: instance-owned vocabulary (cloned so defineType can never mutate
    // another world's schema or the module default).
    this.schema = schema ?? makeSchema(DEFAULT_SCHEMA_DEFS);

    // HOT: dense, one row per entity index e
    this.type      = new Uint8Array(capacity);
    this.destroyed = new Uint8Array(capacity);   // RD-004.6 tombstone flag
    this.parent    = new Int32Array(capacity).fill(-1);
    this.componentIndex = new Uint32Array(capacity);

    // COMPONENT POOLS (per-type; pre-sized = conservative upper bound, RD-008)
    // schema-driven; legacy aliases (w.crop_growth etc.) kept for every field.
    this.pools = this.schema.TYPE_NAME.map(() => ({}));
    for (let t = 0; t < this.schema.defs.length; t++)
      for (const [f, spec] of Object.entries(this.schema.defs[t].fields)) {
        if (spec.pool === false) continue;
        this.pools[t][f] = new (poolArrayFor(spec.range))(capacity);
        this[`${this.schema.TYPE_NAME[t]}_${f}`] = this.pools[t][f];
      }
    this._poolNext = this.schema.TYPE_NAME.map(() => 0);

    // COLD identity (RD-004): kept OUTSIDE the hot arrays by design.
    this.uuid = new Array(capacity);        // e -> uuid
    this.byUuid = new Map();                // uuid -> e   (live only)
    this.name = new Array(capacity);        // e -> label (a 'defer' field)
    this.refs = new Array(capacity);        // e -> [uuid,...] (authored by UUID)
    this.tombstones = new Map();            // uuid -> {type, lastName}  RD-004.6
    this._uuidSeq = 0;                       // monotonic; NEVER recycled

    // DERIVED INDEXES (RD-001) — keyed by entity index e
    this.byType = new Map();
    this.childrenOf = new Map();
    this.referrersOf = new Map();

    // RD-005.3 ORDER-KEY: fractional position among siblings. The ordered view
    // is childrenOf sorted by (orderKey, uuid). A "move" is just a write to this
    // field, so it inherits RD-005 conflict-resolution (undeclared field => defer
    // on a same-item clash; different items merge), RD-017 staging, and RD-020 undo.
    this.orderKey = new Float64Array(capacity);
  }

  // identity: a fresh UUID every time, never reused (RD-004 / RD-004.6)
  _mintUuid() { return 'u' + (this._uuidSeq++).toString(36); }

  liveEntity(uuid) { const e = this.byUuid.get(uuid); return (e === undefined || this.destroyed[e]) ? -1 : e; }

  // RD-004.6: resolution returns EXPLICIT absence, never an ambiguous value.
  resolve(uuid) {
    const e = this.byUuid.get(uuid);
    if (e !== undefined && !this.destroyed[e]) return { status: 'live', e };
    if (this.tombstones.has(uuid)) return { status: 'deleted', ...this.tombstones.get(uuid) };
    return { status: 'missing' };
  }

  // full-rebuild ORACLE used by tests to catch any index desync (RD-017)
  rebuildIndexes() {
    const byType = new Map(), childrenOf = new Map(), referrersOf = new Map();
    for (let e = 0; e < this.count; e++) {
      if (this.destroyed[e]) continue;
      addTo(byType, this.type[e], e);
      if (this.parent[e] >= 0 && !this.destroyed[this.parent[e]]) addTo(childrenOf, this.parent[e], e);
      for (const ru of this.refs[e]) { const te = this.liveEntity(ru); if (te >= 0) addTo(referrersOf, te, e); }
    }
    return { byType, childrenOf, referrersOf };
  }
}

// =============================================================================
// The Engine — the single protocol. All mutation goes through submit().
// =============================================================================
class Engine {
  constructor(capacity = 1024, opts = {}) {
    // RD-B2 OP BUDGET: hard per-transaction op ceiling. Bounds the work any
    // single tick can be handed by ANY caller — player, AI wire, or a
    // registered system (each system's tick output is one tx).
    this.opsBudget = opts.opsBudget ?? 2048;
    // RD-B2.1 GLOBAL PER-TICK OP BUDGET: hard ceiling on the TOTAL ops one tick
    // admits across ALL transactions/actors/systems. The per-tx cap above bounds
    // each caller; a thousand individually-small callers is a different attack
    // (RD-B2 "what remains open", now closed). Default OFF (null) — existing
    // behavior unchanged. NOT persisted (like claims/history: session config,
    // not world state); a P.load'ed engine starts with the default.
    this.tickOpsBudget = opts.tickOpsBudget ?? null;
    this.w = new World(capacity, opts.schemaDefs ? makeSchema(opts.schemaDefs) : null);  // RD-024
    this.claims = new Map();     // e -> {actor, until}  (RD-002 claim layer)
    this.tick = 0;
    // (RD-M0.1 removed `this.log`, the committed-batch journal: write-only
    // since RD-020 landed — undo uses inverse-delta stacks, nothing read the
    // journal — and it retained EVERY committed op object forever. Surfaced as
    // an OOM + GC mark-compact spikes when per-entity rule txs multiplied the
    // retained graph at 5000-entity scale. Cross-session undo, if ever built,
    // wants a bounded/persisted log designed on purpose, not this relic.)
    // RD-020 history: inverse-delta undo/redo. Each undo entry is O(change), not
    // an O(N) world snapshot. Off by default (recording has a small cost).
    this.history = { on: false, undo: [], redo: [] };
    // SIMULATION (phase 0): trusted registered systems, run by stepTick().
    this.systems = [];
  }

  // -- direct spawn (bootstrap / trusted authoring). Returns {e, uuid}. --------
  spawn(type, props = {}) {
    const w = this.w;
    // RD-B2 CAPACITY INVARIANT: rows are never reused (RD-004.6), so count is
    // monotonic; past capacity the typed-array writes would be silently
    // IGNORED (JS OOB assignment is a no-op) leaving a ghost entity in byUuid
    // whose every field reads garbage. Fail loudly instead.
    if (w.count >= w.capacity) throw new Error(`world full: capacity ${w.capacity} reached`);
    const e = w.count++;
    const uuid = props.uuid ?? w._mintUuid();
    w.type[e] = type; w.destroyed[e] = 0;
    // props.parent is a UUID (or null/index). Resolve to an entity INDEX — a raw
    // uuid string coerces to NaN->0 in the Int32Array, silently parenting to
    // entity 0 (masked in tests only because the parent was usually entity 0).
    const pIdx = props.parent == null ? -1
      : (typeof props.parent === 'number' ? props.parent : (w.byUuid.get(props.parent) ?? -1));
    w.parent[e] = (pIdx >= 0 && !w.destroyed[pIdx]) ? pIdx : -1;
    w.uuid[e] = uuid; w.byUuid.set(uuid, e);
    w.name[e] = props.name ?? `${w.schema.TYPE_NAME[type]}-${e}`;
    w.refs[e] = (props.refs ?? []).slice();
    // initial order-key = spawn order (append after existing siblings). Unique &
    // monotonic; only relative order within a parent's childrenOf set matters.
    // RD-B6.1: the default derives from the entity's own PERSISTED identity seq,
    // NOT the entity index — a load compacts tombstoned rows out (RD-019), so an
    // index-based default gives post-reload spawns SMALLER keys than the branch
    // that never saved, interleaving them among pre-fork siblings (fork-
    // determinism violation in the RD-005.3 ordered view; found by 031). In a
    // never-persisted engine seq === index, so values are unchanged there.
    // Only a uuid _mintUuid could have produced parses as a seq ({1,10} keeps
    // the parse < 2^53); any CUSTOM uuid instead consumes a fresh seq number —
    // still append-ordered, unique, and reload-stable (uuidSeq is persisted) —
    // rather than parseInt garbage ('x-7' -> -7 would sort FIRST, not append;
    // review finding #4). A consumed seq just skips one uuid name: ids are
    // never recycled anyway, gaps are harmless.
    const mintedSeq = /^u[0-9a-z]{1,10}$/.test(String(uuid)) ? parseInt(String(uuid).slice(1), 36) : NaN;
    w.orderKey[e] = props.orderKey ?? (Number.isFinite(mintedSeq) ? mintedSeq : w._uuidSeq++);
    const row = w._poolNext[type]++; w.componentIndex[e] = row;
    for (const [f, spec] of Object.entries(w.schema.defs[type].fields)) {
      if (spec.pool === false) continue;
      w.pools[type][f][row] = props[f] ?? spec.init ?? 0;
    }
    // index the new entity
    addTo(w.byType, type, e);
    if (w.parent[e] >= 0) addTo(w.childrenOf, w.parent[e], e);
    for (const ru of w.refs[e]) { const te = w.liveEntity(ru); if (te >= 0) addTo(w.referrersOf, te, e); }
    return { e, uuid };
  }

  // component-field read (used by fold + validation), by entity index.
  // Pool-field access through a NO_ROW stub must FAIL LOUDLY: an out-of-bounds
  // typed-array read returns undefined (NaN downstream) and a write is a
  // SILENT no-op — the exact silent-corruption shape RD-B6.1 finding #2 was
  // about. Per-entity fields (name/orderKey/destroyed) stay readable: a stub
  // legitimately owns those rows.
  _field(e, field) {
    const w = this.w, row = w.componentIndex[e];
    if (field === 'name') return w.name[e];
    if (field === 'orderKey') return w.orderKey[e];
    if (field === 'destroyed') return w.destroyed[e];
    if (row === NO_ROW) throw new Error(`pool-field read '${field}' on ${w.uuid[e]}: destroyed stub has no component row`);
    const pool = w.pools[w.type[e]][field];
    return pool ? pool[row] : undefined;
  }
  _writeField(e, field, val) {
    const w = this.w, row = w.componentIndex[e];
    if (field === 'name') { w.name[e] = val; return; }
    if (field === 'orderKey') { w.orderKey[e] = val; return; }
    if (row === NO_ROW) throw new Error(`pool-field write '${field}' on ${w.uuid[e]}: destroyed stub has no component row`);
    const pool = w.pools[w.type[e]][field];
    if (!pool) throw new Error(`unknown writable field ${field}`);
    pool[row] = val;
  }

  // ---- RD-005.3 ordered-children view + move normalization ------------------
  // Siblings of e (same parent), sorted by (orderKey, uuid). Roots share parent=-1.
  _siblings(e) {
    const w = this.w, p = w.parent[e];
    const set = p >= 0 ? (w.childrenOf.get(p) ?? new Set())
                       : (() => { const s = new Set(); for (let k = 0; k < w.count; k++) if (!w.destroyed[k] && w.parent[k] < 0) s.add(k); return s; })();
    return [...set].filter(k => !w.destroyed[k]).sort((a, b) => w.orderKey[a] - w.orderKey[b] || (w.uuid[a] < w.uuid[b] ? -1 : 1));
  }
  // Public: children of a parent uuid IN ORDER (RD-005.3). Returns uuids.
  orderedChildren(parentUuid) {
    const w = this.w, pe = w.liveEntity(parentUuid);
    if (pe < 0) return [];
    return [...(w.childrenOf.get(pe) ?? [])].filter(k => !w.destroyed[k])
      .sort((a, b) => w.orderKey[a] - w.orderKey[b] || (w.uuid[a] < w.uuid[b] ? -1 : 1)).map(k => w.uuid[k]);
  }
  // Compute the fractional order-key that places `e` immediately AFTER sibling
  // `afterUuid` (null => front). Fractional midpoint of the base ordering, so
  // concurrent moves of different items are independent, commuting key writes.
  _computeMoveKey(e, afterUuid) {
    const w = this.w;
    const sibs = this._siblings(e).filter(k => k !== e); // ordering to insert into
    if (afterUuid == null) {                              // to the front
      return sibs.length ? w.orderKey[sibs[0]] - 1 : 0;
    }
    const ae = w.liveEntity(afterUuid);
    if (ae < 0 || w.parent[ae] !== w.parent[e]) return null; // not a live sibling
    const idx = sibs.indexOf(ae);
    const next = sibs[idx + 1];
    return next !== undefined ? (w.orderKey[ae] + w.orderKey[next]) / 2 : w.orderKey[ae] + 1;
  }

  // ---------------------------------------------------------------------------
  // THE PIPELINE. submit() takes a BATCH of transactions from possibly-different
  // actors landing in the same tick, and runs the four RD-002/003 layers plus
  // RD-005 conflict resolution and the RD-014 contract gate. Nothing mutates the
  // world until the atomic staged commit (RD-017).
  // ---------------------------------------------------------------------------
  //  tx = { actor, ops:[op...], contract? }
  //  op = { kind, target(uuid), ... }
  //    kinds: setfield{field,value} | reparent{parent(uuid)} | delete
  //           | claim{ticks} | createChild{type,props}
  submit(batch) {
    this.tick++;
    const w = this.w;
    // RD-005.3: normalize `move{target, after}` into an orderKey field-write,
    // computed against the CURRENT committed sibling order. A move then flows
    // through the ordinary field pipeline: different items merge; a same-item
    // clash defers (orderKey is undeclared => defer semantics); staging + undo
    // apply unchanged. Invalid moves are marked for rejection in validation.
    batch = batch.map(tx => ({ ...tx, ops: tx.ops.map(op => {
      if (op.kind !== 'move') return op;
      const e = w.liveEntity(op.target);
      if (e < 0) return { kind: 'setfield', target: op.target, field: 'orderKey', value: 0 }; // absence -> rejected in validate
      const key = this._computeMoveKey(e, op.after ?? null);
      if (key == null) return { kind: 'setfield', target: op.target, field: 'orderKey', value: 0,
        _invalidMove: `move: "after" ${op.after} is not a live sibling of ${op.target}` };
      return { kind: 'setfield', target: op.target, field: 'orderKey', value: key };
    }) }));
    const results = batch.map(tx => ({ actor: tx.actor, status: 'pending', reasons: [] }));

    // ---- LAYER 0.5: OP BUDGET (RD-B2) — an oversized tx is rejected WHOLE
    // (atomicity: never truncated to fit; a partial behavior is corruption).
    batch.forEach((tx, i) => {
      if (tx.ops.length > this.opsBudget) {
        results[i].status = 'rejected';
        results[i].reasons.push(`budget: ${tx.ops.length} ops exceeds per-tx budget ${this.opsBudget} — rejected whole, not truncated`);
      }
    });

    // ---- LAYER 0.6: GLOBAL PER-TICK OP BUDGET (RD-B2.1) ----------------------
    // Bounds the TOTAL ops this tick admits across all surviving txs. Runs
    // BEFORE claims/scheduling, so a budget-rejected tx has ZERO footprint —
    // no claim placed, no op scheduled, nothing staged. Determinism under
    // permutation (RD-003/P1): admission order is (actor name, batch position),
    // the same cross-actor ordering discipline the scheduler uses — which txs
    // fit can never depend on arrival order. Policy is GREEDY-FIT: a tx that
    // does not fit is rejected WHOLE (RD-002: a partial behavior is corruption,
    // never truncated to fit) and consumes no budget, but later txs in
    // admission order may still fit — one oversized actor cannot starve the
    // rest of the tick (decided + measured in decisions/RD-B2.1_tick_budget.md).
    // Txs already rejected by the per-tx cap above consume no tick budget
    // (they will commit nothing); the two caps compose: per-tx catches one fat
    // tx, per-tick catches many small ones.
    if (this.tickOpsBudget != null) {
      const live = batch.map((_, i) => i).filter(i => results[i].status !== 'rejected');
      const demand = live.reduce((n, i) => n + batch[i].ops.length, 0);
      if (demand > this.tickOpsBudget) {
        live.sort((a, b) =>
          String(batch[a].actor).localeCompare(String(batch[b].actor)) || (a - b));
        let used = 0;
        for (const i of live) {
          const n = batch[i].ops.length;
          if (used + n <= this.tickOpsBudget) { used += n; continue; }
          results[i].status = 'rejected';
          results[i].reasons.push(
            `tick-budget: tick demanded ${demand} ops across ${live.length} txs, over per-tick budget ${this.tickOpsBudget} — this tx (${n} ops, actor ${batch[i].actor}) did not fit in deterministic actor order and is rejected whole, zero footprint`);
        }
      }
    }

    // ---- LAYER 1: CLAIM (RD-002) — reject ops on objects another actor holds -
    // and grant explicit claim ops. Claims expire; a stale claim is ignored.
    for (const [k] of this.claims) if (this.claims.get(k).until <= this.tick) this.claims.delete(k);
    batch.forEach((tx, i) => {
      for (const op of tx.ops) {
        if (op.kind === 'claim') continue; // granting handled after conflict pass
        const e = w.liveEntity(op.target);
        if (e < 0) continue;               // absence handled at validate
        const held = this.claims.get(e);
        if (held && held.actor !== tx.actor && held.until > this.tick) {
          results[i].status = 'rejected';
          results[i].reasons.push(`claim: ${op.target} held by ${held.actor} until tick ${held.until}`);
        }
      }
    });

    // ---- LAYER 2: SCHEDULE (RD-003) — impose a deterministic total order on
    // the surviving ops, independent of arrival order. Priority: destructive
    // (delete) and structural before field writes, then by actor, then index.
    const KIND_PRI = { delete: 0, reparent: 1, createChild: 2, setfield: 3, claim: 4 };
    const scheduled = [];
    batch.forEach((tx, i) => {
      if (results[i].status === 'rejected') return;
      tx.ops.forEach((op, j) => scheduled.push({ op, txi: i, actor: tx.actor, seq: j }));
    });
    scheduled.sort((a, b) =>
      (KIND_PRI[a.op.kind] - KIND_PRI[b.op.kind]) ||
      String(a.actor).localeCompare(String(b.actor)) ||
      (a.txi - b.txi) || (a.seq - b.seq));

    // ---- LAYER 2.5: CONFLICT RESOLUTION (RD-005/.1/.2) — group same-tick
    // writes to the SAME (target,field). Foldable => fold to one value.
    // Non-foldable (label/structural/undeclared) => DEFER: keep the highest
    // scheduled one, record the conflict; never silently pick by timestamp.
    const writeGroups = new Map(); // key target|field -> [entries]
    const deferrals = [];
    for (const s of scheduled) {
      if (s.op.kind !== 'setfield') continue;
      const key = `${s.op.target}|${s.op.field}`;
      (writeGroups.get(key) ?? writeGroups.set(key, []).get(key)).push(s);
    }
    const resolvedValue = new Map(); // "target|field" -> value to actually write
    for (const [key, entries] of writeGroups) {
      const [target, field] = key.split('|');
      const e = w.liveEntity(target);
      if (entries.length === 1) { resolvedValue.set(key, entries[0].op.value); continue; }
      const sem = e >= 0 ? (w.schema.FOLD.get(`${w.schema.TYPE_NAME[w.type[e]]}.${field}`) ?? 'defer') : 'defer';
      if (isFoldable(sem)) {
        let acc = entries[0].op.value;
        for (let k = 1; k < entries.length; k++) acc = fold(sem, acc, entries[k].op.value);
        resolvedValue.set(key, acc);                                   // lossless auto-fold
      } else {
        // RD-005 DEFER: a non-foldable contested field is written by NEITHER
        // side (no LWW, no timestamp arbitration). The field holds its prior
        // value; the conflict is surfaced for the author to resolve. The AI may
        // re-propose, but that re-enters as a fresh unresolved edit.
        // (key intentionally left out of resolvedValue -> staging skips it.)
        deferrals.push({ target, field, semantics: sem,
          competing: entries.map(x => ({ actor: x.actor, value: x.op.value })) });
        for (const x of entries) results[x.txi].reasons.push(
          `deferred: ${field} of ${target} contested (${sem}) — held for author resolution, not auto-picked`);
      }
    }

    // RD-B2 RANGE INVARIANT: a resolved (possibly FOLDED) numeric value that
    // does not fit its field's typed-array range is rejected for EVERY
    // contributing tx — never truncated or clamped (the RD-018 free-form
    // corruption: a Uint8 pool would silently wrap 999 -> 231 with no signal).
    // Checked on the RESOLVED value so an additive fold whose SUM overflows is
    // caught even when each contribution alone is in range. Integer-typed
    // fields also reject non-integers (typed arrays silently floor 2.5 -> 2).
    for (const [key, entries] of writeGroups) {
      if (!resolvedValue.has(key)) continue;
      const [tgt, field] = key.split('|');
      const te = w.liveEntity(tgt);                          // RD-024: per-type range (paddle.y vs ball.y may differ)
      const range = te >= 0 ? w.schema.fieldSpec(w.type[te], field)?.range : w.schema.RANGE[field];
      // RD-B6.1 (review finding #1): orderKey is Float64 — no int range — but a
      // NON-FINITE key must still reject: it sorts unpredictably (NaN) and does
      // not survive JSON persistence (Infinity/NaN -> null -> load's ?? fallback
      // silently REWRITES it), so a committed non-finite key makes save/reload
      // observably diverge. Engine backstop, same RD-B2 logic as ranges: the
      // wire can't emit orderKey at all, but trusted in-process callers can.
      if (field === 'orderKey') {
        const v = resolvedValue.get(key);
        if (!Number.isFinite(v)) {
          resolvedValue.delete(key); // no write lands
          for (const x of entries) {
            results[x.txi].status = 'rejected';
            results[x.txi].reasons.push(`range: orderKey=${v} must be finite — non-finite keys corrupt sibling order and do not survive persistence`);
          }
        }
        continue;
      }
      if (!range) continue; // name (string) has no int range
      const v = resolvedValue.get(key);
      if (!Number.isInteger(v) || v < range[0] || v > range[1]) {
        resolvedValue.delete(key); // no write lands
        for (const x of entries) {
          results[x.txi].status = 'rejected';
          results[x.txi].reasons.push(`range: ${field}=${v} outside integer range [${range[0]},${range[1]}] — rejected, not clamped`);
        }
      }
    }

    // RD-005.2 STRUCTURAL: divergent reparents of the SAME node (to DIFFERENT
    // parents) in one batch are a conflict — DEFER (keep the node's current
    // parent), never silently apply both (which double-lists it in childrenOf)
    // nor LWW. Same-destination reparents are idempotent and allowed.
    const reparentGroups = new Map();
    for (const s of scheduled) if (s.op.kind === 'reparent')
      (reparentGroups.get(s.op.target) ?? reparentGroups.set(s.op.target, []).get(s.op.target)).push(s);
    const deferredReparent = new Set();
    for (const [target, entries] of reparentGroups) {
      if (entries.length === 1 || new Set(entries.map(x => x.op.parent)).size === 1) continue;
      deferredReparent.add(target);
      deferrals.push({ target, field: 'parent', semantics: 'structural',
        competing: entries.map(x => ({ actor: x.actor, parent: x.op.parent })) });
      for (const x of entries) results[x.txi].reasons.push(
        `deferred: reparent of ${target} contested (divergent parents) — held, not auto-picked`);
    }

    // ---- LAYER 3+4: VALIDATE then STAGED COMMIT (RD-002 + RD-017) ------------
    // Build a staging plan: data deltas + index deltas, applied together or not
    // at all. Validation runs against a scratch that reflects earlier ops in the
    // same batch, so intra-batch dependencies are seen.
    const plan = this._stageAndValidate(scheduled, resolvedValue, results, batch, deferredReparent);
    if (!plan) { // a hard structural invariant failed the whole batch
      return { tick: this.tick, results, deferrals, committed: 0 };
    }

    // ---- LAYER 4b: CONTRACT GATE (RD-014) — each tx's goal-derived contract
    // checked against the PROPOSED post-state before anything commits.
    batch.forEach((tx, i) => {
      if (results[i].status === 'rejected' || !tx.contract) return;
      const verdict = tx.contract(plan.preview);
      if (verdict !== true) {
        results[i].status = 'rejected';
        results[i].reasons.push(`contract: ${verdict}`);
        plan.dropTx(i);   // remove this tx's effects from the staged plan
      }
    });

    // ---- COMMIT: apply staged data + index deltas atomically (RD-017) --------
    plan.commit();

    let committed = 0;
    batch.forEach((tx, i) => {
      if (results[i].status === 'pending') { results[i].status = 'committed'; committed++; }
    });
    // grant claims requested by committed txs
    batch.forEach((tx, i) => {
      if (results[i].status !== 'committed') return;
      for (const op of tx.ops) if (op.kind === 'claim') {
        const e = w.liveEntity(op.target);
        if (e >= 0) this.claims.set(e, { actor: tx.actor, until: this.tick + (op.ticks ?? 3) });
      }
    });
    if (committed) {
      if (this.history.on) {
        const inv = plan.committedInverses();
        if (inv.length) { this.history.undo.push(inv); this.history.redo.length = 0; } // new edit clears redo (linear)
      }
    }
    return { tick: this.tick, results, deferrals, committed };
  }

  // ---------------------------------------------------------------------------
  // RD-020 HISTORY — inverse-delta undo/redo. Storage per step is O(change), not
  // an O(N) world snapshot. Identity is preserved: undoing a delete resurrects
  // the SAME uuid (the row was never cleared, only tombstoned); undoing a create
  // re-tombstones its uuid (never recycled). Undo/redo apply atomically w.r.t.
  // the derived indexes by reusing the RD-019 rebuild (stale-proof by construction).
  // ---------------------------------------------------------------------------
  enableHistory() { this.history.on = true; return this; }

  // apply a list of inverse entries (in order); return the OPPOSITE list (so the
  // move is itself reversible). Does NOT touch indexes — caller rebuilds once.
  _applyInverseList(entries) {
    const w = this.w, opp = [];
    for (const en of entries) {
      if (en.t === 'field') {
        opp.push({ t: 'field', e: en.e, field: en.field, val: this._field(en.e, en.field) });
        this._writeField(en.e, en.field, en.val);
      } else if (en.t === 'parent') {
        opp.push({ t: 'parent', e: en.e, val: w.parent[en.e] });
        w.parent[en.e] = en.val;
      } else if (en.t === 'restore') {            // make e live again (undo of a delete)
        opp.push({ t: 'remove', e: en.e, uuid: en.uuid });
        w.destroyed[en.e] = 0; w.byUuid.set(en.uuid, en.e); w.tombstones.delete(en.uuid);
      } else if (en.t === 'remove') {             // tombstone e (undo of a create)
        opp.push({ t: 'restore', e: en.e, uuid: en.uuid });
        w.destroyed[en.e] = 1; w.byUuid.delete(en.uuid);
        w.tombstones.set(en.uuid, { type: w.type[en.e], lastName: w.name[en.e] });
      }
    }
    return opp;
  }

  _rebuildLiveIndexes() {
    const ix = this.w.rebuildIndexes();
    this.w.byType = ix.byType; this.w.childrenOf = ix.childrenOf; this.w.referrersOf = ix.referrersOf;
  }

  undo() {
    if (!this.history.undo.length) return { ok: false, reason: 'nothing to undo' };
    const entries = this.history.undo.pop();
    const opp = this._applyInverseList(entries.slice().reverse()); // reverse commit order
    this._rebuildLiveIndexes();
    this.history.redo.push(opp);
    return { ok: true, applied: entries.length };
  }
  redo() {
    if (!this.history.redo.length) return { ok: false, reason: 'nothing to redo' };
    const entries = this.history.redo.pop();
    const opp = this._applyInverseList(entries.slice().reverse());
    this._rebuildLiveIndexes();
    this.history.undo.push(opp);
    return { ok: true, applied: entries.length };
  }

  // Build the staged plan. Returns null if a hard structural invariant fails.
  _stageAndValidate(scheduled, resolvedValue, results, batch, deferredReparent = new Set()) {
    const w = this.w;
    // Every staged effect carries its owning txi so a tx dropped by the contract
    // gate (or rejected in validation) contributes NOTHING at commit (RD-017:
    // data+index move together, per transaction).
    const dataOps = [];        // {txi, fn}
    const indexDeltas = [];    // {txi, add:0|1, map, key, val} — applied IN ORDER so a
                               // same-node add-then-del (reparent then delete) nets correctly.
    const inverses = [];       // {txi, t, ...} — how to get BACK to pre-batch (RD-020)
    const isDead = (i) => results[i].status === 'rejected' || results[i]._dropped;
    // scratch views of mutable per-entity state so validation sees prior ops
    const sDestroyed = new Map(); // e -> 0/1
    const sParent = new Map();    // e -> parentE
    const sField = new Map();     // "e|field" -> value

    const curDestroyed = (e) => sDestroyed.has(e) ? sDestroyed.get(e) : w.destroyed[e];
    const curParent = (e) => sParent.has(e) ? sParent.get(e) : w.parent[e];

    const seenKey = new Set(); // dedupe: a folded field-group commits once
    // FIXPOINT (concurrency correctness): a tx can be rejected by a LATE op after
    // its EARLIER ops already wrote scratch that OTHER txs validated against (e.g.
    // a doomed reparent hiding a cycle from a later one). Re-run until the rejected
    // set stabilises; a rejected tx is skipped from the top on the next pass and so
    // pollutes no one's scratch. UUID minting is deferred to commit so re-runs are
    // side-effect-free and the counter advances exactly once, deterministically.
    let prevRejected = -1, guard = 0, pendingCreates = 0;
    while (guard++ <= scheduled.length + 2) {
      dataOps.length = 0; indexDeltas.length = 0; inverses.length = 0;
      sDestroyed.clear(); sParent.clear(); sField.clear(); seenKey.clear();
      pendingCreates = 0;
      for (const s of scheduled) {
      const i = s.txi;
      if (results[i].status === 'rejected') continue;
      const { op } = s;
      const e = w.liveEntity(op.target);

      // VALIDATE explicit absence (RD-004.6): acting on a dead/missing target.
      if (op.kind !== 'claim' && op.kind !== 'createChild' && e < 0) {
        const r = w.resolve(op.target);
        results[i].status = 'rejected';
        results[i].reasons.push(`validate: target ${op.target} is ${r.status}`);
        continue;
      }

      if (op.kind === 'setfield') {
        if (op._invalidMove) { results[i].status = 'rejected'; results[i].reasons.push(`validate: ${op._invalidMove}`); continue; }
        if (curDestroyed(e)) { results[i].status = 'rejected'; results[i].reasons.push(`validate: cannot write ${op.field} of a destroyed object`); continue; }
        const owners = w.schema.ownersOf.get(op.field);      // RD-024: per-type namespace
        // RD-035 audit: a field NO type owns (and not a universal per-entity field —
        // `name`/`orderKey`, written specially in _writeField) used to fall THROUGH
        // validation and THROW at commit ('unknown writable field'). That throw was
        // reachable over the wire (sanitizeOps shape-checks but not field ownership),
        // so a network client could crash a tick. Reject it here with a localized
        // reason — every caller (wire, tick, in-process) now gets an error, not a throw.
        if (op.field !== 'name' && op.field !== 'orderKey' && !owners) {
          results[i].status = 'rejected'; results[i].reasons.push(`validate: no type has a field '${op.field}' — unknown field`); continue;
        }
        if (owners && !owners.has(w.type[e])) { results[i].status = 'rejected'; results[i].reasons.push(`validate: field '${op.field}' not valid on a ${w.schema.TYPE_NAME[w.type[e]]} (cross-pool write blocked)`); continue; }
        const key = `${op.target}|${op.field}`;
        if (seenKey.has(key)) continue; seenKey.add(key);
        if (!resolvedValue.has(key)) continue; // deferred/held (RD-005): no write
        const val = resolvedValue.get(key);
        sField.set(`${e}|${op.field}`, val);
        inverses.push({ txi: i, t: 'field', e, field: op.field, val: this._field(e, op.field) }); // pre-batch value
        dataOps.push({ txi: i, fn: () => this._writeField(e, op.field, val) });

      } else if (op.kind === 'reparent') {
        if (deferredReparent.has(op.target)) continue; // RD-005.2 contested reparent: held
        if (curDestroyed(e)) { results[i].status = 'rejected'; results[i].reasons.push(`validate: cannot reparent a deleted object`); continue; }
        const pe = w.liveEntity(op.parent);
        if (pe < 0) { results[i].status = 'rejected'; results[i].reasons.push(`validate: new parent ${op.parent} not live`); continue; }
        if (curDestroyed(pe)) { results[i].status = 'rejected'; results[i].reasons.push(`validate: new parent ${op.parent} is being deleted this batch`); continue; }
        // RD-005.2 acyclicity: walk up from proposed parent; if we hit e, reject.
        let cur = pe, cyc = false;
        for (let hops = 0; cur >= 0 && hops <= w.count; hops++) { if (cur === e) { cyc = true; break; } cur = curParent(cur); }
        if (cyc) { results[i].status = 'rejected'; results[i].reasons.push(`validate: reparent would create a cycle`); continue; }
        const oldP = curParent(e);
        sParent.set(e, pe);
        inverses.push({ txi: i, t: 'parent', e, val: w.parent[e] }); // pre-batch real parent index
        dataOps.push({ txi: i, fn: () => { w.parent[e] = pe; } });
        if (oldP >= 0) indexDeltas.push({ txi: i, add: 0, map: w.childrenOf, key: oldP, val: e });
        indexDeltas.push({ txi: i, add: 1, map: w.childrenOf, key: pe, val: e });

      } else if (op.kind === 'delete') {
        if (curDestroyed(e)) continue; // already gone; idempotent
        sDestroyed.set(e, 1);
        const uuid = w.uuid[e], type = w.type[e], lastName = w.name[e], parentE = curParent(e), refsU = w.refs[e];
        inverses.push({ txi: i, t: 'restore', e, uuid }); // resurrect the SAME uuid (row data is never cleared)
        dataOps.push({ txi: i, fn: () => {
          w.destroyed[e] = 1;
          w.byUuid.delete(uuid);
          w.tombstones.set(uuid, { type, lastName }); // RD-004.6 tombstone
        } });
        // atomic index removal (RD-017): out of byType, childrenOf, referrersOf,
        // and drop reverse-edges FROM this node.
        indexDeltas.push({ txi: i, add: 0, map: w.byType, key: type, val: e });
        if (parentE >= 0) indexDeltas.push({ txi: i, add: 0, map: w.childrenOf, key: parentE, val: e });
        for (const ru of refsU) { const te = w.liveEntity(ru); if (te >= 0) indexDeltas.push({ txi: i, add: 0, map: w.referrersOf, key: te, val: e }); }
        // clear INCOMING index keys held BY this node: once it's a tombstone the
        // oracle no longer tracks referrers-of-it or children-of-it (both would
        // be dangling), so the live index must drop those keys atomically too.
        for (const r of (w.referrersOf.get(e) ?? [])) indexDeltas.push({ txi: i, add: 0, map: w.referrersOf, key: e, val: r });
        for (const ch of (w.childrenOf.get(e) ?? [])) indexDeltas.push({ txi: i, add: 0, map: w.childrenOf, key: e, val: ch });
        // RD-005.2 no silent orphan: children of a deleted parent are surfaced.
        const kids = w.childrenOf.get(e);
        if (kids && kids.size) results[i].reasons.push(`note: ${kids.size} child(ren) orphaned by delete of ${op.target} (surfaced, not cascaded)`);

      } else if (op.kind === 'createChild') {
        const pe = w.liveEntity(op.parent);
        if (op.parent && pe < 0) { results[i].status = 'rejected'; results[i].reasons.push(`validate: parent ${op.parent} not live`); continue; }
        if (pe >= 0 && curDestroyed(pe)) { results[i].status = 'rejected'; results[i].reasons.push(`validate: parent ${op.parent} is being deleted this batch`); continue; }
        // RD-B2 CAPACITY: creates staged this batch count against capacity too,
        // so a batch cannot overshoot the row budget between checks.
        if (w.count + pendingCreates >= w.capacity) { results[i].status = 'rejected'; results[i].reasons.push(`validate: world full (capacity ${w.capacity})`); continue; }
        // RD-035 audit fix: props are written STRAIGHT into the typed pools at spawn
        // (spawn(): pools[type][f][row] = props[f] ?? init ?? 0), so an out-of-range
        // prop was silently WRAPPED (999 -> 231 on a Uint8 field), bypassing the range
        // proof at CREATION — reachable via a player tx, the wire (sanitizeOps), or a
        // rule spawn effect. Validate props here so EVERY untrusted path that creates an
        // entity is range-safe: rejected whole, never wrapped (RD-018 — never clamp).
        {
          const cf = w.schema.defs[op.type] && w.schema.defs[op.type].fields;
          let bad = null;
          if (cf && op.props) for (const [f, val] of Object.entries(op.props)) {
            const sp = cf[f];
            if (!sp || sp.pool === false) continue;   // universal / non-pooled props (name/parent/uuid/refs/orderKey)
            if (!Number.isInteger(val) || val < sp.range[0] || val > sp.range[1]) { bad = `${f}=${JSON.stringify(val)} outside [${sp.range[0]},${sp.range[1]}]`; break; }
          }
          if (bad) { results[i].status = 'rejected'; results[i].reasons.push(`validate: createChild prop ${bad} — rejected, not wrapped`); continue; }
        }
        pendingCreates++;
        // mint at COMMIT (spawn) so fixpoint re-runs are side-effect-free and the
        // uuid counter advances exactly once, in deterministic scheduled order.
        const inv = { txi: i, t: 'remove', e: -1, uuid: null };
        inverses.push(inv);
        const created = results[i]._created = (results[i]._created ?? []);
        dataOps.push({ txi: i, fn: () => {
          const born = this.spawn(op.type, { ...op.props, parent: pe >= 0 ? w.uuid[pe] : null });
          inv.e = born.e; inv.uuid = born.uuid; created.push(born.uuid);
        } });

      } else if (op.kind === 'claim') {
        // RD-022: validate the lease BEFORE grant (grant is post-commit). Every
        // rejection below was measured as a SILENT break pre-fix (probe +
        // experiments/032_claim_ttl NC): NaN -> zombie entry (never blocks,
        // never swept); Infinity / 1e9 -> unbounded denial-of-progress;
        // string '5' -> until string-concats to the wrong tick; deleted
        // target -> committed no-op the author believes is a hold.
        if (e < 0) {
          const r = w.resolve(op.target);
          results[i].status = 'rejected';
          results[i].reasons.push(`claim: cannot claim ${op.target} — target is ${r.status}`);
          continue;
        }
        if (curDestroyed(e)) {
          results[i].status = 'rejected';
          results[i].reasons.push(`claim: cannot claim ${op.target} — being deleted this batch`);
          continue;
        }
        const t = op.ticks ?? 3;
        const cap = this.claimTtlMax ?? CLAIM_TTL_MAX;
        if (!Number.isInteger(t) || t < 1) {
          results[i].status = 'rejected';
          results[i].reasons.push(`claim: ticks must be a positive integer (got ${String(t)})`);
          continue;
        }
        if (t > cap) {
          results[i].status = 'rejected';
          results[i].reasons.push(`claim: ticks ${t} exceeds the TTL cap ${cap} — a long hold is expressed as RENEWALS (re-claim while you still hold it)`);
          continue;
        }
      }
    }
      const nRej = results.reduce((n, r) => n + (r.status === 'rejected' ? 1 : 0), 0);
      if (nRej === prevRejected) break; // rejected set stabilised -> scratch is clean
      prevRejected = nRej;
    }
    for (const r of results) if (r.reasons.length) r.reasons = [...new Set(r.reasons)]; // notes repeat across passes

    // preview post-state for the contract gate (RD-014): a cheap read model.
    const preview = {
      field: (uuid, field) => { const e = w.liveEntity(uuid); if (e < 0) return undefined; const k = `${e}|${field}`; return sField.has(k) ? sField.get(k) : this._field(e, field); },
      destroyed: (uuid) => { const e = w.byUuid.get(uuid); if (e === undefined) return true; return !!curDestroyed(e); },
      parentUuid: (uuid) => { const e = w.liveEntity(uuid); if (e < 0) return null; const pe = curParent(e); return pe >= 0 ? w.uuid[pe] : null; },
    };

    return {
      preview,
      dropTx: (txi) => { // mark a tx's field writes null on contract failure
        // Re-mark: any dataOp we cannot easily unbind is guarded by the reject
        // status; setfield/reparent for a rejected tx are skipped at apply time.
        results[txi]._dropped = true;
      },
      commit: () => {
        // apply data first, then index deltas — as ONE unit (RD-017 STAGED).
        // A tx rejected in validation or dropped by the contract gate applies
        // NOTHING: its data and index effects move together or not at all.
        for (const d of dataOps) if (!isDead(d.txi)) d.fn();
        for (const d of indexDeltas) if (!isDead(d.txi)) (d.add ? addTo : delFrom)(d.map, d.key, d.val);
        // resolve createChild inverse targets now that spawn has assigned indices
        for (const inv of inverses) if (inv.t === 'remove' && inv.e < 0) inv.e = w.byUuid.get(inv.uuid);
      },
      // inverse-delta for the whole batch (RD-020), only from txs that committed
      committedInverses: () => inverses.filter(inv => !isDead(inv.txi)),
    };
  }

  // ---------------------------------------------------------------------------
  // RD-001 relationship queries, served from the derived indexes (O(result)).
  // ---------------------------------------------------------------------------
  allOfType(type)      { return [...(this.w.byType.get(type) ?? [])].sort((a,b)=>a-b); }
  childrenOf(uuid)     { const e = this.w.liveEntity(uuid); return e<0?[]:[...(this.w.childrenOf.get(e) ?? [])].sort((a,b)=>a-b); }
  referrersOf(uuid)    { const e = this.w.liveEntity(uuid); return e<0?[]:[...(this.w.referrersOf.get(e) ?? [])].sort((a,b)=>a-b); }
  indexesConsistent()  { // RD-017 invariant check against the oracle
    const t = this.w.rebuildIndexes();
    const dump = (m)=>JSON.stringify([...m.entries()].map(([k,s])=>[k,[...s].sort((a,b)=>a-b)]).sort());
    return dump(this.w.byType)===dump(t.byType) && dump(this.w.childrenOf)===dump(t.childrenOf) && dump(this.w.referrersOf)===dump(t.referrersOf);
  }

  // ---------------------------------------------------------------------------
  // RD-022 DISCONNECT — distinct from timeout. Claims are session state (never
  // persisted; RD-B6.1 pinned that a reload releases them: a reload is a
  // disconnect of EVERY actor). releaseActor is the per-actor version of that
  // same semantic, for a live session that learns one actor is gone.
  // graceTicks > 0 keeps the hold blocking through a short reconnect window
  // instead of releasing instantly: the claim behaves as if re-claimed with
  // ticks=graceTicks at the release tick, except release can only SHORTEN a
  // hold (Math.min) — never lengthen one. Measured (experiments/032_claim_ttl):
  // instant release breaks a transient disconnect's multi-tick action (an
  // interloper takes the entity before the actor returns — exactly the
  // coordination intent the claim exists to protect); TTL-only denies the
  // entity for the full remaining TTL. Grace bounds denial to graceTicks AND
  // keeps a blip invisible. Trusted API (like spawn): invalid input throws.
  releaseActor(actor, { graceTicks = 0 } = {}) {
    if (!Number.isInteger(graceTicks) || graceTicks < 0)
      throw new Error(`releaseActor: graceTicks must be a non-negative integer (got ${String(graceTicks)})`);
    let affected = 0;
    for (const [e, c] of this.claims) {
      if (c.actor !== actor) continue;
      affected++;
      if (graceTicks === 0) this.claims.delete(e);
      else c.until = Math.min(c.until, this.tick + graceTicks);
    }
    return affected;
  }

  // ---------------------------------------------------------------------------
  // SIMULATION SUBSTRATE (phase 0 of the behavior spine — enabling, not an RD).
  // A *system* is a function (readOnlyView) -> ops[]. stepTick() calls every
  // registered system against the SAME committed pre-tick state, gathers each
  // system's ops as ONE transaction (actor "sys:<name>"), appends any player/AI
  // transactions landing this tick, and runs the whole batch through the
  // UNMODIFIED submit() pipeline. Consequences (proven in tick_test.js, not
  // assumed): a system and a player writing one field the same tick resolve by
  // the SAME RD-005 fold/defer rule as two players (Crop #142 at the systems
  // layer); a tick's mutations are ONE RD-020 undo step; RD-017 index staging
  // and RD-003 deterministic scheduling apply unchanged. Systems here are
  // TRUSTED hand-written JS — how UNTRUSTED AI-authored behavior is represented
  // and gated is RD-B1, deliberately not conflated with this loop.
  // ---------------------------------------------------------------------------
  // opts.txPerEntity (RD-M0.1): submit this system's tick output as one tx PER
  // SUBJECT ENTITY instead of one tx for the whole output. Set by installRule
  // (authored rules generate each entity's ops independently — per-entity is
  // their natural atomicity unit; RD-M0 measured the whole-tx coupling: one
  // player claim or one same-tick delete rejected a rule's ENTIRE tick, world-
  // wide). Default OFF: trusted hand-written systems are code and may span
  // entities deliberately.
  registerSystem(name, fn, opts = {}) {
    if (typeof name === 'function') { opts = fn ?? {}; fn = name; name = fn.name || `s${this.systems.length}`; }
    // A system's name IS its actor id, and RD-003 determinism is CROSS-actor:
    // same-actor txs tie-break by input position. Two systems sharing a name
    // would therefore make committed state silently depend on registration
    // order (found by the RD-B2 fuzzer at 20k iterations — 2 name collisions,
    // 2 order-divergences). Make the invalid configuration unrepresentable.
    if (this.systems.some(s => s.name === name)) throw new Error(`system name '${name}' already registered — names are actor identities, one per system`);
    this.systems.push({ name, fn, txPerEntity: !!opts.txPerEntity });
    return this;
  }

  // Read-only world view handed to systems: uuid-in, values-out, no mutators.
  // Reads COMMITTED state only — every system observes the same tick-start
  // snapshot regardless of run order (the double-buffer discipline that makes
  // system output order-independent; scheduling then orders the writes).
  _systemView() {
    const w = this.w;
    return Object.freeze({
      tick: this.tick,
      allOfType: (t) => { const ty = typeof t === 'string' ? w.schema.TYPE_NAME.indexOf(t) : t;
        return [...(w.byType.get(ty) ?? [])].sort((a, b) => a - b).map(e => w.uuid[e]); },
      field:    (uuid, field) => { const e = w.liveEntity(uuid); return e < 0 ? undefined : this._field(e, field); },
      typeOf:   (uuid) => { const e = w.liveEntity(uuid); return e < 0 ? undefined : w.schema.TYPE_NAME[w.type[e]]; },
      nameOf:   (uuid) => { const e = w.liveEntity(uuid); return e < 0 ? undefined : w.name[e]; },
      // RD-025: the declared coordinates of an entity, or null if its type
      // declares none. Reads the SAME pool fields as field() — space is not a
      // privileged engine concept, just two named fields.
      coordsOf: (uuid) => { const e = w.liveEntity(uuid); if (e < 0) return null;
        const sp = w.schema.spatial[w.schema.TYPE_NAME[w.type[e]]];
        return sp ? { x: this._field(e, sp.x), y: this._field(e, sp.y) } : null; },
      parentOf: (uuid) => { const e = w.liveEntity(uuid); if (e < 0) return null;
        const p = w.parent[e]; return p >= 0 ? w.uuid[p] : null; },
      childrenOf: (uuid) => this.childrenOf(uuid).map(e => w.uuid[e]),
    });
  }

  // Advance the world one tick: systems + any same-tick player/AI txs, one batch.
  // --- RD-024 defineType: author the world's VOCABULARY through a gate. ------
  // Same contract as installRule: validate fully, apply atomically, localized
  // {where,code,detail} errors — a rejected definition changes NOTHING. Schema
  // changes are authored content (like rules), not ticked world mutations, so
  // they are not undoable; they persist via save's schemaDefs (RD-B6 pattern).
  defineType(spec) {
    const errs = [];
    const NAME_RE = /^[a-z][a-z0-9_]*$/;
    const RESERVED = new Set(['name', 'orderKey', 'destroyed', 'uuid', 'parent', 'type', 'refs', 'id']);
    const FIELD_BUDGET = 64;   // RD-034 audit (2026-07-17): each pooled field eagerly allocates a
    // capacity-sized typed column at define time, so field count IS an allocation. The 256 TYPE cap
    // bounded one axis; this bounds the other. A single over-the-wire deftype could otherwise request
    // thousands of fields (measured: 3000 fields -> ~11.7 MiB, 20000 accepted) — unbounded memory on
    // accepted input. 64 is far above any real entity (the farm/Pong/shooter types have <=6).
    const s = this.w.schema;
    if (!spec || typeof spec !== 'object') return { ok: false, errors: [{ where: 'type', code: 'bad_spec', detail: 'defineType needs {name, fields}' }] };
    const name = String(spec.name ?? '');
    if (!NAME_RE.test(name)) errs.push({ where: 'type', code: 'bad_name', detail: `'${name}' — lowercase [a-z][a-z0-9_]*` });
    else if (s.TYPE_NAME.includes(name)) errs.push({ where: 'type', code: 'duplicate_type', detail: name });
    if (s.TYPE_NAME.length >= 256) errs.push({ where: 'type', code: 'type_budget', detail: 'Uint8 type array: max 256 types' });
    const fields = spec.fields ?? {};
    if (fields && typeof fields === 'object' && !Array.isArray(fields) && Object.keys(fields).length > FIELD_BUDGET)
      errs.push({ where: 'fields', code: 'field_budget', detail: `${Object.keys(fields).length} fields exceeds the ${FIELD_BUDGET}-per-type cap (each pooled field allocates a capacity-sized column)` });
    if (spec.spatial !== undefined) {                       // RD-025: declare WHICH fields are the coordinates
      const sp = spec.spatial;
      if (!sp || typeof sp !== 'object' || typeof sp.x !== 'string' || typeof sp.y !== 'string')
        errs.push({ where: 'spatial', code: 'bad_spatial', detail: 'spatial must be {x:"<field>", y:"<field>"}' });
      else for (const axis of ['x', 'y']) {
        const f = sp[axis], fs = fields?.[f];
        if (!fs || fs.pool === false)
          errs.push({ where: 'spatial', code: 'bad_spatial', detail: `spatial.${axis} "${f}" is not a pooled field of '${name}'` });
      }
    }
    if (typeof fields !== 'object' || Array.isArray(fields)) errs.push({ where: 'fields', code: 'bad_spec', detail: 'fields must be an object' });
    else for (const [f, fs] of Object.entries(fields)) {
      const where = `fields.${f}`;
      if (!NAME_RE.test(f)) { errs.push({ where, code: 'bad_name', detail: f }); continue; }
      if (RESERVED.has(f)) { errs.push({ where, code: 'reserved_field', detail: `${f} is a universal per-entity field` }); continue; }
      if (!fs || typeof fs !== 'object') { errs.push({ where, code: 'bad_spec', detail: 'field spec must be an object' }); continue; }
      if (fs.pool === false) {
        if (fs.fold !== undefined && !['additive', 'max', 'min', 'label', 'structural'].includes(fs.fold))
          errs.push({ where, code: 'unknown_fold', detail: String(fs.fold) });
        continue;
      }
      const r = fs.range;
      if (!Array.isArray(r) || r.length !== 2 || !Number.isInteger(r[0]) || !Number.isInteger(r[1])) {
        errs.push({ where, code: 'bad_range', detail: 'range must be [intLo, intHi]' }); continue;
      }
      if (r[1] < r[0]) errs.push({ where, code: 'bad_range', detail: `inverted: [${r[0]}, ${r[1]}]` });
      // RD-028: signed ranges are first-class (Int8/16/32 pools). Width is the only limit.
      else if (r[0] < 0) { if (r[0] < -2147483648 || r[1] > 2147483647)
        errs.push({ where, code: 'bad_range', detail: `signed range [${r[0]}, ${r[1]}] exceeds Int32` }); }
      else if (r[1] > 4294967295) errs.push({ where, code: 'bad_range', detail: `hi ${r[1]} > 2^32-1 (Uint32 pool ceiling)` });
      if (fs.fold !== undefined && !['additive', 'max', 'min'].includes(fs.fold))
        errs.push({ where, code: 'unknown_fold', detail: `${fs.fold} — poolable folds: additive|max|min (undeclared = defer)` });
      if (fs.init !== undefined && (!Number.isInteger(fs.init) || fs.init < r[0] || fs.init > r[1]))
        errs.push({ where, code: 'bad_init', detail: `init ${fs.init} outside [${r[0]}, ${r[1]}]` });
    }
    if (errs.length) return { ok: false, errors: errs };
    const t = s.TYPE_NAME.length;
    this.w.schema = makeSchema([...s.defs, { name, fields, ...(spec.spatial ? { spatial: spec.spatial } : {}) }]);  // rebuild — atomic swap
    this.w.pools.push({});
    for (const [f, fs] of Object.entries(this.w.schema.defs[t].fields)) {
      if (fs.pool === false) continue;
      this.w.pools[t][f] = new (poolArrayFor(fs.range))(this.w.capacity);
      this.w[`${name}_${f}`] = this.w.pools[t][f];
    }
    this.w._poolNext.push(0);
    return { ok: true, name, type: t };
  }

  stepTick(extraBatch = []) {
    const view = this._systemView();
    const batch = [];
    for (const s of this.systems) {
      const ops = s.fn(view) ?? [];
      if (!ops.length) continue;
      // RD-M0.1: rules split into one tx per subject entity (op.target, or
      // op.parent for createChild — a spawn's subject is the matched entity it
      // spawns under). PRESERVED DELIBERATELY: if the WHOLE output exceeds the
      // RD-B2 per-tx budget it is submitted unsplit so Layer 0.5 rejects it
      // whole — splitting first would silently void the budget as a bound on a
      // rule's total tick fan-out. Groups keep insertion order (ascending
      // entity index), split txs share the rule's actor id and tie-break by
      // batch position — RD-003 determinism unchanged.
      if (!s.txPerEntity || ops.length > this.opsBudget) {
        batch.push({ actor: `sys:${s.name}`, ops });
        continue;
      }
      const groups = new Map(); // subject uuid -> ops
      for (const op of ops) {
        const k = op.target ?? op.parent ?? '_';
        (groups.get(k) ?? groups.set(k, []).get(k)).push(op);
      }
      for (const g of groups.values()) batch.push({ actor: `sys:${s.name}`, ops: g });
    }
    return this.submit([...batch, ...extraBatch]);
  }

  // ---------------------------------------------------------------------------
  // RD-019.1 TOMBSTONE GC — bound the RD-019 open cost (snapshot size grows with
  // ALL-TIME deletions). A tombstone is safe to drop iff NO live entity still
  // references its uuid — via a `refs[]` edge OR a dangling parent pointer.
  // Corruption-safe because uuids are NEVER recycled (RD-004.6): a reference to a
  // dropped tombstone degrades from `deleted` (with type+lastName) to `missing`,
  // never to a wrong live object. Keeps the metadata exactly as long as something
  // still points at it (when a UI/migration would want it), then reclaims.
  // O(live entities); run periodically, like a save-time compaction.
  // Returns { dropped:[uuid], kept:[uuid] }.
  // ---------------------------------------------------------------------------
  gcTombstones() {
    const w = this.w;
    const referenced = new Set();
    for (let e = 0; e < w.count; e++) {
      if (w.destroyed[e]) continue;
      for (const ru of w.refs[e]) referenced.add(ru);              // live ref-edge to a (maybe dead) uuid
      const p = w.parent[e];
      if (p >= 0 && w.destroyed[p]) referenced.add(w.uuid[p]);      // dangling parent edge to a tombstone
    }
    const dropped = [], kept = [];
    for (const [uuid] of w.tombstones) (referenced.has(uuid) ? kept : dropped).push(uuid);
    for (const u of dropped) w.tombstones.delete(u);
    return { dropped, kept };
  }

  // ---------------------------------------------------------------------------
  // RD-007 AI context: legible columnar text of a RETRIEVED SLICE (BFS radius),
  // not a dump of the whole world. Small ints, schema header, implicit ids.
  // ---------------------------------------------------------------------------
  contextSlice(rootUuid, radius = 1) {
    const w = this.w, root = w.liveEntity(rootUuid);
    if (root < 0) return `# slice: ${rootUuid} is ${w.resolve(rootUuid).status}\n`;
    const seen = new Set([root]); let frontier = [root];
    for (let d = 0; d < radius; d++) {
      const next = [];
      for (const e of frontier) {
        for (const c of (w.childrenOf.get(e) ?? [])) if (!seen.has(c)) { seen.add(c); next.push(c); }
        if (w.parent[e] >= 0 && !seen.has(w.parent[e])) { seen.add(w.parent[e]); next.push(w.parent[e]); }
        for (const r of (w.referrersOf.get(e) ?? [])) if (!seen.has(r)) { seen.add(r); next.push(r); }
      }
      frontier = next;
    }
    const rows = [...seen].filter(e => !w.destroyed[e]).sort((a,b)=>a-b);
    let out = `# slice root=${rootUuid} radius=${radius} n=${rows.length}\n`;
    const cols = w.schema.sliceCols;                 // default schema: water, growth, hp — byte-identical
    out += `id\ttype\tparent\tname\t${cols.join('\t')}\n`;
    for (const e of rows) {
      const r = w.componentIndex[e];
      out += [w.uuid[e], w.schema.TYPE_NAME[w.type[e]], w.parent[e]>=0?w.uuid[w.parent[e]]:'-', w.name[e],
        ...cols.map((f) => { const p = w.pools[w.type[e]][f]; return p ? p[r] : '-'; })].join('\t') + '\n';
    }
    return out;
  }
}

module.exports = { Engine, World, TYPE, TYPE_NAME, foldSemantics, isFoldable, fold, FIELD_OWNER, FIELD_RANGE, NO_ROW, CLAIM_TTL_MAX,
  makeSchema, DEFAULT_SCHEMA_DEFS };
