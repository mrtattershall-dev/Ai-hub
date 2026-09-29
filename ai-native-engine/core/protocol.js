'use strict';
// =============================================================================
// AI↔ENGINE PROTOCOL (spine decision #4) — the wire a model actually emits.
// =============================================================================
// The core (engine.js) exposes submit(batch) as an IN-PROCESS protocol for
// trusted callers. A MODEL is not a trusted caller: it emits text that may be
// malformed JSON, name fields that don't exist, target UUIDs it hallucinated,
// or push values out of range. The whole project's thesis (RD-014: "agents
// propose, a deterministic gate disposes") lives or dies at THIS boundary.
//
// This module is the STRUCTURED-IR design that won experiment 018 (see
// protocol_test.js): the model emits a typed op list + optional structured
// postcondition ASSERTS; a pure validator turns it into either a safe batch
// for engine.submit(), or a LOCALIZED, repairable error list (op index + code +
// detail) that can be fed straight back into a re-prompt. Nothing reaches the
// engine until it validates. Zero deps.
//
// A proposal (what the model emits, as JSON text):
//   { "actor": "ai",
//     "ops": [
//       {"op":"setfield","target":"u3","field":"water","value":80},
//       {"op":"delete","target":"u5"},
//       {"op":"createChild","childType":"crop","parent":"u0","props":{"name":"x"}},
//       {"op":"reparent","target":"u2","parent":"u0"},
//       {"op":"claim","target":"u3","ticks":3}
//     ],
//     "asserts": [ {"target":"u3","field":"water","cmp":"<=","value":80} ] }
// =============================================================================

const { TYPE, TYPE_NAME, CLAIM_TTL_MAX } = require('./engine.js');

// declared writable fields, their owning type, and hard ranges (typed-array
// widths from RD-006/008). The validator rejects anything not in here — an
// undeclared field is a model error, not a silent no-op.
const FIELD_SPEC = {
  water:  { type: 'crop',  num: true, min: 0, max: 255 },
  growth: { type: 'crop',  num: true, min: 0, max: 255 },
  hp:     { type: 'enemy', num: true, min: 0, max: 65535 },
  tally:  { type: 'zone',  num: true, min: 0, max: 4294967295 },
  name:   { type: '*',     num: false },
};
// RD-024: per-world vocabulary — parseProposal swaps these bindings from the
// engine's schema at entry (synchronous, single-threaded; the farm tables
// above are the boot value and stay exported for back-compat).
const specFor = (schema) => ({
  byType: Object.fromEntries(schema.defs.map((d) => [d.name,
    Object.fromEntries(Object.entries(d.fields).filter(([, sp]) => sp.pool !== false)
      .map(([f, sp]) => [f, { type: d.name, num: true, min: sp.range[0], max: sp.range[1] }]))])),
  ownerOf: (f) => schema.defs.find((d) => d.fields[f] && d.fields[f].pool !== false)?.name,
});
let SPEC = null, TYPES = TYPE_NAME, TYPEIDX = TYPE;   // set by parseProposal from the world's schema
const VERBS = new Set(['setfield', 'delete', 'reparent', 'createChild', 'claim', 'move']);
const CMP = { '<=': (a,b)=>a<=b, '>=': (a,b)=>a>=b, '<': (a,b)=>a<b, '>': (a,b)=>a>b, '==': (a,b)=>a===b, '!=': (a,b)=>a!==b };

const err = (opIndex, code, detail) => ({ opIndex, code, detail });

