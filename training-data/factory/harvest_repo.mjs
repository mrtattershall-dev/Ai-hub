/**
 * harvest_repo.mjs — mine a git repo for gate-passing training rows.
 *
 *   node harvest_repo.mjs https://github.com/juliensimon/browser-games browsergames
 *
 * Shallow-clones the repo, finds candidate single-file units (standalone .html with
 * inline script, or .js logic files), and keeps ONLY the ones that:
 *   - parse + have zero free variables (same gate as verify_gate.mjs)  -> self-contained
 *   - aren't minified (minified passes the gate but teaches obfuscated style)
 *   - fit MAX_CHARS (so the row doesn't truncate at maxlen)
 *   - aren't duplicates
 * Emits factory/dataset_repo_<ver>.jsonl in the exact chat format of correctness/.
 *
 * Reality check: "self-contained + vanilla + readable + small" is rare in the wild, so
 * expect dozens of rows from a good repo, not thousands. This is the QUALITY supplement;
 * modal_generate.py is the VOLUME engine.
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'fs';
import { join, basename, dirname, extname } from 'path';
import { createHash } from 'crypto';
import { analyze, extractJS } from './gate.mjs';

const REPO = process.argv[2];
const VER = process.argv[3] || 'repo';
if (!REPO) { console.error('usage: node harvest_repo.mjs <git-url> <version>'); process.exit(1); }

const SYSTEM = 'You are a senior engineer who writes complete, self-contained, runnable code. Every identifier you reference must be declared or imported, declarations must precede use, and you only call methods/APIs that actually exist. Return code that runs as given.';
const MAX_CHARS = 14000;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', 'lib', 'libs', 'assets', '.github', 'docs',
  'test', 'tests', 'spec', 'specs', '__tests__', '__mocks__', 'e2e', 'cypress', 'coverage']);
// test files use mocha/jasmine globals (describe/it/expect) → pollute the gate as "fragments"
const TEST_FILE = /(\.|[-_.])(test|spec)\.(m?js|html)$/i;
const GENERIC = new Set(['src', 'js', 'scripts', 'game', 'games', 'public', 'www', 'app', 'main', 'source']);

// minified = long lines / almost no newlines. Self-contained but useless as style data.
function isMinified(code) {
  const lines = code.split('\n');
  const meanLen = code.length / Math.max(lines.length, 1);
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  return meanLen > 200 || longest > 1000;
}

// derive a human instruction from the nearest meaningful folder/file name
function titleFor(relPath) {
  const parts = relPath.split(/[\\/]/).filter(Boolean);
  const file = parts[parts.length - 1].replace(/\.(js|mjs|html)$/i, '');
  const folder = parts.length > 1 ? parts[parts.length - 2] : '';
  let name = (!GENERIC.has(file.toLowerCase()) && file) ||
             (!GENERIC.has(folder.toLowerCase()) && folder) || file || folder || 'program';
  return name.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
}
function headerDoc(code) {
  const m = code.match(/^﻿?\s*\/\*\*?([\s\S]*?)\*\//);
  if (!m) return null;
  const line = m[1].split('\n').map(s => s.replace(/^\s*\*?\s?/, '').trim()).find(Boolean);
  return line || null;
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (SKIP_DIRS.has(e)) continue;
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (/\.(html|js|mjs)$/i.test(e) && !TEST_FILE.test(e)) out.push(p);
  }
  return out;
}

// ---- clone ----
const name = basename(REPO).replace(/\.git$/, '');
const root = join('factory', '_repos', name);
if (existsSync(root)) rmSync(root, { recursive: true, force: true });
mkdirSync(dirname(root), { recursive: true });
console.log(`cloning ${REPO} (shallow)...`);
execSync(`git clone --depth 1 --quiet "${REPO}" "${root}"`, { stdio: 'inherit' });

// ---- scan ----
const files = walk(root);
let scanned = 0, tooBig = 0, minified = 0, fragment = 0, syntaxFail = 0, dup = 0, kept = 0, noScript = 0;
const seen = new Set();
const freeTally = new Map();
const rows = [];

for (const f of files) {
  const ext = extname(f).toLowerCase();
  const raw = readFileSync(f, 'utf8');
  const lang = ext === '.html' ? 'html' : 'js';
  if (lang === 'html' && !/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i.test(raw)) { noScript++; continue; } // html with only external scripts → skip
  scanned++;
  if (raw.length > MAX_CHARS) { tooBig++; continue; }
  if (isMinified(lang === 'html' ? extractJS('x.html', raw) : raw)) { minified++; continue; }
  const code = extractJS(lang === 'html' ? 'x.html' : 'x.js', raw);
  if (!code.trim()) { noScript++; continue; }
  const r = analyze(code);
  if (!r.syntax) { syntaxFail++; continue; }
  if (r.free.length) { fragment++; for (const n of r.free) freeTally.set(n, (freeTally.get(n) || 0) + 1); continue; }
  const h = createHash('sha1').update(raw).digest('hex');
  if (seen.has(h)) { dup++; continue; }
  seen.add(h);
  kept++;
  const rel = f.slice(root.length + 1);
  const title = titleFor(rel);
  const doc = headerDoc(raw);
  const instr = lang === 'html'
    ? `Write a complete, self-contained, single-file HTML5 canvas game: ${doc || title} (vanilla JavaScript, no frameworks).`
    : `Write a complete, self-contained, runnable vanilla JavaScript program: ${doc || title} (no frameworks, canvas/DOM only).`;
  rows.push({ messages: [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: instr },
    { role: 'assistant', content: '```' + lang + '\n' + raw.trim() + '\n```' },
  ] });
}

const outPath = join('factory', `dataset_repo_${VER}.jsonl`);
writeFileSync(outPath, rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''), 'utf8');

console.log(`\n=== repo harvest: ${name} ===`);
console.log(`  candidate files:       ${scanned}`);
console.log(`  KEPT (verified):       ${kept}`);
console.log(`  fragment (free vars):  ${fragment}`);
console.log(`  minified (rejected):   ${minified}`);
console.log(`  too big (>${MAX_CHARS}):    ${tooBig}`);
console.log(`  syntax error:          ${syntaxFail}`);
console.log(`  duplicate:             ${dup}`);
console.log(`  html w/o inline js:    ${noScript}`);
const top = [...freeTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
if (top.length) {
  console.log(`\n  top undefined refs (why fragments failed):`);
  for (const [n, c] of top) console.log(`    ${String(c).padStart(4)}  ${n}`);
}
console.log(`\n  -> ${outPath}  (${rows.length} verified rows)`);
if (rows.length) {
  console.log(`  review a few, then append:`);
  console.log(`    Get-Content ${outPath} | Add-Content ..\\correctness\\dataset.jsonl`);
}
console.log(`  (clone left at ${root} — delete when done)`);
