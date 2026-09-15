// SEPARATING RISK ESTIMATION FROM AUTHORITY POLICY.
//
// B4 showed the frozen gate is a useful step-level discriminator (66.7% of harmful steps refused, 13.5%
// of harmless) whose POLICY was wrong: every negative prediction was terminal, so over a seven-site
// transaction a one-in-eight false-refusal rate killed 81% of chains. The classifier is not the problem.
//
//   RISK ESTIMATION   what does this step look like?            <- the frozen gate, unchanged
//   AUTHORITY POLICY  what to do about that risk GIVEN THE      <- new, and it needs chain context
//                     STATE OF THE WHOLE CHAIN
//
// The point of the second layer is that the fourth questionable step in a seven-site transaction is not
// the same event as the first. A per-step classifier cannot know that; a budget can.
//
// NO NEW INFERENCE. The frozen gate's verdicts and reasons are already recorded per step, so every
// policy below is evaluated by replaying preserved trajectories.
//
// TUNING DISCIPLINE. The budget is a free parameter, so it is chosen on the DEVELOPMENT trajectories
// (B2, B3, 7B B3) and then evaluated once on the UNSEEN batch (B4). Tuning it on B4 would make the
// prospective claim worthless, which is the whole reason B4 was held out.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// RISK ESTIMATION: a fixed mapping from the frozen gate's own reason kinds to severity. Derived from
// what each defect does, not from how often it appeared.
//   unsafe    statically demonstrable runtime failure - reading a name that does not exist here
//   high      statically demonstrable behavioural damage
//   moderate  correlated with failure but not itself harmful (B4: echoed comments loaded and preserved
//             perfectly well, and treating them as terminal caused most false refusals)
export function riskOf(reasons) {
  const kinds = (reasons || []).map((r) => (typeof r === 'string' ? r.replace(/\(.*/, '') : r.kind));
  if (kinds.includes('out_of_scope_identifier')) return 'unsafe';
  if (kinds.includes('duplicate_accumulation') || kinds.includes('redeclares_existing')) return 'high';
  if (kinds.includes('instruction_echo') || kinds.includes('empty_snippet')) return 'moderate';
  return 'low';
}
const COST = { low: 0, moderate: 1, high: 2, unsafe: Infinity };

// AUTHORITY POLICY. Walks a chain in order, accumulating risk, and decides where authority stops.
export function applyPolicy(steps, budget) {
  let spent = 0;
  for (let i = 0; i < steps.length; i++) {
    const risk = riskOf(steps[i].gate_reasons);
    const cost = COST[risk];
    if (cost === Infinity) return { killedAt: i + 1, reason: 'proven unsafe', spent };
    spent += cost;
    if (spent > budget) return { killedAt: i + 1, reason: 'risk budget exhausted (' + spent + ' > ' + budget + ')', spent };
  }
  return { killedAt: null, reason: 'admitted', spent };
}

function load(dirs) {
  const chains = [];
  for (const { label, dir } of dirs) {
    let rows;
    try { rows = JSON.parse(readFileSync(join(dir, 'rows.json'), 'utf8')); } catch (e) { continue; }
    for (const r of rows.filter((x) => x.condition === 'B_oracle_localized_insertion')) {
      if (!r.steps.some((s) => s.gate_verdict !== undefined)) continue;
      chains.push({ label, goal: r.goal, seed: r.seed, verified: !!r.verified, steps: r.steps,
        brokeAt: (() => { for (let i = 0; i < r.steps.length; i++) {
          const s = r.steps[i];
          if (s.loads_after === false || s.old_regression_after === false) return i + 1;
        } return null; })() });
    }
  }
  return chains;
}

function score(chains, budget) {
  let killed = 0; let viableDestroyed = 0; let verifiedAdmitted = 0; let doomedStopped = 0;
  let harmfulStopped = 0; let harmfulTotal = 0; let harmlessKilled = 0; let harmlessTotal = 0;
  for (const c of chains) {
    const p = applyPolicy(c.steps, budget);
    if (p.killedAt !== null) {
      killed++;
      if (c.verified) viableDestroyed++;
      if (!c.verified && c.brokeAt !== null && p.killedAt <= c.brokeAt) doomedStopped++;
    } else if (c.verified) verifiedAdmitted++;
    for (let i = 0; i < c.steps.length; i++) {
      const s = c.steps[i];
      if (s.gate_verdict === undefined) continue;
      const harmful = s.loads_after === false || s.old_regression_after === false;
      const stoppedHere = p.killedAt !== null && p.killedAt <= i + 1;
      if (harmful) { harmfulTotal++; if (stoppedHere) harmfulStopped++; }
      else { harmlessTotal++; if (stoppedHere) harmlessKilled++; }
    }
  }
  const n = chains.length;
  return { budget, n, killed, admitted: n - killed, viableDestroyed, verifiedAdmitted,
    doomedStopped, verified: chains.filter((c) => c.verified).length,
    harmfulStopped, harmfulTotal, harmlessKilled, harmlessTotal };
}

const DEV = [
  { label: 'b2', dir: 'C:/Users/tatte/AppData/Local/Temp/b2-run' },
  { label: 'b3', dir: 'C:/Users/tatte/AppData/Local/Temp/b3-run' },
  { label: '7b', dir: 'C:/Users/tatte/AppData/Local/Temp/coder7b/B3' },
];
const UNSEEN = [{ label: 'b4', dir: 'C:/Users/tatte/AppData/Local/Temp/b4-run' }];

const dev = load(DEV);
const unseen = load(UNSEEN);
console.log('  RISK ESTIMATION x AUTHORITY POLICY - replay of preserved trajectories, no new inference');
console.log('  development chains with recorded verdicts: ' + dev.length + '   unseen: ' + unseen.length + '\n');

if (!dev.length) {
  console.log('  The development runs pre-date shadow gating, so they carry no recorded gate verdicts.');
  console.log('  The budget can therefore only be selected on trajectories that DO have them. Reporting');
  console.log('  the full sweep on the unseen batch is NOT a substitute - it would be tuning on the');
  console.log('  holdout - so the sweep below is labelled exploratory and the claim stays with B4.');
}

const row = (s) => '  budget ' + String(s.budget).padEnd(4)
  + ' admitted ' + String(s.admitted + '/' + s.n).padEnd(8)
  + ' verified among admitted ' + String(s.verifiedAdmitted + '/' + s.admitted).padEnd(7)
  + ' VIABLE DESTROYED ' + String(s.viableDestroyed).padEnd(3)
  + ' harmful stopped ' + String(s.harmfulStopped + '/' + s.harmfulTotal).padEnd(8)
  + ' harmless killed ' + (s.harmlessKilled + '/' + s.harmlessTotal);

for (const [name, set] of [['DEVELOPMENT', dev], ['UNSEEN (B4)', unseen]]) {
  if (!set.length) continue;
  console.log('===== ' + name + ' =====');
  console.log('  verified chains present: ' + set.filter((c) => c.verified).length + '/' + set.length);
  for (const b of [0, 1, 2, 3, 4, 6, Infinity]) console.log(row(score(set, b)));
  console.log('');
}

console.log('===== READING =====');
console.log('  budget 0        every flagged step is terminal - this is the hard veto that failed');
console.log('  budget Infinity only proven-unsafe steps are terminal - pure static safety, no throttle');
console.log('  in between      a chain may absorb some suspicion before authority is withdrawn');
console.log('');
console.log('  With zero verified chains in a set, "verified among admitted" and "viable destroyed" have');
console.log('  NO SENSITIVITY there, exactly as in B4. Read admission rate and harmful-stopped instead,');
console.log('  and do not promote either into the endpoint slot.');
