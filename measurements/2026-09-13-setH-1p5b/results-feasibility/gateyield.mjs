// CHAIN-LEVEL GATE EVALUATION on unseen trajectories.
//
// Step-level discrimination is not the endpoint. False refusals COMPOUND across a multi-site
// transaction: 11% per step over 7 sites is a large chain-level loss, so a gate can look excellent per
// edit and still strangle end-to-end throughput.
//
// The run recorded the frozen gate's verdict at every step WITHOUT acting on it, so enforcement is
// simulated here by killing each chain at its FIRST REFUSE. Both arms are therefore the same
// trajectories - no second inference pass, no cross-arm sampling noise.
//
// Gating cannot raise the absolute number of verified chains; it can only remove chains. So the endpoint
// is whether it raises VERIFIED PER EXECUTED CHAIN while destroying no viable chain.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RUNS = process.argv.slice(2).map((s) => { const [label, dir] = s.split('='); return { label, dir }; });

for (const { label, dir } of RUNS) {
  let rows;
  try { rows = JSON.parse(readFileSync(join(dir, 'rows.json'), 'utf8')); } catch (e) { console.log('  skip ' + dir); continue; }
  const B = rows.filter((r) => r.condition === 'B_oracle_localized_insertion');
  if (!B.length) continue;
  console.log('===== ' + label + '  (' + B.length + ' chains) =====');

  let stepHarmful = 0; let stepHarmfulRefused = 0;
  let stepHarmless = 0; let stepHarmlessRefused = 0;
  let uncertain = 0; let noVerdict = 0;

  const chains = [];
  for (const r of B) {
    let firstRefuse = null;
    for (let i = 0; i < r.steps.length; i++) {
      const s = r.steps[i];
      if (s.gate_verdict === undefined) { noVerdict++; continue; }
      if (s.gate_verdict === 'UNCERTAIN') uncertain++;
      const harmful = s.loads_after === false || s.old_regression_after === false;
      if (harmful) { stepHarmful++; if (s.gate_verdict === 'REFUSE') stepHarmfulRefused++; }
      else { stepHarmless++; if (s.gate_verdict === 'REFUSE') stepHarmlessRefused++; }
      if (firstRefuse === null && s.gate_verdict === 'REFUSE') firstRefuse = i + 1;
    }
    chains.push({ goal: r.goal, seed: r.seed, verified: !!r.verified,
      completed: r.aborted_at === null, firstRefuse,
      killedByGate: firstRefuse !== null,
      brokeAt: (() => { for (let i = 0; i < r.steps.length; i++) {
        const s = r.steps[i];
        if (s.loads_after === false || s.old_regression_after === false) return i + 1;
      } return null; })() });
  }

  console.log('  --- step level (unseen) ---');
  console.log('    harmful steps refused   ' + stepHarmfulRefused + '/' + stepHarmful
    + (stepHarmful ? '   (' + Math.round(100 * stepHarmfulRefused / stepHarmful) + '%)' : ''));
  console.log('    harmless steps refused  ' + stepHarmlessRefused + '/' + stepHarmless
    + (stepHarmless ? '   (' + Math.round(100 * stepHarmlessRefused / stepHarmless) + '%)' : ''));
  console.log('    flagged UNCERTAIN       ' + uncertain + (noVerdict ? '   (steps with no verdict recorded: ' + noVerdict + ')' : ''));

  const attempted = chains.length;
  const verified = chains.filter((c) => c.verified).length;
  const killed = chains.filter((c) => c.killedByGate).length;
  const admitted = attempted - killed;
  const verifiedAdmitted = chains.filter((c) => c.verified && !c.killedByGate).length;
  const viableDestroyed = chains.filter((c) => c.verified && c.killedByGate).length;
  // A gate earns its keep by stopping doomed chains EARLY, before they commit more state.
  const doomedStoppedEarly = chains.filter((c) => !c.verified && c.firstRefuse !== null
    && c.brokeAt !== null && c.firstRefuse <= c.brokeAt).length;
  const doomed = chains.filter((c) => !c.verified).length;

  console.log('  --- chain level (the primary endpoint) ---');
  console.log('    chains attempted                 ' + attempted);
  console.log('    verified, ungated                ' + verified + '/' + attempted
    + '   precision ' + (attempted ? (verified / attempted).toFixed(3) : '-'));
  console.log('    chains killed by the gate        ' + killed);
  console.log('    chains admitted                  ' + admitted);
  console.log('    verified among admitted          ' + verifiedAdmitted + '/' + admitted
    + '   precision ' + (admitted ? (verifiedAdmitted / admitted).toFixed(3) : '-'));
  console.log('    VIABLE CHAINS DESTROYED          ' + viableDestroyed
    + (viableDestroyed ? '   <-- DISQUALIFYING' : '   (none - the gate cost no success)'));
  console.log('    doomed chains stopped at or before their first break  '
    + doomedStoppedEarly + '/' + doomed);

  console.log('  --- verdict ---');
  if (viableDestroyed > 0) {
    console.log('    FAILS the preregistered bar: the gate destroyed a chain that would have verified.');
  } else if (admitted === 0) {
    console.log('    VACUOUS: the gate admitted nothing, so its precision is undefined. A gate that');
    console.log('    refuses everything is not a classifier.');
  } else if (attempted && verifiedAdmitted / admitted > verified / attempted) {
    console.log('    Chain-level precision IMPROVED ('
      + (verified / attempted).toFixed(3) + ' -> ' + (verifiedAdmitted / admitted).toFixed(3)
      + ') with no viable chain destroyed.');
  } else if (verified === 0) {
    console.log('    No verified chain in this batch, so chain-level precision cannot improve. Read the');
    console.log('    step-level discrimination and the early-stopping figure instead, and say so.');
  } else {
    console.log('    Chain-level precision did not improve. False refusals are compounding across sites.');
  }
  console.log('');
}
