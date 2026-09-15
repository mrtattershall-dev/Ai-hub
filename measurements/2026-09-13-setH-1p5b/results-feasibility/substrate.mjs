// SUBSTRATE QUALIFICATION, stage 1: does a multi-site lane with outcome VARIANCE exist at all?
//
// GATE-POLICY was structurally unanswerable because the two properties it needs never co-occur in this
// goal set:
//
//   intermediate difficulty   63 (p=.75), 66 (.75), 72 (.875), 75 (.125)   SINGLE-insertion routes
//   genuinely multi-site      64, 71, 74                                    all measured p = 0
//
// A budget policy governs a CHAIN, so a one-step goal cannot test it; and a lane where the generator
// never succeeds has no viable trajectory for the gate to destroy. Only goals whose contract carries
// 2+ genuinely new members route to multi-member insertion: 67 (3), 71 (3), 80 (2). 71 is already known
// at 0. 67 and 80 have never been measured.
//
// STAGE 2 IS NOT AUTHORISED BY THIS SCRIPT. It runs only if a lane clears the minimum below, which is
// fixed here BEFORE any number is produced.
//
//   QUALIFICATION MINIMUM: a lane qualifies only if it shows at least 2 of 8 verified AND at least 2 of
//   8 failed. Both halves are required - a lane at 8/8 has nothing for the gate to intercept, and a lane
//   at 0/8 has nothing for it to preserve. That is exactly the error that nullified GATE-POLICY.
//
//   If a lane qualifies at p_hat, the policy run needs N such that P(fewer than 8 verified) <= 0.10 at
//   the CONSERVATIVE end of the estimate, not at p_hat itself.
//
// Free: local 1.5B. arm3 is frozen and takes no seed, so these are independent unseeded draws - which is
// what estimating a rate requires anyway.
import { runGoalV3 } from './arm3.mjs';
import { deriveContract } from './contract.mjs';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const CASES = (process.env.CASES || '67,80,71').split(',').map(Number);
const N = Number(process.env.REPEATS || 8);

