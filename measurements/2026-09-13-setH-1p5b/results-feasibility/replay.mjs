// COUNTERFACTUAL REPLAY: is site k actually wrong, or only wrong in combination?
//
// FIRST_FAILING_SITE=k names the EARLIEST CAUSAL BOUNDARY - the first state where an invariant is
// observably violated. It does NOT establish that site k's snippet is locally defective. Sites 1 and 2
// could each create state correctly and site 5 could then process both in a way that duplicates work;
// the regression flips at 5 while 5 is perfectly sensible in isolation.
//
// Three replays separate those, using ONLY already-generated snippets. No model calls.
//
//   (a) model 1..k-1  +  model k        must reproduce the observed failure, or the replay is broken
//   (b) reference 1..k-1 + model k      does the model's snippet fail even on correct predecessors?
//   (c) model 1..k-1 + reference k      does replacing just site k rescue it?
//
// VERDICTS
//   LOCAL_SNIPPET_DEFECT     (b) fails - the snippet is wrong on a correct predecessor state
//   UPSTREAM_DEFECT          (c) still fails - swapping site k for the reference does not help, so the
//                            causal burden lies earlier than k
//   CROSS_SITE_INTERACTION   (b) passes and (c) passes - each part is admissible, the composition is not
import { readFileSync, writeFileSync, readdirSync, statSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SITES, locate } from './oraclesites.mjs';
import { regressionFor } from './regression.mjs';
import { probe60For } from './probes60.mjs';
import { checkContract } from './contractCheck.mjs';
import { deriveContract } from './contract.mjs';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const DIR = process.argv[2];
const rows = JSON.parse(readFileSync(join(DIR, 'rows.json'), 'utf8'))
  .filter((r) => r.condition === 'B_oracle_localized_insertion');

