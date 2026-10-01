// CMP-1 — the three disposition rules, applied deterministically to fixed specimens. $0, no model.
//
//   node cmp_dispositions.mjs   -> JSON verdict
//
// The question the paid live run (CMP-LIVE) will then measure by FREQUENCY, this answers by CAPABILITY:
// given a candidate, which arms catch damage, and does any arm wrongly refuse clean work?
//
//   BASELINE      node --check only (parse)                      — the ordinary hub's syntactic floor
//   SIMPLE_GUARD  parse + load the module (require); refuse if it throws — the cheap ordinary-path fix
//   LEGASUS       run the behavioral checks (seed + earlier increments); refuse if any FAIL
//
// "catch" = refuse a damaging candidate. "false refusal" = refuse a clean one. A specimen is damaging iff
// it fails its own increment's protected check (seed + every earlier increment) — the frozen definition of
// damage used throughout INC-1/INC-1B.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync, existsSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC = join(HERE, 'specimens');
const S = 'file://' + join(HERE, '..', '..', 'server', 'inc1Fixture.js').split('\\').join('/');
const { SEED, INCREMENTS, protectedFor } = await import(S);
const SEED_SCRIPT = protectedFor(1).script;   // the seed check alone

// A specimen declares the increment it sits at; the rest of the workspace is the correct state up to k-1.
const SPECIMENS = [
  { cls: 'A', k: 2, dir: 'A_load_throw/baseline1-k2-total-undef.js', single: 'inventory.js', damaging: true },
  { cls: 'A', k: 1, dir: 'A_load_throw/baseline4-k1-remove-undef.js', single: 'inventory.js', damaging: true },
  { cls: 'A', k: 3, dir: 'A_load_throw/baseline8-k3-restock-undef.js', single: 'inventory.js', damaging: true },
  { cls: 'A', k: 3, dir: 'A_load_throw/governed5-k3-restock-undef.js', single: 'inventory.js', damaging: true },
  { cls: 'B', k: 2, dir: 'B_loads_breaks_earlier/k2-breaks-inc1', damaging: true },
  { cls: 'B', k: 3, dir: 'B_loads_breaks_earlier/k3-breaks-inc2', damaging: true },
  { cls: 'B', k: 4, dir: 'B_loads_breaks_earlier/k4-breaks-inc3', damaging: true },
  { cls: 'clean', k: 1, dir: 'clean/k1', damaging: false },
  { cls: 'clean', k: 2, dir: 'clean/k2', damaging: false },
  { cls: 'clean', k: 3, dir: 'clean/k3', damaging: false },
  { cls: 'clean', k: 4, dir: 'clean/k4', damaging: false },
];

// Build the candidate workspace: the correct accumulated state up to k-1, then the specimen's file(s)
// overlaid — exactly the shape a finish boundary meets.
function materialise(sp) {
  const ws = mkdtempSync(join(tmpdir(), 'cmp-'));
  const base = {};
  base['package.json'] = SEED['package.json'];
  base['report.js'] = SEED['report.js'];
  for (let i = 0; i < sp.k - 1; i++) Object.assign(base, INCREMENTS[i].reference);
  for (const [f, b] of Object.entries(base)) writeFileSync(join(ws, f), b);
  const src = join(SPEC, sp.dir);
  if (sp.single) cpSync(src, join(ws, sp.single));
  else for (const f of readdirSync(src)) cpSync(join(src, f), join(ws, f));
  return ws;
}

const node = (ws, args) => { try { execFileSync(process.execPath, args, { cwd: ws, stdio: 'pipe' }); return { ok: true }; } catch (e) { return { ok: false, err: String(e.stderr || e.message).split('\n')[0].slice(0, 80) }; } };

function armBaseline(ws) {   // parse only
  const r = node(ws, ['--check', 'inventory.js']);
  return r.ok ? { refuse: false } : { refuse: true, why: 'parse: ' + r.err };
}
function armSimpleGuard(ws) {   // parse + load
  const p = node(ws, ['--check', 'inventory.js']);
  if (!p.ok) return { refuse: true, why: 'parse: ' + p.err };
  const l = node(ws, ['-e', "require('./inventory.js'); require('./report.js')"]);
  return l.ok ? { refuse: false } : { refuse: true, why: 'load: ' + l.err };
}
function armLegasus(ws, k) {   // behavioral: seed + every earlier increment's check must pass
  const scripts = [SEED_SCRIPT, ...Array.from({ length: k - 1 }, (_, i) => INCREMENTS[i].requested.script)];
  for (let i = 0; i < scripts.length; i++) {
    const m = scripts[i].match(/^node -e (.*)$/s);
    // The fixture scripts hardcode /candidate/ (the Docker worker mount). Here the workspace is the cwd,
    // so rewrite /candidate/ -> ./ — the SAME module, local path. Without this the check fails on a
    // module-not-found and would "catch" everything (and false-refuse clean work); the clean controls
    // exposed exactly that. Baseline and simpleGuard already use ./ relative paths.
    const expr = (m ? JSON.parse(m[1]) : scripts[i]).replace(/\/candidate\//g, './');
    const r = node(ws, ['-e', expr]);
    if (!r.ok) return { refuse: true, why: (i === 0 ? 'seed' : 'inc' + i) + ' check failed: ' + r.err };
  }
  return { refuse: false };
}

const rows = [];
for (const sp of SPECIMENS) {
  const ws = materialise(sp);
  try {
    const b = armBaseline(ws); const g = armSimpleGuard(ws); const l = armLegasus(ws, sp.k);
    const score = (arm) => sp.damaging ? (arm.refuse ? 'CAUGHT' : 'MISSED') : (arm.refuse ? 'FALSE_REFUSAL' : 'OK');
    rows.push({ cls: sp.cls, k: sp.k, specimen: sp.dir, damaging: sp.damaging,
      baseline: score(b), simpleGuard: score(g), legasus: score(l),
      why: { baseline: b.why || null, simpleGuard: g.why || null, legasus: l.why || null } });
  } finally { rmSync(ws, { recursive: true, force: true }); }
}

const arms = ['baseline', 'simpleGuard', 'legasus'];
const dmg = rows.filter((r) => r.damaging); const clean = rows.filter((r) => !r.damaging);
const summary = {};
for (const a of arms) summary[a] = {
  caught: dmg.filter((r) => r[a] === 'CAUGHT').length, missed: dmg.filter((r) => r[a] === 'MISSED').length,
  caughtA: dmg.filter((r) => r.cls === 'A' && r[a] === 'CAUGHT').length,
  caughtB: dmg.filter((r) => r.cls === 'B' && r[a] === 'CAUGHT').length,
  falseRefusals: clean.filter((r) => r[a] === 'FALSE_REFUSAL').length,
};
console.log(JSON.stringify({ sim: 'CMP-1', damaging: dmg.length, clean: clean.length, classA: dmg.filter((r) => r.cls === 'A').length, classB: dmg.filter((r) => r.cls === 'B').length, summary, rows }, null, 1));
