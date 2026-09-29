'use strict';
// =============================================================================
// RULES ADAPTER — wraps the DECIDED RD-B1 winner (core/behavior.js declarative
// rules) as an adapter, so the independently-calibrated harness can score the
// ACTUAL representation the project chose. This is a cross-check, not a rival:
// the goal is an independent admissibility verdict from a referee whose own
// trustworthiness is proven (harness_test.js), on a decision that was reached
// with a different (self-admittedly initially-buggy) harness.
//
// execMode 'inproc': rules are TOTAL and TERMINATING by construction (one pass
// over matched entities, total arithmetic) — the RD-B1 claim. So the harness
// holds them to the inproc bar: they must self-bound (here, by STATICALLY
// REJECTING anything unbounded at compile), never lean on the hard kill.
// =============================================================================

const { parseRule } = require('../../core/behavior.js');

// A stub engine sufficient for STATIC validation of the corpus behaviors, which
// scope by type/field only (no match.uuid, no reparent.to — those would need a
// live world). `capacity` fixes the `count` aggregation interval; 256 matches the
// tick_test.js world. compile() never runs the rule, so no real world is needed.
const stubEngine = () => ({ w: { capacity: 256, resolve: () => ({ status: 'missing' }), type: [], byUuid: new Map() } });

module.exports = {
  name: 'RB1-rules',
  execMode: 'inproc',
  sourceKey: 'rules',

  compile(source) {
    const r = parseRule(stubEngine(), source);
    if (r.ok) return { ok: true, behavior: { name: r.name, fn: r.fn } };
    // core/behavior errors are { rule, where, code, detail } -> the seam's { at, code, detail }
    return { ok: false, errors: r.errors.map(e => ({ at: e.where ?? e.rule ?? 'rule', code: e.code, detail: e.detail ?? e.code })) };
  },

  run(behavior, view) { return { ops: behavior.fn(view) }; },

  // rules declare scope structurally (match.type + effect fields); a full derivation
  // is RD-B2's job. The referee scores SAFE from the ACTUAL run, so this is only the
  // seam's declaration surface.
  declaredScope() { return { reads: ['*'], writes: ['*'], spawns: ['*'], deletes: true }; },
};
