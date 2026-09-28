// THE V3 ARM = the frozen v2 arm plus exactly two deltas.
//
//   MULTI_MEMBER_LOCALIZED_INSERTION   when the contract needs more than one additive member
//   SAFE_BEHAVIOURAL_REPLACEMENT       when the contract is already structurally satisfied, a
//                                      regression suite exists for the artifact, and a unique
//                                      target span can be located
//
// Both decisions are made by the SYSTEM from the contract plus the frozen source. The preregistered
// strata are NOT consulted at runtime - using the labels to drive the system would make the
// mechanism analysis circular.
//
// Everywhere else v3 delegates to the v2 arm unchanged, which is what makes Prediction C testable:
// on non-treatment goals the two arms run the same code.
import { deriveContract, renderForPrompt } from './contract.mjs';
import { planOperation } from './operation.mjs';
import { checkContract } from './contractCheck.mjs';
import { insertMembers } from './multiInsert.mjs';
import { replaceBehaviour } from './safeReplace.mjs';
import { regressionFor } from './regression.mjs';
import { probeFor } from './probes.mjs';
import { probe60For } from './probes60.mjs';
import { runGoal as runGoalV2 } from './arm.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.GATE_BASE || 'http://127.0.0.1:11434';
const MODEL = process.env.GATE_MODEL || 'qwen2.5-coder:1.5b';
const DECODE = { temperature: 0.7, top_p: 0.8, top_k: 20, repeat_penalty: 1.1, repeat_last_n: 64 };

async function fim(prefix, suffix) {
  const r = await fetch(BASE + '/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: prefix, suffix, stream: false,
      options: Object.assign({}, DECODE, { num_predict: 900 }) }),
    signal: AbortSignal.timeout(600000),
  });
  const j = await r.json();
  return String(j.response || '');
}

const anyProbe = (goal) => probe60For(goal) || probeFor(goal);

// Is a behaviour-changing goal safely localizable? Requires: the contract is already structurally
// satisfied (so the delta is behavioural, not additive), a regression suite exists for the file, and
// exactly one module-level export names a target present in the source.
function behaviouralTarget(contract, ws, plan) {
  if (plan.op !== 'content_edit') return null;
  if (plan.fallbackReason !== 'BEHAVIORAL_DELTA_UNPROVEN') return null;
  if (!regressionFor(contract.lead)) return null;
  if (contract.moduleExports.length !== 1) return null;
  // The planner and the checker can disagree: the planner asks whether a NAME APPEARS in the source,
  // the checker asks whether it is REACHABLE FROM module.exports. Goal 65's tokenize is declared but
  // not exported, so the planner called the contract satisfied while the checker fails it - and with
  // no delta probe for that goal, routing it here could have produced a pass on structure alone.
  // A behavioural replacement is only meaningful when the structural contract ALREADY holds.
  if (!checkContract(ws, contract.lead, contract).ok) return null;
  const name = contract.moduleExports[0];
  const src = existsSync(join(ws, contract.lead)) ? readFileSync(join(ws, contract.lead), 'utf8') : '';
  const decl = contract.lang === 'py'
    ? new RegExp('^def\\s+' + name + '\\s*\\(', 'm')
    : new RegExp('^function\\s+' + name + '\\s*\\(', 'm');
  return decl.test(src) ? name : null;
}

