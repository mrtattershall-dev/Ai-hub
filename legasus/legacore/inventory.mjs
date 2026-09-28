// GATE 1 — a MACHINE-READABLE inventory of what LegaCore claims to support.
//
// The parts that can be derived from evidence are derived, not asserted. Which constraint kinds
// actually fire, on which families, and whether a positive or negative control exists for each are
// all read from the sealed families and their EXPECTED.json files. Hand-written standing (prospective
// versus development) is marked as such so the two are never confused.
//
// This gate changes no architecture. It produces the inventory and stops.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { constrain } from './constraints3.mjs';
import { buildContext } from './opcontext.mjs';
import { reconstruct, baseFor } from '../legalabs/substrate/narrowability.mjs';

const NL = String.fromCharCode(10);
const ROOT = 'C:/Users/tatte/Projects/ai-coding-hub-indent/legasus/legalabs/substrate/';
const FAMS = ['provenance', 'generalization', 'requirements', 'unresolved'];

// DECLARED standing, written by hand and labelled, because "which family was this rule designed
// against" is a fact about history that no amount of running code can recover.
const DECLARED = {
  ownership_boundary: {
    layer: 'LegaCore', supported: true,
    prospective: 'generalization family (g01 positive, g02 negative), both halves passed',
    development: 'provenance family, 23 of 26 operations',
    gaps: ['sound only RELATIVE to a correct parentRange, which it trusts as an input'],
  },
  control_flow_boundary: {
    layer: 'LegaCore', supported: true,
    prospective: 'generalization family (g03 positive, g04 negative), both halves passed',
    development: 'provenance family, 3 of 26 operations',
    gaps: ['under-narrows on magnitude: g03 op1 recovered 0.58 of 1.58 bits',
      'the residual on g03 op1 is GUARD PRECEDENCE, which is semantic intent and NOT this rule'],
  },
  symbol_availability: {
    layer: 'LegaCore', supported: true,
    prospective: 'requirements family, five case types passed (h01 h02 h03 h04 h05 h06)',
    development: 'generalization family g05; revision 2 fixed an off-by-one and a missing direction',
    gaps: ['providers reachable only through an import are UNRESOLVED by design'],
  },
  deferred_requirement: {
    layer: 'LegaCore', supported: true,
    prospective: 'requirements family h02 and h04, fired on 0 operations - correct silence',
    development: 'opfacts synthetic witnesses',
    gaps: [],
  },
  unresolved_requirement: {
    layer: 'LegaCore', supported: true,
    prospective: 'unresolved family i01 vs i02, surgical pair - the path fired for the right reason',
    development: 'requirements family h07, where the control was MASKED and proved nothing',
    gaps: ['DECLARES the gap; does not resolve it. This is intentional.'],
  },
  canonical_realization: {
    layer: 'ENGINEERING_CHOICE', supported: true,
    prospective: 'fired on 17 operations in the requirements family and narrowed 0',
    development: 'all families',
    gaps: ['contributes zero semantic gain BY CONSTRUCTION; its replay fails if it ever narrows'],
  },
};

const SEMANTIC_INTENT = {
  guard_precedence: {
    layer: 'SEMANTIC_INTENT', supported: false,
    why: 'when two individually valid behaviours overlap, structure cannot determine which owns the '
      + 'ambiguous input. classify(0) matches both `n == 0` and `n < 10`.',
    evidence: 'generalization family g03 op1: 1.00 bit of available narrowing that no structural rule '
      + 'may claim',
    do_not: 'do not approximate this with a control-flow or placement rule',
  },
};

// ---- derive: which kinds fire, and which controls exist
// EMITTED versus NARROWED are different facts and the first version of this inventory conflated them.
// `deferred_requirement`, `unresolved_requirement` and `canonical_realization` NEVER narrow - that is
// their whole purpose - so counting only narrowing reported all three as never having fired, which
// reads as "untested" when it is actually "working as designed". An inventory that cannot represent a
// zero-narrowing rule would have hidden exactly the components whose correctness IS their silence.
const emitted = new Map();        // kind -> { family -> { task -> count } }   appeared in the chain
const narrowed = new Map();       // kind -> { family -> { task -> count } }   actually removed something
const controls = new Map();       // kind -> { POSITIVE: [...], NEGATIVE: [...], other: [...] }
const into = (map, kind, fam, task) => {
  if (!map.has(kind)) map.set(kind, {});
  const f = map.get(kind);
  f[fam] = f[fam] || {};
  f[fam][task] = (f[fam][task] || 0) + 1;
};
const bump = (kind, fam, task) => into(emitted, kind, fam, task);

