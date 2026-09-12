/**
 * compare-setJ.mjs - three models, one hub, twenty goals: did the two fixes move the number?
 *
 *   node tools/compare-setJ.mjs
 *
 * Set I answered "is it us or the model?" with THE MODEL - a dense 32B scored 6/20 where a ~3B-active MoE scored
 * 15/20. But it also produced two hub defects with a measured cost. Set J asks the narrower question: with
 * reindentTo()/regionAnchor() and noChangeAt() in place, does the score move?
 *
 * Every number here is computed over goals 1-20 only, and every target was re-scored at that arm's OWN goal-20
 * checkpoint (rebuilt from its workspace.bundle), because the checker scores the FINAL workspace and the set H arms
 * ran 100 goals. Comparing against a 100-goal-final score would have flattered the fixes.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const J = join(HERE, '..');
const N = 20;

const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };

/** TRUNCATION RULE, fixed before any set J number was visible (see COORD): an arm is scored over the goals it
 *  ACTUALLY REACHED, and its target is recomputed over that SAME range from the baseline arm own per-goal
 *  results. Comparing a truncated arm against a 20-goal target would understate it. */
//
// The baselines are the CHECKPOINT RECONSTRUCTIONS, not the -checks.json files on disk. Those files hold
// FINAL-workspace scores measured after 100 goals had been applied (14B 3/20, MoE 14/20); the pre-registered
// targets were re-scored at each arm's own goal-20 checkpoint (14B 4/20 @ 42ebd75, MoE 15/20 @ 064e062) and are
// one goal HIGHER on two of three arms. Reading the on-disk files would have compared against a baseline that is
// too low, i.e. would have flattered the fixes - the direction to be most suspicious of.
//
// Per-goal correctness of each baseline arm at its own goal-20 state, goal 1..20:
const BASELINE_BY_GOAL = {
  // REGENERATED from workspace.bundle @ 42ebd75, not typed. The hand-typed version totalled 4/20 correctly but had
  // the wrong POSITIONS, undercounting by a goal at n=5,7,8 - i.e. in the direction that flatters the fixes.
  'coder14b-setj': [0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],   // 4/20 @ 42ebd75
  'coder30b-setj': [1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 0],   // 15/20 @ 064e062
  'coder32b-setj': [0, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],   // 6/20, set I's own 20
};
const targetOverRange = (label, n) => {
  const a = BASELINE_BY_GOAL[label];
  if (!a || !n) return null;
  return a.slice(0, Math.min(n, a.length)).reduce((s, v) => s + v, 0);
};

/** Pre-registered in README.md BEFORE the window. DO NOT edit these to match the result. */
const ARMS = [
  { label: 'coder14b-setj', name: '14B  (Qwen2.5-Coder-14B-Instruct-AWQ)', hw: 'A10G', target: 4, from: 'set H @ 42ebd75', predict: '>=7' },
  { label: 'coder30b-setj', name: 'coder3 (Qwen3-Coder-30B-A3B, ~3B act)', hw: 'H100', target: 15, from: 'set H @ 064e062', predict: '15-17' },
  { label: 'coder32b-setj', name: 'dense 32B (Qwen2.5-Coder-32B)', hw: 'H100', target: 6, from: 'set I, own 20', predict: '7-10' },
];

/** How each run ENDED - set I's real discriminator. Budget exhaustion is a budget result, not a capability one. */
function endings(runsDir) {
  if (!existsSync(runsDir)) return null;
  const c = { n: 0, budget: 0, loop: 0, clean: 0, other: 0 };
  for (const f of readdirSync(runsDir).filter((x) => x.endsWith('.json') && !x.includes('transcript'))) {
    let j;
    try { j = JSON.parse(readFileSync(join(runsDir, f), 'utf8')); } catch { continue; }
    c.n++;
    const e = (j.steps || []).filter((s) => s.type === 'error').map((s) => String(s.text || '')).join(' ');
    if (/step budget/i.test(e)) c.budget++;
    else if (/same response|same tool call|identical/i.test(e)) c.loop++;
    else if (!e) c.clean++;
    else c.other++;
  }
  return c;
}

/** Did the two fixes actually fire? Their signatures are visible in the tool results the model was shown. */
function fixSignals(runsDir) {
  if (!existsSync(runsDir)) return null;
  const s = { alreadyLanded: 0, noChange: 0, destructive: 0, duplicated: 0, tolerant: 0 };
  for (const f of readdirSync(runsDir).filter((x) => x.endsWith('.json') && !x.includes('transcript'))) {
    let j;
    try { j = JSON.parse(readFileSync(join(runsDir, f), 'utf8')); } catch { continue; }
    for (const st of (j.steps || [])) {
      if (st.type !== 'tool') continue;
      const r = String(st.result || '');
      if (/ALREADY HAVE LANDED|ALREADY LANDED/i.test(r)) s.alreadyLanded++;
      if (/^NO CHANGE/.test(r)) s.noChange++;
      if (/would have REMOVED/.test(r)) s.destructive++;
      if (/would have DUPLICATED/.test(r)) s.duplicated++;
      if (/matched ignoring indentation/.test(r)) s.tolerant++;
    }
  }
  return s;
}

