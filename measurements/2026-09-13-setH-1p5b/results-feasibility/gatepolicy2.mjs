// EXPERIMENT GATE-POLICY: does transaction-aware graded authority beat hard per-step refusal?
//
// A SEPARATE RESEARCH QUESTION from the 1.5B capability programme, and deliberately run on a different
// substrate. This asks whether LegaGate's AUTHORITY POLICY is right, which requires a model that produces
// BOTH viable and doomed chains - otherwise "verified chains destroyed" and "verified among admitted"
// have no sensitivity, exactly as happened on B4 where every chain was doomed.
//
// Using the 7B here is NOT a claim that 7B beats 1.5B, and nothing here licenses "LegaGate works for
// 1.5B". It is an experimental substrate with nonzero endpoint variance. If the same policy later holds
// at 1.5B, LegaGate becomes a model-independent systems component rather than scaffolding built around
// one tiny model - which is the stronger claim, and it needs both runs.
//
// TWO POLICIES, ONE RUN. Shadow records are policy-independent, so both are simulated on identical
// trajectories. No second inference pass, no cross-arm sampling noise, and "steps avoided" is computable
// because we know where each policy would have stopped.
//
//   HARD_VETO         any REFUSE from the frozen gate is terminal          (the policy B4 falsified)
//   FROZEN_BUDGET_2   graded risk, cumulative cost, budget 2               (frozen BEFORE this run)
//
// budget=2 was chosen by reading B4, so it is a HYPOTHESIS here and this run is its prospective test.
// No sweep is performed for the primary analysis.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { riskOf } from './policy.mjs';

const COST = { low: 0, moderate: 1, high: 2, unsafe: Infinity };
const BUDGET = 2;   // FROZEN. Not swept in this analysis.

function hardVeto(steps) {
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].gate_verdict === 'REFUSE') return { killedAt: i + 1 };
  }
  return { killedAt: null };
}
function gradedBudget(steps, budget) {
  let spent = 0;
  for (let i = 0; i < steps.length; i++) {
    const c = COST[riskOf(steps[i].gate_reasons)];
    if (c === Infinity) return { killedAt: i + 1 };
    spent += c;
    if (spent > budget) return { killedAt: i + 1 };
  }
  return { killedAt: null };
}

const chains = [];
for (const spec of process.argv.slice(2)) {
  const [label, dir] = spec.split('=');
  let rows;
  try { rows = JSON.parse(readFileSync(join(dir, 'rows.json'), 'utf8')); } catch (e) { continue; }
  for (const r of rows.filter((x) => x.condition === 'B_oracle_localized_insertion')) {
    if (!r.steps.some((s) => s.gate_verdict !== undefined)) continue;
    let brokeAt = null;
    for (let i = 0; i < r.steps.length; i++) {
      const s = r.steps[i];
      if (s.loads_after === false || s.old_regression_after === false) { brokeAt = i + 1; break; }
    }
    chains.push({ label, goal: r.goal, seed: r.seed, verified: !!r.verified,
      steps: r.steps, nSteps: r.steps.length, brokeAt });
  }
}

function evaluate(name, fn) {
  let admitted = 0; let verifiedPreserved = 0; let verifiedDestroyed = 0;
  let doomedStopped = 0; let stepsRun = 0;
  const doomed = chains.filter((c) => !c.verified).length;
  for (const c of chains) {
    const p = fn(c.steps);
    // Steps a live policy would actually have spent: a kill at step k means steps k+1.. are never
    // generated, so this is the model-call saving.
    stepsRun += p.killedAt === null ? c.nSteps : p.killedAt;
    if (p.killedAt === null) {
      admitted++;
      if (c.verified) verifiedPreserved++;
    } else {
      if (c.verified) verifiedDestroyed++;
      else if (c.brokeAt === null || p.killedAt <= c.brokeAt) doomedStopped++;
    }
  }
  return { name, admitted, verifiedPreserved, verifiedDestroyed, doomedStopped, doomed, stepsRun };
}

const totalSteps = chains.reduce((a, c) => a + c.nSteps, 0);
const verified = chains.filter((c) => c.verified).length;

console.log('  EXPERIMENT GATE-POLICY   hard veto vs frozen budget ' + BUDGET);
console.log('  chains ' + chains.length + '   verified present ' + verified + '/' + chains.length
  + '   total steps ' + totalSteps + '\n');

if (verified === 0) {
  console.log('  NO VERIFIED CHAINS. "verified preserved" and "verified destroyed" have ZERO SENSITIVITY,');
  console.log('  so this batch CANNOT validate the policy question no matter what the other columns say.');
  console.log('  Report it as an insufficient substrate, not as a policy result.\n');
}

const rows = [evaluate('HARD_VETO', hardVeto), evaluate('FROZEN_BUDGET_2', (s) => gradedBudget(s, BUDGET))];
console.log('  policy            admitted   verified PRESERVED   verified DESTROYED   doomed stopped   steps run');
for (const r of rows) {
  console.log('  ' + r.name.padEnd(18)
    + String(r.admitted + '/' + chains.length).padEnd(11)
    + String(r.verifiedPreserved + '/' + verified).padEnd(21)
    + String(r.verifiedDestroyed).padEnd(21)
    + String(r.doomedStopped + '/' + r.doomed).padEnd(17)
    + r.stepsRun + '/' + totalSteps + ' (' + Math.round(100 * r.stepsRun / totalSteps) + '%)');
}

console.log('\n===== PRIMARY ENDPOINT =====');
const [hv, b2] = rows;
if (verified === 0) {
  console.log('  Undefined - no verified chains. See above.');
} else if (b2.verifiedPreserved > hv.verifiedPreserved && b2.doomedStopped > 0) {
  console.log('  VALIDATED: budget ' + BUDGET + ' preserved more verified chains ('
    + b2.verifiedPreserved + ' vs ' + hv.verifiedPreserved + ') while still stopping '
    + b2.doomedStopped + '/' + b2.doomed + ' doomed chains early.');
  console.log('  Risk estimation and authority control are separable, and the separation pays.');
} else if (b2.verifiedPreserved === hv.verifiedPreserved) {
  console.log('  NOT VALIDATED on preservation: both policies preserved '
    + b2.verifiedPreserved + '/' + verified + '. Compare steps run and doomed-stopped instead, and say');
  console.log('  that the preservation endpoint was flat rather than favourable.');
} else {
  console.log('  AGAINST the hypothesis: budget ' + BUDGET + ' preserved FEWER verified chains than the');
  console.log('  hard veto. Report as a failed prospective test of the frozen budget.');
}