for (const fam of FAMS) {
  const dir = ROOT + fam;
  if (!existsSync(join(dir, 'GROUNDTRUTH.json'))) continue;
  const GT = JSON.parse(readFileSync(join(dir, 'GROUNDTRUTH.json'), 'utf8'));
  const EXP = existsSync(join(dir, 'EXPECTED.json'))
    ? JSON.parse(readFileSync(join(dir, 'EXPECTED.json'), 'utf8')) : { tasks: [] };
  for (const spec of (EXP.tasks || [])) {
    if (!spec.kind) continue;
    if (!controls.has(spec.kind)) controls.set(spec.kind, { POSITIVE: [], NEGATIVE: [], other: [] });
    const slot = controls.get(spec.kind)[spec.half] ? spec.half
      : (spec.half === 'POSITIVE' || spec.half === 'NEGATIVE') ? spec.half : 'other';
    controls.get(spec.kind)[slot].push(fam + '/' + spec.id + (spec.case ? ' [' + spec.case + ']' : ''));
  }
  for (const t of GT) {
    const tdir = join(dir, t.task);
    if (!existsSync(join(tdir, 'task.json'))) continue;
    const recon = reconstruct(tdir);
    for (let k = 0; k < t.rows.length; k++) {
      const row = t.rows[k];
      if (row.intra_line || row.error || !row.candidate_positions) continue;
      const base = baseFor(recon, k);
      if (base === null) continue;
      const ctx = buildContext(recon, k, base, row, t.task);
      const res = constrain(ctx, row.candidate_positions);
      for (const c of res.chain) {
        into(emitted, c.kind, fam, t.task);
        if ((c.removed_positions || []).length) into(narrowed, c.kind, fam, t.task);
      }
      // requirement states exercised
      for (const r of res.requirement_resolution.resolved) bump('state:' + r.provider, fam, t.task);
      for (const r of res.requirement_resolution.unresolved) bump('state:unresolved', fam, t.task);
      if (ctx.facts.requires_deferred.length) bump('state:deferred', fam, t.task);
    }
  }
}

const SYNTHETIC = {
  ownership_boundary: [], control_flow_boundary: [],
  symbol_availability: ['legasus/legacore/opfacts.test.mjs'],
  deferred_requirement: ['legasus/legacore/opfacts.test.mjs'],
  unresolved_requirement: ['legasus/legacore/completeness.test.mjs'],
  canonical_realization: [],
};

const inventory = { generated_for: 'GATE 1', semantic_classes: {}, requirement_states: {},
  semantic_intent: SEMANTIC_INTENT,
  note: 'Fired-on counts are DERIVED by running the frozen deriver over every sealed family. Standing '
    + 'lines are DECLARED, because which family a rule was designed against is history that running '
    + 'code cannot recover.' };

for (const [kind, d] of Object.entries(DECLARED)) {
  const c = controls.get(kind) || { POSITIVE: [], NEGATIVE: [], other: [] };
  inventory.semantic_classes[kind] = {
    ...d,
    synthetic_witnesses: SYNTHETIC[kind] || [],
    positive_control: c.POSITIVE,
    negative_control: c.NEGATIVE,
    other_controls: c.other,
    emitted_on: emitted.get(kind) || {},
    narrowed_on: narrowed.get(kind) || {},
    has_positive_control: c.POSITIVE.length > 0,
    has_negative_control: c.NEGATIVE.length > 0,
    ever_emitted: !!emitted.get(kind),
    // A rule whose correctness IS its silence must never be judged by whether it narrowed.
    narrowing_expected: !['deferred_requirement', 'unresolved_requirement',
      'canonical_realization'].includes(kind),
  };
}
for (const key of ['state:existing_definition', 'state:planned_operation', 'state:deferred',
  'state:unresolved']) {
  inventory.requirement_states[key.replace('state:', '')] = { exercised_on: emitted.get(key) || {} };
}

console.log(JSON.stringify(inventory, null, 1));
