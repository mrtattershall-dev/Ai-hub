// STATE-CONTINUITY AUDIT. Is the experiment measuring the causal chain it claims to?
//
// There are five notions of "current program state" in this apparatus:
//   1 the candidate file after a model edit
//   2 the reference/oracle file
//   3 the state used to resolve the NEXT anchor
//   4 the state the STRICT preservation probe reads
//   5 the state the 2x2 counterfactual replay reconstructs
// If any one advances differently, every local result can look legitimate while the measured causal
// chain is the wrong one. tatte's invariant: output(site N) == input(site N+1), for every branch that
// claims continuity.
//
// This audits recorded runs, with one live check that re-derives the bound. Suspect ordering follows
// the harness's own history: the nastiest bugs so far lived where everything still "worked".
import { readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SITES, locate } from './oraclesites.mjs';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const short = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const indentOf = (l) => (l.match(/^[ \t]*/) || [''])[0].length;

function boundToSite(snippet, indent, src) {
  const structural = new Set(src.split('\n').map((l) => l.trim()).filter((l) => l.length > 3));
  const lines = snippet.split('\n');
  const keep = [];
  let stoppedBy = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const t = l.trim();
    if (i > 0) {
      if (t && indentOf(l) < indent) { stoppedBy = 'dedent_below_site'; break; }
      if (/^#/.test(t) && /WRITE ONLY|REQUESTED CHANGE|AUTHORITATIVE|MARKER/i.test(t)) { stoppedBy = 'instruction_echo'; break; }
      if (/^(def|for|while|class)\b/.test(t) && structural.has(t)) { stoppedBy = 'redeclares_existing'; break; }
    }
    keep.push(l);
  }
  while (keep.length && !keep[keep.length - 1].trim()) keep.pop();
  return { text: keep.join('\n') + '\n', stoppedBy };
}

const world = new Map();
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) world.set(f, readFileSync(p));
  }
}

const RUNS = process.argv.slice(2);
let failures = 0;

