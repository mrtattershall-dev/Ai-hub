// THE GATE AGAINST REAL RECORDED TRAJECTORIES.
//
// The witness suite is hand-built from defects already known, so passing it only shows the gate encodes
// what I already found. The honest test is recorded data the gate has never seen:
//
//   1 FALSE REFUSAL ON THE ONLY REAL SUCCESS. 7B B3 goal 74 seed 34 is the single verified end-to-end
//     trajectory in this entire sequence. If the gate refuses any of its three snippets it would have
//     destroyed the only success, and nothing else about it matters.
//   2 YIELD. Of the steps that went on to break something, how many would have been refused BEFORE the
//     state was committed?
//   3 COVERAGE. What fraction of all steps survive the gate? A gate that refuses most of them buys
//     safety by doing nothing.
//
// Only generation-time information is used: the snippet text and the source it is being inserted into.
// No load result, no regression result, no probe.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SITES, locate } from './oraclesites.mjs';
import { gateSnippet } from './refusalgate.mjs';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const NL = String.fromCharCode(10);
const world = new Map();
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) world.set(f, readFileSync(p));
  }
}
const created = ['ol_items', 'fence'];
const indentOf = (l) => (l.match(/^[ \t]*/) || [''])[0].length;
function boundToSite(snippet, indent, src) {
  const structural = new Set(src.split(NL).map((l) => l.trim()).filter((l) => l.length > 3));
  const lines = snippet.split(NL);
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
  return keep.join(NL) + NL;
}

const RUNS = process.argv.slice(2).map((s) => { const [label, dir] = s.split('='); return { label, dir }; });
const all = [];

for (const { label, dir } of RUNS) {
  let rows;
  try { rows = JSON.parse(readFileSync(join(dir, 'rows.json'), 'utf8')); } catch (e) { continue; }
  const B = rows.filter((r) => r.condition === 'B_oracle_localized_insertion');
  for (const r of B) {
    const spec = SITES[r.goal];
    let cur = world.get(spec.file).toString('utf8');
    for (let i = 0; i < r.steps.length; i++) {
      const s = r.steps[i];
      const site = spec.sites[i];
      if (!site) break;
      // Prefer the FROZEN bound snippet when the run recorded one; fall back to reconstruction.
      let snip = s.bound_snippet;
      if (snip === undefined) {
        if (!s.wire_id) break;
        let reply;
        try { reply = readFileSync(join(dir, 'replies', s.wire_id + '.reply.txt'), 'utf8'); } catch (e) { break; }
        snip = (r.route === 'indent_primer' ? ' '.repeat(site.indent) : '') + reply;
        if (s.bound_stopped_by !== undefined) snip = boundToSite(snip, site.indent, cur);
      }
      const g = gateSnippet(cur, snip, spec, site, created);
      all.push({ label, goal: r.goal, seed: r.seed, site: i + 1,
        verdict: g.verdict, kinds: g.reasons.map((x) => x.kind),
        loaded: s.loads_after, preserved: s.old_regression_after,
        wouldBreak: s.loads_after === false || s.old_regression_after === false,
        verifiedTrajectory: !!r.verified });
      // Advance only if the run advanced.
      const l = locate(cur, site);
      if (!l.ok || s.loads_after === false) break;
      cur = l.before + snip + l.after;
    }
  }
}

console.log('  GATE vs RECORDED TRAJECTORIES  (generation-time information only)\n');

// 1 the only real success must survive
const verified = all.filter((x) => x.verifiedTrajectory);
console.log('=== 1 FALSE REFUSAL ON THE ONLY VERIFIED TRAJECTORY ===');
if (!verified.length) console.log('  no verified trajectory in these runs');
else {
  for (const v of verified) {
    console.log('  ' + v.label + '  g' + v.goal + ' s' + v.seed + ' site ' + v.site + '  ' + v.verdict
      + (v.kinds.length ? '  ' + v.kinds.join(',') : ''));
  }
  const refused = verified.filter((v) => v.verdict === 'REFUSE').length;
  console.log('  -> ' + (refused === 0
    ? 'SURVIVES. The gate would not have destroyed the only end-to-end success.'
    : 'FALSE REFUSAL on ' + refused + ' of its ' + verified.length + ' steps - the gate would have killed the only success.'));
}

// 2 yield and 3 coverage
console.log('\n=== 2 YIELD: steps that went on to break something ===');
const breaking = all.filter((x) => x.wouldBreak);
const caught = breaking.filter((x) => x.verdict === 'REFUSE');
console.log('  steps that broke load or preservation   ' + breaking.length);
console.log('  of those, refused BEFORE commit        ' + caught.length + '/' + breaking.length
  + (breaking.length ? '   (' + Math.round(100 * caught.length / breaking.length) + '%)' : ''));
const byKind = new Map();
for (const c of caught) for (const k of c.kinds) byKind.set(k, (byKind.get(k) || 0) + 1);
for (const [k, n] of [...byKind].sort((a, b) => b[1] - a[1])) console.log('    ' + n + 'x  ' + k);

console.log('\n=== 3 COVERAGE: does the gate buy safety by doing nothing? ===');
const good = all.filter((x) => !x.wouldBreak);
const falseRef = good.filter((x) => x.verdict === 'REFUSE');
console.log('  total steps evaluated                  ' + all.length);
console.log('  admitted                               ' + all.filter((x) => x.verdict === 'ADMIT').length
  + '   uncertain ' + all.filter((x) => x.verdict === 'UNCERTAIN').length
  + '   refused ' + all.filter((x) => x.verdict === 'REFUSE').length);
console.log('  steps that did NOT break anything      ' + good.length);
console.log('  of those, wrongly refused              ' + falseRef.length + '/' + good.length
  + (good.length ? '   (' + Math.round(100 * falseRef.length / good.length) + '% false refusal)' : ''));
for (const f of falseRef.slice(0, 6)) {
  console.log('    ' + f.label + ' g' + f.goal + ' s' + f.seed + ' site ' + f.site + '  ' + f.kinds.join(','));
}

console.log('\n===== SUMMARY =====');
console.log('  A gate is only useful if it refuses harmful steps at a materially higher rate than');
console.log('  harmless ones. Here: ' + caught.length + '/' + breaking.length + ' harmful refused vs '
  + falseRef.length + '/' + good.length + ' harmless refused.');