const world = new Map();
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) world.set(f, readFileSync(p));
  }
}
const names = [...world.keys()].sort();
const freshWs = () => {
  const ws = mkdtempSync(join(tmpdir(), 'rpl-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  for (const f of names) writeFileSync(join(ws, f), world.get(f));
  return ws;
};

// Reconstruct the exact snippet the harness inserted at a step: the reply bytes with the site
// indentation re-added, then the same bound applied if the run used one.
const indentOf = (l) => (l.match(/^[ \t]*/) || [''])[0].length;
function boundToSite(snippet, indent, src) {
  const structural = new Set(src.split('\n').map((l) => l.trim()).filter((l) => l.length > 3));
  const lines = snippet.split('\n');
  const keep = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const t = l.trim();
    if (i > 0) {
      if (t && indentOf(l) < indent) break;
      if (/^#/.test(t) && /WRITE ONLY|REQUESTED CHANGE|AUTHORITATIVE|MARKER/i.test(t)) break;
      if (/^(def|for|while|class)\b/.test(t) && structural.has(t)) break;
    }
    keep.push(l);
  }
  while (keep.length && !keep[keep.length - 1].trim()) keep.pop();
  return keep.join('\n') + '\n';
}
function modelSnippet(step, site, curSrc, route, bound) {
  const body = readFileSync(join(DIR, 'replies', step.wire_id + '.reply.txt'), 'utf8');
  let s = route === 'indent_primer' ? ' '.repeat(site.indent) + body : body;
  if (bound === 'd2') s = boundToSite(s, site.indent, curSrc);
  return s;
}

// Apply a chosen sequence of snippets, re-anchoring at every step exactly as the harness does.
function build(spec, pick, ws) {
  const path = join(ws, spec.file);
  let cur = readFileSync(path, 'utf8');
  for (let i = 0; i < pick.length; i++) {
    const site = spec.sites[i];
    const loc = locate(cur, site);
    if (!loc.ok) return { ok: false, why: 'site ' + (i + 1) + ': ' + loc.why, src: cur };
    const snip = pick[i](cur, site, i);
    if (snip === null) return { ok: false, why: 'no snippet for site ' + (i + 1), src: cur };
    cur = loc.before + snip + loc.after;
  }
  writeFileSync(path, cur, 'utf8');
  return { ok: true, src: cur };
}

console.log('  COUNTERFACTUAL REPLAY - preserved snippets only, no model calls\n');
const out = [];
for (const r of rows) {
  const spec = SITES[r.goal];
  const c = deriveContract(GOALS[r.goal - 1]);
  const suite = regressionFor(spec.file);
  const probe = probe60For(r.goal);
  const route = r.route || 'zero_width';
  const bound = r.intent_set && r.steps.some((s) => s.bound_stopped_by !== undefined) ? 'd2' : 'none';

  // Locate the earliest causal boundary.
  let k = null;
  let kind = null;
  for (let i = 0; i < r.steps.length; i++) {
    const s = r.steps[i];
    if (s.loads_after === false) { k = i + 1; kind = 'LOAD_BOUNDARY'; break; }
    if (s.old_regression_after === false) { k = i + 1; kind = 'PRESERVATION_BOUNDARY'; break; }
  }
  if (k === null) {
    const cat = r.verified ? 'VERIFIED'
      : (r.aborted_at === null && r.final_old_regression && !r.final_new_delta) ? 'DELTA_INCOMPLETE'
        : (r.aborted_at === null && r.final_old_regression === false) ? 'CROSS_SITE_INTERACTION_at_end'
          : 'aborted_without_boundary';
    out.push({ goal: r.goal, seed: r.seed, k: null, kind: cat, verdict: cat });
    console.log('  g' + r.goal + ' s' + String(r.seed).padEnd(3) + '  ' + cat);
    continue;
  }
  const step = r.steps[k - 1];
  if (!step.wire_id) {
    out.push({ goal: r.goal, seed: r.seed, k, kind, verdict: 'reference-only step' });
    continue;
  }

  const evalAt = (ws) => {
    const lo = checkContract(ws, spec.file, { ...c, moduleExports: [], members: [] });
    return { loads: lo.loads, reg: lo.loads ? suite(ws).pass : false };
  };
  const holds = (v) => (kind === 'LOAD_BOUNDARY' ? v.loads : v.loads && v.reg);

  // (a) model predecessors + model k  -> must reproduce the failure
  const wsA = freshWs();
  const bA = build(spec, Array.from({ length: k }, (_, i) => (cur, site) =>
    modelSnippet(r.steps[i], site, cur, route, bound)), wsA);
  const a = bA.ok ? evalAt(wsA) : { loads: false, reg: false };

  // (b) reference predecessors + model k
  const wsB = freshWs();
  const bB = build(spec, Array.from({ length: k }, (_, i) => (cur, site) =>
    (i < k - 1 ? site.reference : modelSnippet(r.steps[k - 1], site, cur, route, bound))), wsB);
  const b = bB.ok ? evalAt(wsB) : { loads: false, reg: false };

  // (c) model predecessors + reference k
  const wsC = freshWs();
  const bC = build(spec, Array.from({ length: k }, (_, i) => (cur, site) =>
    (i < k - 1 ? modelSnippet(r.steps[i], site, cur, route, bound) : site.reference)), wsC);
  const cc = bC.ok ? evalAt(wsC) : { loads: false, reg: false };

  // The full 2x2. Given that model+model already fails:
  //
  //        (b) reference pre + model k      (c) model pre + reference k
  //   FAIL                                  PASS    LOCAL_SNIPPET_DEFECT
  //   PASS                                  FAIL    UPSTREAM_DEFECT
  //   PASS                                  PASS    CROSS_SITE_INTERACTION
  //   FAIL                                  FAIL    MULTIPLE_DEFECTS
  //
  // The fourth quadrant matters: without it, a trajectory where the site-k snippet AND the upstream
  // state are independently defective is labelled local or upstream depending only on which
  // counterfactual is inspected first, and there is no honest single-site attribution to make.
  const reproduced = !holds(a);
  const bOk = holds(b);
  const cOk = holds(cc);
  let verdict;
  if (!reproduced) verdict = 'REPLAY_DID_NOT_REPRODUCE - inconclusive';
  else if (k === 1) verdict = 'LOCAL_SNIPPET_DEFECT_no_predecessor';
  else if (!bOk && cOk) verdict = 'LOCAL_SNIPPET_DEFECT';
  else if (bOk && !cOk) verdict = 'UPSTREAM_DEFECT';
  else if (bOk && cOk) verdict = 'CROSS_SITE_INTERACTION';
  else verdict = 'MULTIPLE_DEFECTS';

  out.push({ goal: r.goal, seed: r.seed, k, kind, verdict,
    a: holds(a), b: holds(b), c: holds(cc), reproduced });
  console.log('  g' + r.goal + ' s' + String(r.seed).padEnd(3) + '  boundary at site ' + k + ' (' + kind + ')');
  console.log('        (a) model pre + model k       ' + (holds(a) ? 'holds' : 'FAILS') + (reproduced ? '  <- reproduced' : '  <- did NOT reproduce'));
  console.log('        (b) REFERENCE pre + model k   ' + (holds(b) ? 'holds' : 'FAILS'));
  console.log('        (c) model pre + REFERENCE k   ' + (holds(cc) ? 'holds' : 'FAILS'));
  console.log('        => ' + verdict);
}

console.log('\n===== CAUSAL TALLY =====');
const t = new Map();
for (const o of out) t.set(o.verdict, (t.get(o.verdict) || 0) + 1);
for (const [k2, n] of [...t].sort((x, y) => y[1] - x[1])) console.log('  ' + n + 'x  ' + k2);

// DOES ENDPOINT EQUIVALENCE IMPLY CAUSAL EQUIVALENCE?
// Trajectories whose observable failure is identical may still have arrived there by different routes.
// If two byte-identical endpoints receive different verdicts, that is direct evidence that an endpoint
// signature is not a diagnosis - which is the whole justification for this replay apparatus.
console.log('\n===== ENDPOINT EQUIVALENCE vs CAUSAL EQUIVALENCE =====');
const byEndpoint = new Map();
for (const r of rows) {
  const o = out.find((x) => x.goal === r.goal && x.seed === r.seed);
  if (!o) continue;
  const sig = r.goal + ' | ' + String(r.final_old_regression_why || r.why || '').slice(0, 58);
  if (!byEndpoint.has(sig)) byEndpoint.set(sig, []);
  byEndpoint.get(sig).push({ seed: r.seed, verdict: o.verdict, k: o.k, depth: r.steps_completed });
}
let divergent = 0;
for (const [sig, list] of byEndpoint) {
  if (list.length < 2) continue;
  const verdicts = new Set(list.map((x) => x.verdict));
  const sites = new Set(list.map((x) => x.k));
  const same = verdicts.size === 1 && sites.size === 1;
  if (!same) divergent++;
  console.log('  ' + (same ? 'same cause   ' : 'DIVERGENT    ') + sig);
  for (const x of list) console.log('      seed ' + x.seed + '  depth ' + x.depth + '  boundary site ' + x.k + '  ' + x.verdict);
}
if (!byEndpoint.size || [...byEndpoint.values()].every((l) => l.length < 2)) {
  console.log('  no two trajectories share an endpoint signature - nothing to compare');
} else if (divergent) {
  console.log('\n  ' + divergent + ' endpoint signature(s) reached by DIFFERENT causes. An endpoint is not a diagnosis.');
} else {
  console.log('\n  every shared endpoint signature also shares its cause, in this panel.');
}
console.log('\n  FIRST_FAILING_SITE is the earliest causal BOUNDARY, not a proof that the site is bad.');
console.log('  Only (b) implicates the snippet itself; (c) failing points the burden upstream of k.');
