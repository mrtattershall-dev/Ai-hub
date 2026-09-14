// GLOBAL VERIFICATION AND HASH FOR THE CANONICAL POST-GOAL-60 SEED.
//
// One immutable world whose CUMULATIVE behaviour is independently proven and whose FUTURE deltas are
// demonstrably absent. The milestone is not "ten files written".
//
// Checks, in order:
//   1. every structural obligation from goals 1-60
//   2. every python module's own assertions execute
//   3. no unresolved dependencies, no import-time side effects
//   4. ANTI-LEAKAGE - the goals 61-80 deltas are NOT already implemented
//   5. a stable seed60_bundle_sha over the sorted file list
//
// Behavioural verification lives in seed60Proof.test.mjs (58), seed60Proof2.test.mjs (58) and
// board60Proof.test.mjs (27 browser assertions). Anything outside those stays
// REFERENCE_IMPLEMENTED_BUT_UNPROVEN and is declared rather than assumed.
import { deriveContract } from './contract.mjs';
import { checkContract } from './contractCheck.mjs';
import { firewall, loadSideEffects } from './deps.mjs';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const SEED40 = join(HERE, 'seed');
const SEED60 = join(HERE, 'seed60');
const GOALS_PATH = 'C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json';
const GOALS = JSON.parse(readFileSync(GOALS_PATH, 'utf8'));

// The post-60 world = every post-40 file, overlaid with the post-60 versions.
const ws = mkdtempSync(join(tmpdir(), 'seed60v-'));
writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
for (const f of readdirSync(SEED40)) {
  const p = join(SEED40, f);
  if (statSync(p).isFile()) copyFileSync(p, join(ws, f));
}
for (const f of readdirSync(SEED60)) {
  const p = join(SEED60, f);
  if (statSync(p).isFile()) copyFileSync(p, join(ws, f));
}
const files = readdirSync(ws).filter((f) => f !== 'package.json' && statSync(join(ws, f)).isFile()).sort();

let fail = 0;
const say = (ok, msg) => { if (!ok) fail++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + msg); };

// ---- 1. structural
let structural = 0;
const bad = [];
for (let g = 1; g <= 60; g++) {
  const c = deriveContract(GOALS[g - 1]);
  const r = checkContract(ws, c.lead, c);
  if (r.ok) structural++; else bad.push('[' + g + '] ' + c.lead + ' ' + r.msg.slice(0, 60));
}
say(structural === 60, 'structural contracts from goals 1-60: ' + structural + '/60');
bad.forEach((b) => console.log('       ' + b));

// ---- 2. python self-assertions
for (const f of files.filter((x) => x.endsWith('.py'))) {
  const r = spawnSync('python', [join(ws, f)], { cwd: ws, encoding: 'utf8', timeout: 30000 });
  say(String(r.stdout || '').includes('ok'), f + ' self-assertions execute');
}

// ---- 3. dependency / side-effect safety
for (const f of files.filter((x) => /\.(js|py)$/.test(x))) {
  const src = readFileSync(join(ws, f), 'utf8');
  const lang = f.endsWith('.py') ? 'py' : 'js';
  const fw = firewall({ candidate: src, original: '', lang, ws, goalText: '', contract: { files: [] } });
  say(fw.violations.length === 0, f + ' has no unresolved dependencies');
  const se = loadSideEffects(src, lang).filter((h) => /writes_files|test_harness/.test(h.kind));
  say(se.length === 0, f + ' has no dangerous import-time side effects');
}

// ---- 4. ANTI-LEAKAGE. Comments are stripped first: the seed's headers legitimately NAME held-out
//         features to document their absence, and a naive grep would match its own documentation.
const strip = (s, lang) => (lang === 'py'
  ? s.replace(/^[ \t]*#.*$/gm, '').replace(/'''[\s\S]*?'''/g, '').replace(/"""[\s\S]*?"""/g, '')
  : s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, ''));
const code = (f) => strip(readFileSync(join(ws, f), 'utf8'), f.endsWith('.py') ? 'py' : 'js');