// Compile the proposal's structured asserts into an RD-014 goal contract: a
// deterministic predicate over the engine's previewed post-state. The model
// STATES its intended postcondition; the gate ENFORCES it. Machine-checkable by
// construction — no natural-language goal parsing, no model in the loop.
function compileContract(asserts) {
  if (!asserts || !asserts.length) return undefined;
  return (preview) => {
    for (const a of asserts) {
      if (a.field === 'destroyed') {
        if (preview.destroyed(a.target) !== !!a.value) return `assert failed: ${a.target}.destroyed != ${a.value}`;
        continue;
      }
      const v = preview.field(a.target, a.field);
      const cmp = CMP[a.cmp];
      if (!cmp) return `assert has unknown comparator ${a.cmp}`;
      if (v === undefined) return `assert references unreadable ${a.target}.${a.field}`;
      if (!cmp(v, a.value)) return `assert failed: ${a.target}.${a.field} (${v}) not ${a.cmp} ${a.value}`;
    }
    return true;
  };
}

// The one entry point. PURE: never mutates the engine. Returns a batch ready
// for engine.submit(), or a structured error list. `engine` is read for target
// resolution + type/field matching only.
function parseProposal(engine, text) {
  SPEC = specFor(engine.w.schema); TYPES = engine.w.schema.TYPE_NAME; TYPEIDX = engine.w.schema.TYPE;  // RD-024
  // 1. shape: it must be JSON at all.
  let doc;
  try { doc = JSON.parse(text); }
  catch (e) { return { ok: false, errors: [err(-1, 'not_json', String(e.message))] }; }
  const SHAPE = 'expected shape: {"actor":"ai","ops":[{"op":"setfield","target":"<uuid>","field":"water","value":80}]}';
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc))
    return { ok: false, errors: [err(-1, 'not_object', `top level must be a JSON object. ${SHAPE}`)] };
  // Common weak-model mistake: emitting a bare op object instead of wrapping it.
  if (!Array.isArray(doc.ops)) {
    const looksLikeBareOp = typeof doc.op === 'string';
    return { ok: false, errors: [err(-1, 'no_ops',
      looksLikeBareOp
        ? `you emitted a single bare op; it must go inside an "ops" array. ${SHAPE}`
        : `missing "ops" array. ${SHAPE}`)] };
  }
  const actor = typeof doc.actor === 'string' && doc.actor ? doc.actor : 'ai';

  const w = engine.w;
  const outOps = [];
  const errors = [];

  doc.ops.forEach((raw, i) => {
    if (raw === null || typeof raw !== 'object') { errors.push(err(i, 'op_not_object', 'op must be an object')); return; }
    const verb = raw.op;
    if (!VERBS.has(verb)) { errors.push(err(i, 'unknown_verb', `"${verb}" is not one of ${[...VERBS].join('|')}`)); return; }

    // createChild: target is NEW, so no live-resolve; validate type + parent.
    if (verb === 'createChild') {
      const t = TYPEIDX[String(raw.childType || '').toUpperCase()];
      if (t === undefined) { errors.push(err(i, 'unknown_type', `childType "${raw.childType}" unknown`)); return; }
      if (raw.parent != null && engine.w.liveEntity(raw.parent) < 0) { errors.push(err(i, 'unknown_parent', `parent "${raw.parent}" not live`)); return; }
      outOps.push({ kind: 'createChild', type: t, parent: raw.parent ?? null, props: (raw.props && typeof raw.props === 'object') ? raw.props : {} });
      return;
    }

    // every other verb targets an existing object -> must resolve LIVE (RD-004.6)
    if (typeof raw.target !== 'string') { errors.push(err(i, 'bad_target', 'target must be a uuid string')); return; }
    const e = w.liveEntity(raw.target);
    if (e < 0) {
      const r = w.resolve(raw.target);
      errors.push(err(i, 'unknown_target', `target "${raw.target}" is ${r.status}`)); // deleted vs missing surfaced
      return;
    }

    if (verb === 'delete') { outOps.push({ kind: 'delete', target: raw.target }); return; }

    if (verb === 'claim') {
      // RD-022: an invalid TTL is REJECTED with a localized code, never
      // silently rewritten (pre-fix, ticks:0/NaN quietly became 3 — a silent
      // semantic change; RD-018's discipline is a repairable error instead).
      // Absent ticks -> documented default 3. The engine validate layer is the
      // backstop for in-process callers that skip this wire (RD-018 split).
      if (raw.ticks !== undefined && (!Number.isInteger(raw.ticks) || raw.ticks < 1)) {
        errors.push(err(i, 'claim_ticks_invalid',
          `claim "ticks" must be a positive integer (got ${JSON.stringify(raw.ticks)}); omit it for the default 3`));
        return;
      }
      const cap = engine.claimTtlMax ?? CLAIM_TTL_MAX;
      if (raw.ticks !== undefined && raw.ticks > cap) {
        errors.push(err(i, 'claim_ttl_cap',
          `claim ticks ${raw.ticks} exceeds the TTL cap ${cap}; hold longer by RENEWING — re-claim (<= ${cap} ticks) each tick while you still hold it`));
        return;
      }
      outOps.push({ kind: 'claim', target: raw.target, ticks: raw.ticks ?? 3 });
      return;
    }

    if (verb === 'move') {   // RD-005.3 reorder among siblings; after=null => front
      if (raw.after != null && raw.after !== null) {
        if (typeof raw.after !== 'string') { errors.push(err(i, 'bad_after', 'move "after" must be a sibling uuid or null')); return; }
        if (w.liveEntity(raw.after) < 0) { errors.push(err(i, 'unknown_after', `"after" ${raw.after} not live`)); return; }
      }
      outOps.push({ kind: 'move', target: raw.target, after: raw.after ?? null });
      return;
    }

    if (verb === 'reparent') {
      if (typeof raw.parent !== 'string') { errors.push(err(i, 'bad_parent', 'reparent needs a uuid "parent"')); return; }
      if (w.liveEntity(raw.parent) < 0) { errors.push(err(i, 'unknown_parent', `parent "${raw.parent}" not live`)); return; }
      outOps.push({ kind: 'reparent', target: raw.target, parent: raw.parent });
      return;
    }

    if (verb === 'setfield') {
      const ownerType = TYPES[w.type[e]];
      const spec = raw.field === 'name' ? { type: '*', num: false } : SPEC.byType[ownerType]?.[raw.field];
      if (!spec) {                                          // RD-024 per-type namespace
        const owner = SPEC.ownerOf(raw.field);
        errors.push(owner
          ? err(i, 'field_type_mismatch', `field "${raw.field}" belongs to ${owner}, target is ${ownerType}`)
          : err(i, 'unknown_field', `field "${raw.field}" is not writable`));
        return;
      }
      if (spec.num) {
        if (typeof raw.value !== 'number' || !Number.isFinite(raw.value)) { errors.push(err(i, 'value_not_number', `"${raw.field}" needs a numeric value`)); return; }
        if (raw.value < spec.min || raw.value > spec.max) { errors.push(err(i, 'value_out_of_range', `"${raw.field}"=${raw.value} outside [${spec.min},${spec.max}]`)); return; }
      } else if (typeof raw.value !== 'string') { errors.push(err(i, 'value_not_string', `"${raw.field}" needs a string value`)); return; }
      outOps.push({ kind: 'setfield', target: raw.target, field: raw.field, value: raw.value });
      return;
    }
  });

  if (errors.length) return { ok: false, errors };
  const tx = { actor, ops: outOps };
  const contract = compileContract(doc.asserts);
  if (contract) tx.contract = contract;
  return { ok: true, batch: [tx] };
}

// Convenience: validate + submit in one call. Returns the parse errors OR the
// engine result. Still atomic — a parse failure never touches the engine.
function apply(engine, text) {
  const p = parseProposal(engine, text);
  if (!p.ok) return { accepted: false, phase: 'protocol', errors: p.errors };
  const res = engine.submit(p.batch);
  return { accepted: true, phase: 'engine', result: res };
}

module.exports = { parseProposal, apply, compileContract, FIELD_SPEC, VERBS };