console.log('\n=== SET J - three models, one patched hub, goals 1-20 ===');
console.log('    serving ai-coding-hub-indent @ 3d7a080, agent.js md5 d53b1f230cb0');
console.log('    fixes: reindentTo()+regionAnchor() (tolerant edits re-indent to the region they replaced)');
console.log('           and noChangeAt() (a no-op refusal shows the region, and says it may ALREADY HAVE LANDED)\n');

const rows = [];
for (const a of ARMS) {
  const checks = readJson(join(J, a.label + '-checks.json'));
  const r = (checks?.results || []).filter((x) => x.goal <= N);
  const log = join(J, a.label + '-setJ.log');
  const attempted = existsSync(log)
    ? [...readFileSync(log, 'utf8').matchAll(/^\s+(\d+)\s+(done|stopped|error|interrupted|failed)\s/gm)].filter((m) => Number(m[1]) <= N).length
    : 0;
  rows.push({
    ...a, present: !!checks, results: r, impl: r.filter((x) => x.impl).length, attempted,
    ends: endings(join(J, 'runs', a.label, 'runs')), sig: fixSignals(join(J, 'runs', a.label, 'runs')),
  });
}

console.log('  model                                     target    now    delta   attempted   predicted');
for (const r of rows) {
  if (!r.present) { console.log('  ' + r.name.padEnd(40) + String(r.target).padStart(6) + '    (not finished yet)'); continue; }
  const d = r.impl - r.target;
  console.log('  ' + r.name.padEnd(40) + String(r.target).padStart(6) + String(r.impl).padStart(7)
    + ('    ' + (d >= 0 ? '+' : '') + d).padEnd(9) + String(r.attempted).padStart(8) + '      ' + r.predict);
}
console.log('\n  Targets are each arm at its own goal-20 checkpoint, same goals, byte-identical checker.');
console.log('  NOTE: 20 goals, one run per arm. Set H measured +/-1-2 spread over 54-59 goals, so noise here is');
console.log('        proportionally LARGER. A 1-2 goal move means nothing; only a clear margin counts.');

console.log('\n--- Did the fixes FIRE? (their signatures in what the model was actually shown) ---');
for (const r of rows) {
  if (!r.sig) { console.log('  ' + r.name + ': no records'); continue; }
  const s = r.sig;
  console.log('  ' + r.name + ':');
  console.log('      tolerant edits ' + s.tolerant + '   NO CHANGE refusals ' + s.noChange
    + '  (carrying the "already landed" wording: ' + s.alreadyLanded + ')');
  console.log('      destructive refusals ' + s.destructive + '   duplicate refusals ' + s.duplicated);
}
console.log('  A fix that never fired cannot explain a change either way - check this BEFORE attributing anything.');

console.log('\n--- How each run ENDED (set I real discriminator) ---');
for (const r of rows) {
  const e = r.ends;
  if (!e) { console.log('  ' + r.name + ': no records'); continue; }
  console.log('  ' + r.name.padEnd(40) + e.n + ' runs - budget ' + e.budget + ', loop-guard ' + e.loop
    + ', clean ' + e.clean + ', other ' + e.other);
}
console.log('  Set H/I first-20 baseline: 14B 0 budget / 13 loop, MoE 0 / 1, dense 2 / 5.');
console.log('  Prediction 1 rests on this: the 14B lost 13 of 20 to the loop guard, and noChangeAt targets exactly that.');

console.log('\n--- Per pass: creating vs extending ---');
for (const r of rows) {
  if (!r.present) continue;
  const a = r.results.filter((x) => x.goal <= 10 && x.impl).length;
  const b = r.results.filter((x) => x.goal > 10 && x.impl).length;
  console.log('  ' + r.name.padEnd(40) + 'create ' + a + '/10   extend ' + b + '/10');
}
console.log('  Set I dense was 4/10 then 2/10 - worse at BOTH, collapsing on the second pass. This is where');
console.log('  compounding shows, and it is the north-star behaviour: does earlier work survive later goals?');

console.log('\n--- Repeated defects across both passes of one project ---');
for (const r of rows) {
  if (!r.present) continue;
  const byFile = {};
  for (const x of r.results.filter((y) => !y.impl)) (byFile[String(x.file || '?')] ||= []).push(String(x.why || '').slice(0, 52));
  const rep = Object.entries(byFile).filter(([, v]) => v.length > 1);
  console.log('  ' + r.name + ': ' + (rep.length ? rep.length + ' project(s) failed twice' : 'none failed both passes'));
  for (const [f, v] of rep) console.log('      ' + f + ': ' + v.join(' | '));
}
console.log('  Set I: dense 5 projects failed both passes, MoE 1.\n');