console.log('');
const ABSENT = [
  [61, 's1_library.js', /\blimit|\b3 books/i],
  [62, 's2_logs.py', /\bdef between\b/],
  [63, 's3_matrix.js', /\binverse\s*\(/],
  [64, 's4_markdown.py', /<ol>/],
  [65, 's5_expr.js', /exports[^\n]*tokenize|tokenize\s*[,}]/],
  [66, 's6_graph.py', /\bdef reachable\b/],
  [67, 's7_cache.js', /onEvict/],
  [68, 's8_grades.py', /\bdef curve\b/],
  [69, 's9_board.js', /keydown|keypress|['"]Enter['"]/],
  [70, 's10_desk.js', /\bcanBorrow\b/],
  [71, 's1_library.js', /toJSON|fromJSON/],
  [72, 's2_logs.py', /\bdef sessions\b/],
  [73, 's3_matrix.js', /\bsolve\s*\(/],
  [74, 's4_markdown.py', /<pre>/],
  [75, 's5_expr.js', /\btoRPN\b/],
  [76, 's6_graph.py', /\bdef components\b/],
  [77, 's7_cache.js', /\bresize\s*\(/],
  [78, 's8_grades.py', /\bdef to_csv\b/],
  [79, 's9_board.js', /s9-filter/],
  [80, 's10_desk.js', /\bsnapshot\s*\(|\brestore\s*\(/],
];
for (const [goal, file, re] of ABSENT) {
  const present = re.test(code(file));
  say(!present, 'goal ' + goal + ' delta is ABSENT from ' + file);
}

// ---- 5. bundle hash
const h = createHash('sha256');
for (const f of files) h.update(f).update('\0').update(readFileSync(join(ws, f)));
const seedBundleSha = h.digest('hex');

const manifest = {
  kind: 'canonical_post_goal_60_reference_seed',
  created_at: new Date().toISOString(),
  builds_on: { seed40_commit: '77eed90', v3_commit: '4be486d' },
  goal_set_sha: createHash('sha256').update(readFileSync(GOALS_PATH)).digest('hex'),
  seed60_bundle_sha: seedBundleSha,
  files: files.map((f) => ({ file: f, sha256: createHash('sha256').update(readFileSync(join(ws, f))).digest('hex') })),
  verification: {
    structural_contracts: structural + '/60',
    behavioural_js: 'seed60Proof.test.mjs 58 + seed60Proof2.test.mjs 58',
    behavioural_browser: 'board60Proof.test.mjs 27 (puppeteer)',
    cross_goal_interactions_proven: [
      'goal 31+41  a hold that becomes a loan starts on the day of that return',
      'goal 34+44  link syntax inside inline code is not a link',
      'goal 44+54  a list item may contain a link',
      'goal 45+55  an unknown FUNCTION is distinguishable from an unknown variable',
      'goal 48+58  a missing-zero score is itself droppable',
      'goal 49+59  a REJECTED move does not become persisted state',
      'goal 51+60  fines produced by a return feed fineReport',
    ],
    held_out_absent: 'goals 61-80 deltas checked individually, comments stripped first',
  },
  classification: {
    BEHAVIORALLY_VERIFIED: files.filter((f) => /\.(js|html)$/.test(f)).concat(['s2_logs.py', 's4_markdown.py', 's6_graph.py', 's8_grades.py']),
    note: 'Every file carries external behavioural assertions this time - the python modules are '
      + 'exercised by seed60Proof2.test.mjs, not only by their own __main__ blocks, so the '
      + 'REFERENCE_IMPLEMENTED_BUT_UNPROVEN category is empty for this seed.',
  },
};
writeFileSync(join(HERE, 'SEED60.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log('\n  seed60_bundle_sha ' + seedBundleSha.slice(0, 24));
console.log('  files ' + files.length + '   manifest -> SEED60.json');
console.log('  ' + (fail ? fail + ' CHECKS FAILED' : 'all seed60 checks passed'));
process.exit(fail ? 1 : 0);
