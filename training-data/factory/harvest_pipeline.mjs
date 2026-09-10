/**
 * harvest_pipeline.mjs - clone permissive repos, extract candidate rows, throw the clone away.
 *
 *   node factory/harvest_pipeline.mjs <repos.json> --kind js    --out harvest_js.jsonl
 *   node factory/harvest_pipeline.mjs <repos.json> --kind godot --out harvest_godot.jsonl
 *   node factory/harvest_pipeline.mjs <repos.json> --kind js --limit 20 --out probe.jsonl
 *
 * WHY IT IS SHAPED THIS WAY
 * -------------------------
 * ~800 repos will not sit on disk at once, so each is shallow-cloned, mined, and deleted
 * before the next. Rows are appended as they are found: the 32B eval lost 19 paid-for
 * generations by holding results in memory until the end, and a 6-hour harvest is a far
 * bigger thing to lose.
 *
 * Every row records its repo, path and licence. That is not bookkeeping - a dataset whose
 * provenance cannot be reconstructed cannot be defended later, and the licence question
 * ("may this be trained on, may it be redistributed") is answered per row or not at all.
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, rmSync, readdirSync, statSync } from 'fs';
import { rowsForFile } from './harvest_one.mjs';
import { join, extname, relative, sep } from 'path';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i > -1 && args[i + 1] ? args[i + 1] : d; };
const REPOS = args.find((a) => !a.startsWith('--') && /\.json$/i.test(a));
const KIND = flag('kind', 'js');
const OUT = flag('out', null);
const LIMIT = Number(flag('limit', 0));
const MAX_MB = Number(flag('maxmb', 80));
const WORK = flag('work', join(tmpdir(), 'harvest-work'));
if (!REPOS || !OUT) {
  console.error('usage: node factory/harvest_pipeline.mjs <repos.json> --kind js|godot --out rows.jsonl');
  process.exit(1);
}

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', 'addons',
  'coverage', '.godot', '.import', 'export', 'bin', 'obj', '__pycache__', 'test', 'tests']);

// ── extraction: JavaScript / TypeScript ─────────────────────────────────────────
// The per-file logic (html inline-script handling, data-URI stripping, whole-program
// detection, unit extraction with context, axis tagging, parse-error skip) lives in
// harvest_one.mjs so the exact same code runs here and inside a Modal container -
// see that file for the why. rowsForFile returns null on a parse error so the caller
// (below) can count the skip instead of silently getting zero rows for the file.

// ── extraction: GDScript ────────────────────────────────────────────────────────
// A .gd file is already one class. The useful ones declare what they extend and define
// behaviour; a two-line stub or a pure data table teaches nothing.
function gdRows(code, meta) {
  const out = [];
  if (code.length < 300 || code.length > 12000) return out;
  if (!/^\s*extends\s+\w/m.test(code)) return out;
  const funcs = (code.match(/^\s*func\s+\w+/gm) || []).length;
  if (funcs < 2) return out;
  // Preload/load of project resources cannot resolve outside the repo.
  if (/preload\s*\(|load\s*\(\s*["']res:\/\//.test(code)) return out;
  out.push({ ...meta, axis: 'godot', form: 'class', code });
  return out;
}

function walk(root) {
  const out = [];
  (function rec(d, depth) {
    if (depth > 8) return;
    let ents = [];
    try { ents = readdirSync(d); } catch { return; }
    for (const e of ents) {
      if (SKIP_DIR.has(e) || e.startsWith('.')) continue;
      const p = join(d, e);
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) rec(p, depth + 1);
      else if (st.size < 300_000) out.push(p);
    }
  })(root, 0);
  return out;
}

const { permissive } = JSON.parse(readFileSync(REPOS, 'utf8'));
let repos = permissive.filter((r) => r.mb < MAX_MB);   // mb is rounded: 0 means tiny, not empty
if (LIMIT) repos = repos.slice(0, LIMIT);

if (!existsSync(WORK)) mkdirSync(WORK, { recursive: true });
writeFileSync(OUT, '');           // fresh file; rows are appended as they are found

const EXT = KIND === 'godot' ? new Set(['.gd']) : new Set(['.js', '.mjs', '.ts', '.tsx', '.html', '.htm']);
const stats = { repos: 0, cloned: 0, failed: 0, files: 0, parseErrors: 0, tsFiles: 0, tsRows: 0, rows: 0 };
const perRepo = [];
const t0 = Date.now();

for (const [i, repo] of repos.entries()) {
  const dest = join(WORK, repo.name.replace(/[^\w.-]/g, '_'));
  stats.repos++;
  try { rmSync(dest, { recursive: true, force: true }); } catch { /* fresh */ }
  try {
    // core.longpaths: Windows' 260-char MAX_PATH otherwise fails "Filename too long" on
    // .git/objects/pack/*.keep for any repo above unpackLimit - i.e. exactly the bigger ones.
    // Passed per-invocation so no user-level git config is touched.
    execFileSync('git', ['-c', 'core.longpaths=true', 'clone', '--depth', '1', '--quiet', '--no-tags',
      `https://github.com/${repo.name}.git`, dest],
    { stdio: ['ignore', 'ignore', 'pipe'], timeout: 300_000 });
    stats.cloned++;
  } catch (e) {
    stats.failed++;
    const why = (e.stderr ? String(e.stderr) : String(e.message || e)).trim().split(/\r?\n/).pop() || '';
    console.log(`  ! ${repo.name}: clone failed  ${why.slice(0, 160)}`);
    continue;
  }

  let found = 0;
  for (const f of walk(dest)) {
    const ext = extname(f).toLowerCase();
    if (!EXT.has(ext)) continue;
    if (/\.min\.js$/i.test(f)) continue;
    if (/\.d\.ts$/i.test(f)) continue;                       // type declarations hold no behaviour
    if (/\.(?:test|spec)\.[jt]sx?$/i.test(f)) continue;      // test files outside test/ dirs
    let code = '';
    try { code = readFileSync(f, 'utf8'); } catch { continue; }
    stats.files++;

    const meta = {
      repo: repo.name,
      license: repo.license,
      stars: repo.stars,
      path: relative(dest, f).split(sep).join('/'),
    };

    let rows = [];
    if (KIND === 'godot') rows = gdRows(code, meta);
    else {
      const isTs = ext === '.ts' || ext === '.tsx';
      if (isTs) stats.tsFiles++;
      rows = await rowsForFile(code, meta);
      if (rows === null) { stats.parseErrors++; continue; }
      if (isTs) stats.tsRows += rows.length;
    }
    for (const r of rows) { appendFileSync(OUT, JSON.stringify(r) + '\n'); stats.rows++; found++; }
  }
  perRepo.push({ repo: repo.name, rows: found });
  try { rmSync(dest, { recursive: true, force: true }); } catch { /* best effort */ }

  if ((i + 1) % 10 === 0 || i === repos.length - 1) {
    const mins = ((Date.now() - t0) / 60000).toFixed(1);
    const rate = stats.rows / Math.max(1, stats.cloned);
    console.log(`  ${String(i + 1).padStart(4)}/${repos.length} repos  ${String(stats.rows).padStart(5)} rows  `
      + `${rate.toFixed(1)}/repo  ${stats.failed} failed  ${stats.parseErrors} parse-err  ${mins}m`);
  }
}

console.log(`\n${KIND} harvest complete`);
console.log(`  repos attempted ${stats.repos}, cloned ${stats.cloned}, failed ${stats.failed}`);
console.log(`  files scanned   ${stats.files}  (${stats.parseErrors} skipped for parse errors)`);
if (KIND !== 'godot') console.log(`  typescript      ${stats.tsFiles} .ts/.tsx files -> ${stats.tsRows} rows`);
console.log(`  rows written    ${stats.rows}  -> ${OUT}`);
const top = perRepo.sort((a, b) => b.rows - a.rows).slice(0, 10);
console.log('  best repos:');
for (const t of top) console.log(`    ${String(t.rows).padStart(4)}  ${t.repo}`);
