// FROZEN STRATIFICATION AND ANALYSIS PLAN FOR GOALS 61-80.
//
// Derived ONLY from goal text, the frozen canonical post-60 world (e76e14c), the v2/v3 planners and
// the behavioural oracle definitions. NO model output exists for these goals or was consulted.
//
// Strata are NOT maximised toward the v3-treatment lanes. Where static analysis cannot PROVE a
// unique safe span, the goal is UNSUPPORTED. A false-negative costs measured coverage; a
// false-positive would credit v3 for a lane it cannot actually serve.
import { deriveContract } from './contract.mjs';
import { planOperation } from './operation.mjs';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const GOALS_PATH = 'C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json';
const GOALS = JSON.parse(readFileSync(GOALS_PATH, 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');

const ws = mkdtempSync(join(tmpdir(), 'st6180-'));
writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
const world = new Map();
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) { world.set(f, readFileSync(p)); copyFileSync(p, join(ws, f)); }
  }
}
const bundle = createHash('sha256');
for (const f of [...world.keys()].sort()) bundle.update(f).update('\0').update(world.get(f));
const seed60Sha = bundle.digest('hex');

// Hand-audited classifications, each with the evidence that produced it. Everything here is derived
// from goal text plus the frozen source - never from model behaviour.
const AUDIT = {
  61: { stratum: 'UNSUPPORTED', why: 'MULTI_SITE_BEHAVIORAL: the limit must be enforced in BOTH checkout and placeHold, so no single span contains the delta' },
  62: { stratum: 'V2_ALREADY_HANDLES' },
  63: { stratum: 'V2_ALREADY_HANDLES' },
  64: { stratum: 'SINGLE_SPAN_BEHAVIORAL_ELIGIBLE', why: 'confinement PROVEN by construction: a 1311B body spliced into the 954B to_html span delivers ordered lists and keeps every prior behaviour', probe: 'confineAudit goal64' },
  65: { stratum: 'UNSUPPORTED', why: 'MULTI_SITE_BEHAVIORAL: tokenize must change shape AND be added to module.exports, and evaluate consumes its current format - three sites' },
  66: { stratum: 'V2_ALREADY_HANDLES' },
  67: { stratum: 'UNSUPPORTED', why: 'MULTI_SITE_BEHAVIORAL: onEvict must fire from the constructor option plus the lru, expired and deleted paths' },
  68: { stratum: 'V2_ALREADY_HANDLES' },
  69: { stratum: 'UNSUPPORTED', why: 'NONLOCAL_EDIT: DOM/multi-artifact, and no structural contract is derivable' },
  70: { stratum: 'V2_ALREADY_HANDLES' },
  71: { stratum: 'MULTI_MEMBER_ELIGIBLE', why: 'two additive members on one existing owner: Library.toJSON (instance) and Library.fromJSON (static)' },
  72: { stratum: 'V2_ALREADY_HANDLES' },
  73: { stratum: 'V2_ALREADY_HANDLES' },
  74: { stratum: 'SINGLE_SPAN_BEHAVIORAL_ELIGIBLE', why: 'confinement PROVEN by construction: a 1479B body spliced into the 954B to_html span delivers fenced code blocks and keeps every prior behaviour', probe: 'confineAudit goal74' },
  75: { stratum: 'V2_ALREADY_HANDLES' },
  76: { stratum: 'V2_ALREADY_HANDLES' },
  77: { stratum: 'V2_ALREADY_HANDLES', note: "reason 'lru' is only observable with goal 67's onEvict, which is held out; Cache.resize alone satisfies the contract" },
  78: { stratum: 'V2_ALREADY_HANDLES' },
  79: { stratum: 'UNSUPPORTED', why: 'NONLOCAL_EDIT: DOM/multi-artifact filter across html and js' },
  80: { stratum: 'MULTI_MEMBER_ELIGIBLE', why: 'two additive module-level functions: snapshot and restore',
        blocked: 'HARD DEPENDENCY on goal 71 - snapshot calls library.toJSON() and restore calls Library.fromJSON, neither of which exists in the post-60 world. Under per-goal isolation this goal is UNACHIEVABLE BY EITHER ARM.' },
};

