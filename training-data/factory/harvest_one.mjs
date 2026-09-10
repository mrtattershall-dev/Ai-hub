/**
 * harvest_one.mjs - the per-file extraction step, factored out of harvest_pipeline.mjs.
 *
 * WHY THIS EXISTS AS ITS OWN MODULE
 * ----------------------------------
 * harvest_pipeline.mjs clones repos serially on one machine, which is the bottleneck for
 * a large repo list. That cloning loop is moving to Modal, where many containers each
 * clone one repo and mine it in parallel. Both the local pipeline and a Modal container
 * need the EXACT same per-file logic (html inline-script handling, data-URI stripping,
 * whole-program detection, unit extraction with context, axis tagging, parse-error skip)
 * - duplicating it would let the two paths drift and silently produce different rows for
 * the same file. This module is that logic, called from harvest_pipeline.mjs locally and
 * driven standalone (via the CLI below) inside a container.
 *
 *   node factory/harvest_one.mjs --dir <cloned-repo-dir> --repo <owner/name> --license <spdx> --stars <n>
 *     -> one JSON row per line on stdout, one per qualifying file under --dir
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { extractUnits, langOf } from './ts_extract.mjs';
import { join, extname, relative, sep } from 'path';

const DATA_URI = /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi;

/**
 * Rows from one JS/TS file: whole programs AND the units inside them.
 *
 * Taking only whole standalone programs measured 0.24 rows per repo - 6 rows from 25 repos
 * - because almost every real project is multi-file. The earlier "16 per repo" figure came
 * from four hand-picked repos, one of which held 98 mini-games; generalising it to the
 * population was extrapolation from a biased sample.
 *
 * The units inside those files are both far more plentiful and more relevant: editing a
 * function inside an existing codebase is what the agent actually does, and a unit shipped
 * with the declarations it depends on is exactly that task.
 *
 * Units come from the tree-sitter extractor (ts_extract.mjs), which also reads TypeScript:
 * 64% of Phaser game files are .ts and the regex extractor skipped every one of them.
 * Returns null when the file does not parse cleanly, so the caller can count the skip.
 */
async function jsRows(code, meta, lang) {
  const out = [];
  const localImport = /^\s*(?:import|export)\s[^;]*from\s+['"]\.{1,2}\//m.test(code)
    || /require\(\s*['"]\.{1,2}\//.test(code);
  const isPhaser = /new\s+Phaser\.Game\s*\(|Phaser\.(Scene|AUTO)/.test(code);
  const isCanvas = /getContext\(\s*['"]2d/.test(code) && /requestAnimationFrame/.test(code);
  const axis = isPhaser ? 'phaser' : 'code';

  // 2 first: a file with syntax errors yields no rows of either form.
  const units = await extractUnits(code, { lang, min: 200, max: 6000, ctxMax: 6000, skipErrors: true });
  if (units === null) return null;

  // 1. the whole file, when it stands alone and boots a game
  if (!localImport && (/new\s+Phaser\.Game\s*\(/.test(code) || isCanvas)
      && code.length >= 400 && code.length <= 20000) {
    out.push({ ...meta, axis, form: 'program', code });
  }

  // 2. the units inside it, each with the declarations it depends on
  for (const u of units) {
    out.push({
      ...meta,
      axis,
      form: 'unit',
      name: u.name,
      unitKind: u.kind,
      context: u.context,
      code: u.code,
    });
  }
  return out;
}

/**
 * Rows for one file's content. `meta` carries the row provenance the caller already knows
 * (path relative to the repo root, repo name, license, stars) and is spread onto every row
 * unchanged. Returns null when the file has a syntax error the extractor could not get past
 * (the caller counts this as a parse-error skip, not a silent zero-row file).
 */
export async function rowsForFile(code, { path, repo, license, stars }) {
  const meta = { repo, license, stars, path };
  const isHtml = /\.html?$/i.test(path);
  // An html game keeps its inline script; the payloads are stripped, not the logic.
  const body = isHtml
    ? [...code.replace(DATA_URI, 'DATAURI').matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
      .map((m) => m[1]).join('\n')
    : code;
  const lang = isHtml ? 'js' : langOf(path);
  return jsRows(body, meta, lang);
}

// ── CLI: standalone, directory-driven (what a Modal container invokes) ──────────────
const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', 'addons',
  'coverage', '.godot', '.import', 'export', 'bin', 'obj', '__pycache__', 'test', 'tests']);
const EXT = new Set(['.js', '.mjs', '.ts', '.tsx', '.html', '.htm']);

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

const invoked = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('harvest_one.mjs');
if (invoked) {
  const args = process.argv.slice(2);
  const flag = (n, d) => { const i = args.indexOf('--' + n); return i > -1 && args[i + 1] ? args[i + 1] : d; };
  const DIR = flag('dir', null);
  const REPO = flag('repo', null);
  const LICENSE = flag('license', null);
  const STARS = Number(flag('stars', 0));
  if (!DIR || !REPO) {
    console.error('usage: node factory/harvest_one.mjs --dir <cloned-repo-dir> --repo <owner/name> --license <spdx> --stars <n>');
    process.exit(1);
  }

  let files = 0;
  let parseErrors = 0;
  let rows = 0;
  for (const f of walk(DIR)) {
    const ext = extname(f).toLowerCase();
    if (!EXT.has(ext)) continue;
    if (/\.min\.js$/i.test(f)) continue;
    if (/\.d\.ts$/i.test(f)) continue;                       // type declarations hold no behaviour
    if (/\.(?:test|spec)\.[jt]sx?$/i.test(f)) continue;      // test files outside test/ dirs
    let code = '';
    try { code = readFileSync(f, 'utf8'); } catch { continue; }
    files++;

    const path = relative(DIR, f).split(sep).join('/');
    const result = await rowsForFile(code, { path, repo: REPO, license: LICENSE, stars: STARS });
    if (result === null) { parseErrors++; continue; }
    for (const r of result) { process.stdout.write(JSON.stringify(r) + '\n'); rows++; }
  }
  console.error(`${REPO}: ${files} files scanned, ${parseErrors} parse-error skips, ${rows} rows`);
}