export async function runGoalV3({ ws, goalIndex, goals }) {
  const goalText = goals[goalIndex];
  const c = deriveContract(goalText);
  const plan = planOperation(c, ws, goalText);
  const goal = goalIndex + 1;

  const rec = {
    goal, arm: 'v3', lead: c.lead, operation: plan.op, v3_route: null,
    model_calls: 0, contract_pass: false, behavioral_probe: null, behavioral_pass: null,
    old_regression_before: null, old_regression_after: null, new_delta_pass: null,
    members_requested: 0, members_completed: 0, insertion_steps: [], rollback_triggered: false,
    authorized_span_bytes: 0, outside_span_changed: null,
    failure_kind: null, verified_goal_pass: false, note: '',
  };

  // ---- DELTA 1: more than one additive unit. Members of one owner, OR module-level functions -
  // multiInsert supports both, and the declared delta is "multi-member localized insertion", not
  // "multi-method". Restricting it to add_method would have left goal 80's shape unserved by a
  // capability v3 actually has.
  const multiMethod = plan.op === 'add_method' && plan.members && plan.members.length > 1;
  const missingFns = plan.op === 'content_edit' && plan.fallbackReason === 'MULTI_NAME_ABSENT'
    ? c.moduleExports.filter((n) => {
      const src = existsSync(join(ws, c.lead)) ? readFileSync(join(ws, c.lead), 'utf8') : '';
      const decl = c.lang === 'py' ? new RegExp('^def\\s+' + n + '\\s*\\(', 'm')
        : new RegExp('^function\\s+' + n + '\\s*\\(', 'm');
      return !decl.test(src);
    })
    : [];
  const multiFunction = missingFns.length > 1;

  if (multiMethod || multiFunction) {
    rec.v3_route = 'multi_member_insertion';
    const names = multiMethod ? plan.members.map((m) => m.name) : missingFns;
    rec.members_requested = names.length;
    const out = await insertMembers({
      ws, contract: c, owner: multiMethod ? plan.owner : null,
      op: multiMethod ? 'add_method' : 'add_function',
      members: names,
      fimFn: async (p, s) => { rec.model_calls++; return fim(p, s); },
    });
    rec.insertion_steps = out.steps.map((s) => ({
      member: s.member, baseline_bytes: s.baseline_bytes, fim_output_bytes: s.fim_output_bytes,
      deleted_bytes: s.deleted_bytes, outside_span_changed: s.outside_span_changed,
      ok: !!s.ok, failed: s.failed || null,
    }));
    rec.members_completed = out.steps.filter((s) => s.ok).length;
    rec.rollback_triggered = !!out.rolled_back;
    rec.contract_pass = !!out.ok;
    if (!out.ok) { rec.failure_kind = 'multi_member: ' + String(out.why).slice(0, 80); rec.note = String(out.why).slice(0, 140); }
    const probe = anyProbe(goal);
    if (probe) {
      rec.behavioral_probe = probe.id;
      try { const pr = probe.run(ws); rec.behavioral_pass = pr.pass; if (!pr.pass) rec.note += ' | probe: ' + String(pr.why).slice(0, 80); }
      catch (e) { rec.behavioral_pass = false; }
    }
    rec.verified_goal_pass = rec.contract_pass && (rec.behavioral_pass === null || rec.behavioral_pass === true);
    return rec;
  }

  // ---- DELTA 2: a behaviour change the system can localize to one proven span.
  const target = behaviouralTarget(c, ws, plan);
  if (target) {
    rec.v3_route = 'safe_behavioural_replacement';
    const probe = anyProbe(goal);
    rec.behavioral_probe = probe ? probe.id : null;
    const out = await replaceBehaviour({
      ws, contract: c, target,
      fimFn: async (p, s) => { rec.model_calls++; return fim(p, s); },
      deltaProbe: probe,
    });
    rec.old_regression_before = out.baseline_regression;
    rec.old_regression_after = out.regression_after;
    rec.new_delta_pass = out.delta_after;
    rec.authorized_span_bytes = out.span_bytes;
    rec.outside_span_changed = out.outside_span_changed;
    rec.rollback_triggered = !!out.rolled_back;
    rec.contract_pass = !!out.contract_after;
    rec.behavioral_pass = out.delta_after;
    if (!out.ok) { rec.failure_kind = 'safe_replace'; rec.note = String(out.why).slice(0, 150); }
    // A behavioural goal cannot pass on structure alone.
    rec.verified_goal_pass = !!out.ok;
    return rec;
  }

  // ---- Everywhere else: the frozen v2 arm, unchanged.
  rec.v3_route = 'delegated_to_v2';
  const v2 = await runGoalV2({ arm: 'v2', ws, goalIndex, goals });
  const probe = anyProbe(goal);
  let behavioral = v2.behavioral_pass;
  if (probe && behavioral === null) {
    try { const pr = probe.run(ws); behavioral = pr.pass; } catch (e) { behavioral = false; }
  }
  return {
    ...rec,
    operation: v2.operation, model_calls: v2.model_calls,
    contract_pass: v2.contract_pass, behavioral_probe: probe ? probe.id : null,
    behavioral_pass: behavioral, failure_kind: v2.failure_kind, note: v2.note,
    verified_goal_pass: v2.contract_pass && (behavioral === null || behavioral === true),
  };
}