const rows = [];
for (let g = 61; g <= 80; g++) {
  const c = deriveContract(GOALS[g - 1]);
  const plan = planOperation(c, ws, GOALS[g - 1]);
  const a = AUDIT[g];
  const leadPath = join(ws, c.lead);
  rows.push({
    goal: g,
    lead: c.lead,
    stratum: a.stratum,
    rationale: a.why || null,
    note: a.note || null,
    blocked: a.blocked || null,
    v2_route: plan.op,
    v3_route: a.stratum === 'MULTI_MEMBER_ELIGIBLE' ? 'multi_member_insertion'
      : a.stratum === 'SINGLE_SPAN_BEHAVIORAL_ELIGIBLE' ? 'safe_behavioural_replacement'
        : plan.op,
    v2_fallback_reason: plan.fallbackReason || null,
    owner: plan.owner || null,
    members: plan.members ? plan.members.map((m) => ({ name: m.name, kind: m.kind })) : (plan.fn ? [{ name: plan.fn, kind: 'module_function' }] : []),
    oracle: a.stratum === 'SINGLE_SPAN_BEHAVIORAL_ELIGIBLE' ? 'STRUCTURAL_PLUS_OLD_REGRESSION_PLUS_DELTA' : 'STRUCTURAL',
    confinement_probe: a.probe || null,
    structural_contract: { moduleExports: c.moduleExports, members: c.members, domIds: c.domIds, domClasses: c.domClasses },
    localization_preconditions: {
      predecessor_source_sha256: statSync(leadPath).isFile() ? sha(readFileSync(leadPath)) : null,
      lead_exists: true,
    },
    new_dependencies_authorized: false,
  });
}

const counts = rows.reduce((a, r) => { a[r.stratum] = (a[r.stratum] || 0) + 1; return a; }, {});

const doc = {
  provenance: {
    created_at: new Date().toISOString(),
    v2_commit: '68ab72c', v3_commit: '4be486d', seed60_commit: 'e76e14c',
    seed60_bundle_sha: seed60Sha,
    goal_set_sha: sha(readFileSync(GOALS_PATH)),
    planner_sha: sha(readFileSync(join(HERE, 'operation.mjs'))),
    multiInsert_sha: sha(readFileSync(join(HERE, 'multiInsert.mjs'))),
    safeReplace_sha: sha(readFileSync(join(HERE, 'safeReplace.mjs'))),
    regression_sha: sha(readFileSync(join(HERE, 'regression.mjs'))),
    model_output_consulted: false,
  },
  primary_outcome: {
    VERIFIED_GOAL_PASS: 'structural obligations pass AND all applicable behavioural regressions pass '
      + 'AND the requested behavioural delta passes. For structural-only goals the behavioural terms '
      + 'do not apply; for behavioural goals structural success alone CANNOT produce a pass.',
  },
  predictions: {
    A: 'v3 outperforms v2 specifically on MULTI_MEMBER_ELIGIBLE goals, because v2 inserts only the '
      + 'first required member while v3 performs stateful sequential insertion.',
    B: 'v3 outperforms v2 specifically on SINGLE_SPAN_BEHAVIORAL_ELIGIBLE goals, because v3 can alter '
      + 'the authorized semantic span while requiring BOTH the old regression suite and the new delta '
      + 'to pass.',
    C: 'V2_ALREADY_HANDLES and UNSUPPORTED show little or no systematic v3 advantage, because v3 '
      + 'intentionally changes neither mechanism there.',
    falsification: 'If v3 wins overall but its rescues are NOT concentrated in the A/B strata, the '
      + 'architectural mechanism is NOT established. An aggregate improvement alone does not confirm '
      + 'the hypothesis.',
  },
  power_warning: {
    treatment_goals: (counts.MULTI_MEMBER_ELIGIBLE || 0) + (counts.SINGLE_SPAN_BEHAVIORAL_ELIGIBLE || 0),
    detail: 'Only 4 of 20 goals fall in a v3-treatment stratum, and goal 80 is UNACHIEVABLE BY EITHER '
      + 'ARM under per-goal isolation because it depends on goal 71. Prediction A therefore rests on '
      + 'ONE informative goal (71) and Prediction B on TWO (64, 74). This range cannot produce a '
      + 'statistically meaningful test of either; at best it can show the mechanism operating or '
      + 'failing. That limitation is recorded BEFORE the run and must not be reinterpreted after it.',
  },
  counts,
  goals: rows,
};

const body = JSON.stringify(doc, null, 2);
writeFileSync(join(HERE, 'goal-strata-61-80.json'), body, 'utf8');

console.log('  ' + JSON.stringify(counts));
console.log('  seed60_bundle_sha ' + seed60Sha.slice(0, 24));
console.log('  strata_sha        ' + sha(body).slice(0, 24));
console.log('');
for (const r of rows) {
  console.log('  [' + r.goal + '] ' + r.stratum.padEnd(34) + ' v2:' + String(r.v2_route).padEnd(14)
    + ' v3:' + String(r.v3_route).padEnd(30) + (r.blocked ? '  BLOCKED' : ''));
}