for (const dir of RUNS) {
  let rows;
  try { rows = JSON.parse(readFileSync(join(dir, 'rows.json'), 'utf8')); } catch (e) { console.log('  skip ' + dir); continue; }
  const B = rows.filter((r) => r.condition === 'B_oracle_localized_insertion');
  console.log('===== ' + dir.split(/[\\/]/).pop() + '  (' + B.length + ' trajectories) =====');

  // INVARIANT 1: output(site N) == input(site N+1) on every step the chain claims to have advanced.
  let chainChecked = 0; let chainBad = 0;
  for (const r of B) {
    for (let i = 0; i + 1 < r.steps.length; i++) {
      const a = r.steps[i];
      const b = r.steps[i + 1];
      if (a.source_sha_after === undefined || b.source_sha_before === undefined) continue;
      chainChecked++;
      if (a.source_sha_after !== b.source_sha_before) {
        chainBad++;
        console.log('  BREAK  g' + r.goal + ' s' + r.seed + '  site ' + (i + 1) + ' -> ' + (i + 2)
          + '  after=' + a.source_sha_after + '  next before=' + b.source_sha_before);
      }
    }
  }
  console.log('  1 chain continuity      ' + (chainChecked - chainBad) + '/' + chainChecked + ' transitions hold');
  if (chainBad) failures++;

  // INVARIANT 2: a step that did NOT advance the chain must not have handed its state forward.
  // A step whose load failed, or which broke preservation under STRICT, is an abort - the next step
  // should not exist at all.
  let leaked = 0;
  for (const r of B) {
    for (let i = 0; i < r.steps.length; i++) {
      const s = r.steps[i];
      const dead = s.loads_after === false || (r.route && s.old_regression_after === false);
      if (dead && i + 1 < r.steps.length) {
        leaked++;
        console.log('  LEAK   g' + r.goal + ' s' + r.seed + '  site ' + (i + 1)
          + ' was dead (loads=' + s.loads_after + ' oldreg=' + s.old_regression_after + ') yet site '
          + (i + 2) + ' ran');
      }
    }
  }
  console.log('  2 no state past a dead step  ' + (leaked === 0 ? 'holds' : leaked + ' LEAKS'));
  if (leaked) failures++;

  // INVARIANT 3: REPLAY FIDELITY. The replay re-derives each snippet from the reply bytes and re-applies
  // the bound against ITS OWN current source. If the bound is state-dependent, the snippet the replay
  // uses is not the snippet the run used - and then (b) is not "the same snippet on better
  // predecessors", it is a different snippet entirely. This re-derives step 1, where the replay's base
  // state is provably identical to the run's, so any mismatch is a reconstruction bug rather than
  // divergence.
  let fidChecked = 0; let fidBad = 0;
  for (const r of B) {
    const s = r.steps[0];
    if (!s || !s.wire_id || s.generated_bytes === undefined) continue;
    let reply;
    try { reply = readFileSync(join(dir, 'replies', s.wire_id + '.reply.txt'), 'utf8'); } catch (e) { continue; }
    const spec = SITES[r.goal];
    const site = spec.sites[0];
    const src0 = world.get(spec.file).toString('utf8');
    let snip = (r.route === 'indent_primer' ? ' '.repeat(site.indent) : '') + reply;
    if (s.bound_stopped_by !== undefined) snip = boundToSite(snip, site.indent, src0).text;
    fidChecked++;
    if (snip.length !== s.generated_bytes) {
      fidBad++;
      console.log('  FIDELITY g' + r.goal + ' s' + r.seed + ' site 1  recorded ' + s.generated_bytes
        + 'B, re-derived ' + snip.length + 'B');
    }
  }
  console.log('  3 replay re-derives step 1 exactly  ' + (fidChecked - fidBad) + '/' + fidChecked);
  if (fidBad) failures++;

  // INVARIANT 4: is the BOUND state-dependent? If truncation depends on the surrounding source, then a
  // counterfactual that changes predecessors also changes the snippet, and (b) does not isolate what it
  // claims to. Re-derive each step-1 snippet against the ORIGINAL source and against a source that has
  // the full reference patch applied, and compare.
  let stateDep = 0; let stateChecked = 0;
  for (const r of B) {
    const s = r.steps[0];
    if (!s || !s.wire_id || s.bound_stopped_by === undefined) continue;
    let reply;
    try { reply = readFileSync(join(dir, 'replies', s.wire_id + '.reply.txt'), 'utf8'); } catch (e) { continue; }
    const spec = SITES[r.goal];
    const site = spec.sites[0];
    let patched = world.get(spec.file).toString('utf8');
    for (const st of spec.sites) { const l = locate(patched, st); if (l.ok) patched = l.before + st.reference + l.after; }
    const base = ' '.repeat(site.indent) + reply;
    const a = boundToSite(base, site.indent, world.get(spec.file).toString('utf8')).text;
    const b = boundToSite(base, site.indent, patched).text;
    stateChecked++;
    if (a !== b) {
      stateDep++;
      console.log('  STATE-DEPENDENT BOUND  g' + r.goal + ' s' + r.seed
        + '  original-source bound ' + a.length + 'B vs patched-source bound ' + b.length + 'B');
    }
  }
  console.log('  4 bound is state-INdependent  ' + (stateChecked - stateDep) + '/' + stateChecked
    + (stateDep ? '   <-- (b) does not isolate predecessor state for these' : ''));
  if (stateDep) failures++;

  console.log('');
}

// INVARIANT 5: DELTA REPRESENTABILITY, already settled by the reference control but asserted here
// rather than assumed - the exposed sites must be sufficient to implement the delta.
console.log('===== 5 delta representability (no model) =====');
for (const goal of [64, 74]) {
  const spec = SITES[goal];
  let src = world.get(spec.file).toString('utf8');
  let ok = true;
  for (const st of spec.sites) {
    const l = locate(src, st);
    if (!l.ok) { ok = false; console.log('  goal ' + goal + ' anchor problem: ' + l.why); break; }
    src = l.before + st.reference + l.after;
  }
  if (!ok) { failures++; continue; }
  const ws = mkdtempSync(join(tmpdir(), 'cont-'));
  for (const [f, b] of world) writeFileSync(join(ws, f), b);
  writeFileSync(join(ws, spec.file), src, 'utf8');
  const { probe60For } = await import('./probes60.mjs');
  const { regressionFor } = await import('./regression.mjs');
  const delta = probe60For(goal).run(ws);
  const reg = regressionFor(spec.file)(ws);
  console.log('  goal ' + goal + '  reference-only sites: old=' + reg.pass + '  delta=' + delta.pass
    + (delta.pass && reg.pass ? '   -> the exposed sites ARE sufficient' : '   <-- sites are NOT sufficient'));
  if (!delta.pass || !reg.pass) failures++;
}

console.log('\n' + (failures ? '  ' + failures + ' INVARIANT GROUP(S) FAILED' : '  all invariants hold'));
