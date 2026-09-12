/**
 * compare-setI.mjs - dense 32B vs the MoE 30B on the SAME first twenty goals, same hub, same checker.
 *
 *   node tools/compare-setI.mjs
 *
 * Set H answered "is the hub a ceiling?" (yes, and it is now lower: 49% -> 70% per goal attempted on the 30B).
 * Set I asks the next question: of the ~30% still failing, how much is the MODEL?
 *
 * The comparison is only meaningful on the goals both runs actually reached, so everything here is computed over
 * goals 1-20 for BOTH arms, never over a 100-goal denominator.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const I = join(HERE, '..');                                  // set I
const H = join(I, '..', '2026-09-12-setH');                  // set H, for the MoE arm
const N = 20;

const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
const first20 = (checks) => (checks?.results || []).filter((r) => r.goal <= N);

/** Duplicated definitions, same detector as compare-setH.mjs (noise names excluded, `constructor` deliberately kept). */
const NOISE = /^(if|for|while|switch|catch|return|else|do|try|with|it|describe|test|expect|before|after|beforeEach|afterEach|beforeAll|afterAll)$/;
const PATS = [
  /^[ \t]*def[ \t]+([A-Za-z_]\w*)[ \t]*\(/gm,
  /^[ \t]*(?:async[ \t]+)?function[ \t]+([A-Za-z_$][\w$]*)[ \t]*\(/gm,
  /^[ \t]+(?:async[ \t]+)?([A-Za-z_$][\w$]*)[ \t]*\([^)]*\)[ \t]*\{/gm,
  /^[ \t]*class[ \t]+([A-Za-z_$][\w$]*)/gm,
];
function dupes(wsDir) {
  if (!existsSync(wsDir)) return null;
  const out = [];
  for (const f of readdirSync(wsDir)) {
    if (!/\.(c|m)?js$|\.py$/i.test(f)) continue;
    let src = '';
    try { if (statSync(join(wsDir, f)).isFile()) src = readFileSync(join(wsDir, f), 'utf8'); } catch { continue; }
    const c = new Map();
    for (const re of PATS) for (const m of src.matchAll(re)) { if (!NOISE.test(m[1])) c.set(m[1], (c.get(m[1]) || 0) + 1); }
    const d = [...c.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
    if (d.length) out.push({ file: f, lines: src.split('\n').length, d: d.slice(0, 4) });
  }
  return out;
}

/** How each run ended, from its own records - so "no better" can be attributed to the budget rather than the model. */
function endings(runsDir) {
  if (!existsSync(runsDir)) return null;
  const c = { budget: 0, loop: 0, clean: 0, other: 0 };
  let n = 0;
  for (const f of readdirSync(runsDir).filter((x) => x.endsWith('.json') && !x.includes('transcript'))) {
    let j; try { j = JSON.parse(readFileSync(join(runsDir, f), 'utf8')); } catch { continue; }
    n++;
    const e = (j.steps || []).filter((s) => s.type === 'error').map((s) => String(s.text || '')).join(' ');
    if (/step budget/i.test(e)) c.budget++;
    else if (/same response|identical answer/i.test(e)) c.loop++;
    else if (!e) c.clean++;
    else c.other++;
  }
  return { n, ...c };
}

const arms = [
  { label: 'coder30b-sethfix', name: 'MoE 30B  (Qwen3-Coder-30B-A3B, ~3B active)', dir: H },
  { label: 'coder32b-seti',    name: 'dense 32B (Qwen2.5-Coder-32B)',              dir: I },
];

console.log('\n═══ SET I — dense 32B vs MoE 30B, goals 1-20, identical hub and checker ═══\n');
const rows = [];
for (const a of arms) {
  const checks = readJson(join(a.dir, `${a.label}-checks.json`));
  const r = first20(checks);
  const log = join(a.dir, `${a.label}-set${a.dir === I ? 'I' : 'H'}.log`);
  const attempted = existsSync(log)
    ? [...readFileSync(log, 'utf8').matchAll(/^\s+(\d+)\s+(done|stopped|error|interrupted|failed)\s/gm)].filter((m) => Number(m[1]) <= N).length : 0;
  rows.push({ ...a, present: !!checks, n: r.length, impl: r.filter((x) => x.impl).length, attempted,
    dupes: dupes(join(a.dir, 'data', a.label, 'workspace')), ends: endings(join(a.dir, 'runs', a.label, 'runs')), results: r });
}

console.log('  model                                        attempted(1-20)  correct  rate');
for (const r of rows) {
  if (!r.present) { console.log(`  ${r.name.padEnd(44)} (not finished yet)`); continue; }
  const rate = r.attempted ? Math.round((100 * r.impl) / r.attempted) + '%' : '-';
  console.log(`  ${r.name.padEnd(44)} ${String(r.attempted).padStart(13)}  ${String(r.impl).padStart(7)}  ${rate.padStart(5)}`);
}

const moe = rows[0], dense = rows[1];
if (moe.present && dense.present) {
  const d = dense.impl - moe.impl;
  console.log(`\n─── PREDICTION 1: dense beats the MoE on these twenty ───`);
  console.log(`  MoE ${moe.impl}/${moe.attempted}  ->  dense ${dense.impl}/${dense.attempted}   (${d >= 0 ? '+' : ''}${d})`);
  console.log(`  pre-registered: 16+/20 -> ${dense.impl >= 16 ? 'MET' : 'NOT met'}`);
  console.log('  NOTE: 20 goals is a small denominator. Set H measured +/-1-2 score spread over 54-59 goals, so the');
  console.log('        proportional noise here is LARGER. A 1-2 goal difference means nothing; only a clear margin counts.');

  console.log(`\n─── PREDICTION 2: does it repeat a defect across both passes of a project? ───`);
  console.log('  (the MoE lost 5 goals to one undefined _escape_html and 4 to one missing .s9-right button)');
  for (const r of rows) {
    const byFile = {};
    for (const x of r.results.filter((y) => !y.impl)) {
      const k = String(x.file || '?');
      (byFile[k] = byFile[k] || []).push(String(x.why || '').slice(0, 58));
    }
    const repeats = Object.entries(byFile).filter(([, v]) => v.length > 1);
    console.log(`  ${r.name}:`);
    if (!repeats.length) console.log('      no project failed on BOTH passes');
    for (const [f, v] of repeats) console.log(`      ${f} failed twice: ${v.join(' | ')}`);
  }

  console.log(`\n─── Attribution: was it cut off, or did it get it wrong? ───`);
  for (const r of rows) {
    const e = r.ends;
    if (!e) { console.log(`  ${r.name}: no records`); continue; }
    console.log(`  ${r.name}: ${e.n} runs — ${e.budget} hit the step budget, ${e.loop} loop-guard, ${e.clean} clean`);
  }
  console.log('  A model that hits the 30-call budget was cut off mid-work; that is a BUDGET result, not a capability one.');

  console.log(`\n─── PREDICTION 4 carried over: duplicated definitions ───`);
  for (const r of rows) {
    if (!r.dupes) { console.log(`  ${r.name}: no workspace`); continue; }
    if (!r.dupes.length) { console.log(`  ${r.name}: none`); continue; }
    console.log(`  ${r.name}: ${r.dupes.length} file(s)`);
    for (const x of r.dupes.slice(0, 3)) console.log(`      ${x.file} (${x.lines} lines): ${x.d.map(([n, c]) => n + ' x' + c).join(', ')}`);
  }

  console.log('\n─── What this CANNOT settle ───');
  console.log('  Twenty goals give each project two passes, so compounding barely has room to appear. A good score here');
  console.log('  shows competence at single steps, not that the model survives 100 interleaved goals.');
  console.log('  If the dense model scores the same, the remaining failures are NOT raw capability, and the work belongs');
  console.log('  in self-verification (run the file after writing; refuse a finish whose own imports do not resolve).\n');
}