const world = new Map();
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) world.set(f, readFileSync(p));
  }
}
const names = [...world.keys()].sort();
const freshWs = () => {
  const ws = mkdtempSync(join(tmpdir(), 'subq-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  for (const f of names) writeFileSync(join(ws, f), world.get(f));
  return ws;
};

// Smallest N with P(X >= 8) >= 0.90.
function needed(p) {
  if (p <= 0) return Infinity;
  const pAtLeast = (k, n) => {
    let c = 1; let s = 0;
    for (let i = 0; i < k; i++) { s += c * Math.pow(p, i) * Math.pow(1 - p, n - i); c = c * (n - i) / (i + 1); }
    return 1 - s;
  };
  let n = 8;
  while (n < 5000 && pAtLeast(8, n) < 0.90) n++;
  return n;
}

console.log('  SUBSTRATE QUALIFICATION stage 1 - local 1.5B, ' + N + ' unseeded draws per lane');
console.log('  MINIMUM FIXED BEFORE ANY RESULT: >=2/8 verified AND >=2/8 failed\n');

// PRECONDITION: can this goal succeed from this seed AT ALL?
//
// Goal 80 calls library.toJSON() and Library.fromJSON, which goal 71 adds. Neither appears in the
// post-60 seed (verified: 0 occurrences in seed60/s1_library.js), so from this predecessor goal 80 is
// impossible BY CONSTRUCTION. Running it would produce a stable 0/8 that reads as model difficulty and
// would be rejected by the qualifier for entirely the wrong reason.
//
// A lane must be proven RUNNABLE before its failure rate means anything. This is the same class as
// defect 6 - an obligation that cannot be met from the state it starts in.
// The rule is OWNERSHIP, not mere absence. My first version flagged any referenced symbol missing from
// the seed and therefore excluded 67 and 71 as well - whose "missing" symbols are precisely what those
// goals exist to ADD. A goal is unrunnable only when it depends on a symbol that is neither in the seed
// NOR in its own contract, i.e. one that some OTHER goal is responsible for creating. Caught by the
// witness pair (80 must exclude, 67/71 must not), which is why both directions are always asserted.
// THE HEURISTIC IS ABANDONED. Two attempts produced two different false positives: the first excluded
// 67 and 71 for referencing the symbols they exist to ADD; the second still excluded 67, because
// `onEvict` is an options-object KEY, which contract.mjs deliberately keeps out of members (the fix made
// for goal 47's { ttl, now }). Prose goal text is not reliably parseable for cross-goal dependencies,
// and a third guess would just be a third false positive.
//
// A DECLARED TABLE instead, with the evidence recorded beside each entry. It is one line long, it is
// auditable, and it cannot silently misfire on a goal nobody checked.
// A symbol absent from the seed is one of two completely different things, and the checker must not
// confuse them:
//
//   absent + INTRODUCED BY THIS GOAL      -> allowed; it is the deliverable
//   absent + REQUIRED TO ALREADY EXIST    -> owned by another goal  -> HARD_DEPENDENCY
//                                         -> expected from runtime  -> MISSING_PRECONDITION
//
// INVARIANT: a goal is isolated-runnable iff every referenced-but-absent symbol is either introduced by
// that same goal or explicitly authorised as external.
const OWNERSHIP = {
  67: { introduces: ['onEvict'], requires_existing: [] },
  71: { introduces: ['toJSON', 'fromJSON'], requires_existing: [] },
  80: { introduces: ['snapshot', 'restore'], requires_existing: ['toJSON', 'fromJSON'] },
};
const AUTHORISED_EXTERNAL = new Set(['JSON', 'Math', 'Object', 'Array', 'console']);

export function runnableFrom(goal, seedText) {
  const o = OWNERSHIP[goal];
  if (!o) return { ok: true, missing: [] };
  const own = new Set(o.introduces);
  const missing = [];
  for (const sym of o.requires_existing) {
    if (own.has(sym)) continue;                                   // deliverable, not prerequisite
    if (AUTHORISED_EXTERNAL.has(sym)) continue;                    // runtime, not benchmark-owned
    if (new RegExp('\\b' + sym + '\\b').test(seedText)) continue;  // predecessor already supplies it
    const owner = Object.entries(OWNERSHIP).find(([, v]) => v.introduces.includes(sym));
    missing.push(sym + (owner ? ' (owned by goal ' + owner[0] + ')' : ' (no known owner)'));
  }
  return { ok: missing.length === 0, missing };
}
const seedText = () => [...world.entries()].map(([, b]) => b.toString('utf8')).join('\n');
function runnable(goal) { return runnableFrom(goal, seedText()); }

const out = [];
for (const goal of CASES) {
  const pre = runnable(goal);
  if (!pre.ok) {
    console.log('  goal ' + goal + '  UNRUNNABLE_FROM_THIS_SEED - the goal references '
      + pre.missing.join(', ') + ', which this predecessor does not define.');
    console.log('    Excluded from qualification. A 0/N here would be a dependency artifact, not model');
    console.log('    difficulty. Qualify it only on a predecessor that contains its dependency.\n');
    out.push({ goal, excluded: 'unrunnable_from_this_seed', missing: pre.missing, qualifies: false });
    continue;
  }
  let pass = 0; const routes = new Set(); const kinds = [];
  for (let i = 0; i < N; i++) {
    const ws = freshWs();
    let rec;
    try { rec = await runGoalV3({ ws, goalIndex: goal - 1, goals: GOALS }); }
    catch (e) { rec = { verified_goal_pass: false, failure_kind: 'threw', note: String(e.message).slice(0, 60) }; }
    if (rec.verified_goal_pass) pass++;
    routes.add(rec.v3_route || rec.operation || '?');
    if (!rec.verified_goal_pass) kinds.push(rec.failure_kind || 'unknown');
    process.stdout.write('  [' + goal + ' ' + (i + 1) + '/' + N + '] ' + (rec.verified_goal_pass ? 'PASS' : 'fail')
      + '  ' + String(rec.v3_route || rec.operation || '').padEnd(28)
      + (rec.members_requested ? ' members ' + rec.members_completed + '/' + rec.members_requested : '') + '\n');
  }
  const p = pass / N;
  const multiSite = [...routes].some((r) => /multi_member/.test(r));
  const qualifies = pass >= 2 && (N - pass) >= 2 && multiSite;
  out.push({ goal, pass, n: N, p, routes: [...routes], multiSite, qualifies, kinds });
  console.log('    -> ' + pass + '/' + N + ' verified   routes ' + [...routes].join(',')
    + '   multi-site=' + multiSite + '   QUALIFIES=' + qualifies + '\n');
}

console.log('===== QUALIFICATION =====');
for (const r of out) {
  if (r.excluded) { console.log('  goal ' + String(r.goal).padEnd(4) + 'EXCLUDED - ' + r.excluded + ' (' + r.missing.join(',') + ')'); continue; }
  console.log('  goal ' + String(r.goal).padEnd(4) + r.pass + '/' + r.n + ' verified'
    + '   multi-site ' + String(r.multiSite).padEnd(6)
    + (r.qualifies ? '  QUALIFIES   policy run needs N >= ' + needed(r.p) + ' chains'
      : '  does not qualify (' + (!r.multiSite ? 'single-site' : r.pass < 2 ? 'too few successes' : 'too few failures') + ')'));
}
const any = out.filter((r) => r.qualifies);
console.log('');
if (any.length) {
  console.log('  STAGE 2 IS AUTHORISED on: ' + any.map((r) => 'goal ' + r.goal).join(', '));
  console.log('  Freeze the lane, then run hard-veto vs budget-2 on FRESH seeds at the N above.');
} else {
  console.log('  STAGE 2 IS NOT AUTHORISED. No lane has both a chain to govern and outcome variance to');
  console.log('  measure, so the policy question stays unanswerable on this goal set and the honest move');
  console.log('  is to build a substrate rather than spend another window on one that cannot answer it.');
}
