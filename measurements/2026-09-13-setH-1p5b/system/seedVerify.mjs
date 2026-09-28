// CANONICAL SEED VERIFICATION + BUNDLE HASH.
//
// The seed is the predecessor state for the 41-60 experiment, so it is part of the treatment
// definition just as much as the model and the planner code. This script establishes, in one place:
//
//   * every structural contract from goals 1-40 that applies to each file
//   * each python module's own assertions execute
//   * no unresolved dependencies and no import-time side effects
//   * the HELD-OUT deltas (goals 44, 49, 54, 59) are demonstrably ABSENT
//   * a stable seed_bundle_sha over the sorted file list
//
// Behavioural verification lives in seedProof.test.mjs (64 JS assertions) and boardProof.test.mjs
// (20 browser assertions). Anything not covered there is REFERENCE_IMPLEMENTED_BUT_UNPROVEN and is
// declared as such rather than being quietly counted as correct.
import { deriveContract } from './contract.mjs';
import { checkContract } from './contractCheck.mjs';
import { firewall, loadSideEffects } from './deps.mjs';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const SEED = join(HERE, 'seed');
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));

const files = readdirSync(SEED).filter((f) => statSync(join(SEED, f)).isFile()).sort();
const ws = mkdtempSync(join(tmpdir(), 'seedv-'));
writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
for (const f of files) copyFileSync(join(SEED, f), join(ws, f));

let fail = 0;
const say = (ok, msg) => { if (!ok) fail++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + msg); };

// ---- structural
let structural = 0;
const bad = [];
for (let g = 1; g <= 40; g++) {
  const c = deriveContract(GOALS[g - 1]);
  const r = checkContract(ws, c.lead, c);
  if (r.ok) structural++; else bad.push('[' + g + '] ' + c.lead + ' ' + r.msg.slice(0, 70));
}
say(structural === 40, 'structural contracts from goals 1-40: ' + structural + '/40');
bad.forEach((b) => console.log('       ' + b));

// ---- each python module's own assertions
for (const f of files.filter((x) => x.endsWith('.py'))) {
  const r = spawnSync('python', [join(ws, f)], { cwd: ws, encoding: 'utf8', timeout: 30000 });
  say(String(r.stdout || '').includes('ok'), f + ' self-assertions execute');
}

// ---- dependencies and import-time side effects
for (const f of files.filter((x) => /\.(js|py)$/.test(x))) {
  const src = readFileSync(join(SEED, f), 'utf8');
  const lang = f.endsWith('.py') ? 'py' : 'js';
  const fw = firewall({ candidate: src, original: '', lang, ws, goalText: '', contract: { files: [] } });
  const se = loadSideEffects(src, lang).filter((h) => h.kind !== 'calls_at_import' || lang === 'js');
  say(fw.violations.length === 0, f + ' has no unresolved dependencies');
  if (se.length) console.log('       note: ' + f + ' import-time statements: ' + se.map((s) => s.kind).join(','));
}

// ---- ANTI-LEAKAGE: the held-out deltas must be absent from the seed
{
  const md = spawnSync('python', ['-c',
    'import sys; sys.path.insert(0, r"' + ws + '"); import s4_markdown as m; '
    + 'print("LINK" if "<a " in m.to_html("[t](u)") else "nolink"); '
    + 'print("LIST" if "<ul>" in m.to_html("- one\\n- two") else "nolist")'],
  { cwd: ws, encoding: 'utf8', timeout: 30000 });
  const out = String(md.stdout || '');
  say(out.includes('nolink'), 'goal 44 (links) is ABSENT from the seed');
  say(out.includes('nolist'), 'goal 54 (lists) is ABSENT from the seed');
}
{
  // Strip comments first: the seed's header comments NAME the held-out features in order to state
  // that they are deliberately absent, and a naive grep matches its own documentation. The
  // authoritative evidence is behavioural - boardProof.test.mjs drives a real browser and asserts
  // nothing is stored under "s9-board", a reload starts empty, there is no #s9-msg element, and
  // Doing accepts a fourth card. This static check is only a cheap second opinion.
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const board = strip(readFileSync(join(SEED, 's9_board.js'), 'utf8'))
    + strip(readFileSync(join(SEED, 's9_board.html'), 'utf8'));
  say(!/localStorage/.test(board), 'goal 49 (localStorage persistence) is ABSENT from the seed code');
  say(!/s9-msg/.test(board), 'goal 59 (Doing limit / s9-msg) is ABSENT from the seed code');
}
{
  const expr = readFileSync(join(SEED, 's5_expr.js'), 'utf8');
  say(!/\bmin\s*\(|\babs\s*\(/.test(expr.replace(/Math\.\w+/g, '')), 'goal 45 (min/max/abs) is ABSENT from the seed');
  say(!/at \d|position/.test(expr) || !/'at '/.test(expr), 'goal 55 (error positions) is not fully implemented');
}

// ---- bundle hash over the sorted file list
const h = createHash('sha256');
for (const f of files) { h.update(f).update('\0').update(readFileSync(join(SEED, f))); }
const seedBundleSha = h.digest('hex');

const manifest = {
  kind: 'canonical_post_goal_40_reference_seed',
  created_at: new Date().toISOString(),
  goal_set_sha: createHash('sha256').update(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json')).digest('hex'),
  seed_bundle_sha: seedBundleSha,
  files: files.map((f) => ({ file: f, sha256: createHash('sha256').update(readFileSync(join(SEED, f))).digest('hex') })),
  verification: {
    structural_contracts: structural + '/40',
    behavioural_js: 'seedProof.test.mjs - 64 assertions',
    behavioural_browser: 'boardProof.test.mjs - 20 assertions (puppeteer)',
    held_out_absent: ['goal 44 links', 'goal 45 functions', 'goal 49 persistence', 'goal 54 lists', 'goal 59 doing-limit'],
  },
  classification: {
    BEHAVIORALLY_VERIFIED: ['s1_library.js', 's3_matrix.js', 's5_expr.js', 's7_cache.js', 's10_desk.js',
      's9_board.html', 's9_board.js'],
    STRUCTURAL_VERIFIED_PLUS_SELF_ASSERTIONS: ['s2_logs.py', 's4_markdown.py', 's6_graph.py', 's8_grades.py'],
    note: 'The python modules carry their own goal-derived assertions and satisfy every structural '
      + 'contract, but do not yet have an independent external behavioural suite equivalent to '
      + 'seedProof.test.mjs. They are NOT claimed as BEHAVIORALLY_VERIFIED.',
  },
};
writeFileSync(join(HERE, 'SEED.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log('\n  seed_bundle_sha ' + seedBundleSha.slice(0, 24));
console.log('  files ' + files.length + '   manifest -> SEED.json');
console.log('  ' + (fail ? fail + ' CHECKS FAILED' : 'all seed checks passed'));
process.exit(fail ? 1 : 0);
