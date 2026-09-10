/**
 * harvest_snippets.mjs — mine FUNCTION-LEVEL human code from git repos.
 *
 *   node harvest_snippets.mjs https://github.com/AndrewRayCode/easing-utils https://github.com/Tokimon/vanillajs-helpers
 *
 * Whole files are too big / too coupled (see harvest_repo.mjs), but individual top-level
 * functions and classes are often self-contained — pure helpers (math, easing, color,
 * vectors, string/array utils). This extracts each top-level function/class/arrow-const,
 * keeps only the ones that:
 *   - parse, and pass the gate (zero free vars = references nothing it doesn't declare)
 *   - pass `node --check` (V8 syntax validation)
 *   - are a sensible snippet size, and unique
 * Its leading JSDoc/comment is kept WITH the code, so rows carry real human documentation
 * and style — the idiom the synthetic systems rows lack. -> factory/dataset_snippets.jsonl
 *
 * NOTE: snippets are gate-verified (self-contained) but NOT execution-proven the way the
 * systems are — a bare helper has no demo to assert behaviour. They add human STYLE; the
 * systems add proven BEHAVIOUR. Prefer permissively-licensed (MIT) source repos.
 */
import { execSync, execFileSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'fs';
import { join, basename, dirname, extname } from 'path';
import { createHash } from 'crypto';
import * as acorn from 'acorn';
import { analyze } from './gate.mjs';

const REPOS = process.argv.slice(2);
if (!REPOS.length) { console.error('usage: node harvest_snippets.mjs <git-url> [<git-url> ...]'); process.exit(1); }

const SYSTEM = 'You are a senior engineer who writes complete, self-contained, runnable code. Every identifier you reference must be declared or imported, declarations must precede use, and you only call methods/APIs that actually exist. Return code that runs as given.';
const MIN = 60, MAX = 2200;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', 'lib', 'libs', 'assets', '.github', 'docs', 'test', 'tests', 'spec', 'specs', '__tests__', '__mocks__', 'e2e', 'coverage', 'examples', 'demo']);
const TEST_FILE = /(\.|[-_.])(test|spec|min)\.(m?js)$/i;
const TMP = join('factory', '_snip_tmp');

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (SKIP_DIRS.has(e)) continue;
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (/\.(js|mjs)$/i.test(e) && !TEST_FILE.test(e)) out.push(p);
  }
  return out;
}

function words(name) {
  return name.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().trim();
}
function instructionFor(kind, name, doc) {
  if (doc) {
    const first = doc.split(/\.\s|\n/).map(s => s.trim()).find(Boolean);
    if (first && first.length > 8) return `Write a self-contained JavaScript ${kind} that does the following: ${first.replace(/\.$/, '')}.`;
  }
  return `Write a self-contained, idiomatic JavaScript ${kind} \`${name}\` (${words(name)}).`;
}

function nodeChecks(code) {
  const f = join(TMP, 's_' + createHash('sha1').update(code).digest('hex').slice(0, 12) + '.js');
  writeFileSync(f, code, 'utf8');
  try { execFileSync('node', ['--check', f], { stdio: 'pipe', timeout: 5000 }); return true; }
  catch { return false; }
}

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const rows = [];
const seen = new Set();
let scanned = 0, kept = 0, freeRej = 0, sizeRej = 0, checkRej = 0, dup = 0;

for (const repo of REPOS) {
  const name = basename(repo).replace(/\.git$/, '');
  const root = join('factory', '_repos', name);
  if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  mkdirSync(dirname(root), { recursive: true });
  console.log(`cloning ${repo} ...`);
  try { execSync(`git clone --depth 1 --quiet "${repo}" "${root}"`, { stdio: 'inherit' }); }
  catch { console.log(`  (clone failed, skipping)`); continue; }

  let repoKept = 0;
  for (const file of walk(root)) {
    const text = readFileSync(file, 'utf8');
    let ast, comments = [];
    try { ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', onComment: comments, ranges: true }); }
    catch { try { ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'script', onComment: comments, ranges: true }); } catch { continue; } }

    const docBefore = (start) => {
      // find a comment whose end is just before `start` (only whitespace between)
      let best = null;
      for (const c of comments) {
        if (c.end <= start && /^\s*$/.test(text.slice(c.end, start))) { if (!best || c.start < best.start) best = c; }
      }
      if (!best) return { doc: null, from: start };
      const raw = best.type === 'Block' ? best.value.replace(/^\*?/, '').split('\n').map(s => s.replace(/^\s*\*?\s?/, '').trim()).filter(l => l && !l.startsWith('@')).join(' ') : best.value.trim();
      return { doc: raw.trim() || null, from: best.start };
    };

    const candidates = [];
    for (const node of ast.body) {
      let target = node, kind = null, nm = null;
      if (node.type === 'ExportNamedDeclaration' && node.declaration) target = node.declaration;
      else if (node.type === 'ExportDefaultDeclaration' && node.declaration && /Function|Class/.test(node.declaration.type)) target = node.declaration;
      if (target.type === 'FunctionDeclaration' && target.id) { kind = 'function'; nm = target.id.name; }
      else if (target.type === 'ClassDeclaration' && target.id) { kind = 'class'; nm = target.id.name; }
      else if (target.type === 'VariableDeclaration') {
        const d = target.declarations[0];
        if (d && d.init && /ArrowFunctionExpression|FunctionExpression/.test(d.init.type) && d.id.type === 'Identifier') { kind = 'function'; nm = d.id.name; }
      }
      if (kind) candidates.push({ target, kind, nm });
    }

    for (const { target, kind, nm } of candidates) {
      scanned++;
      const { doc, from } = docBefore(target.start);
      const code = text.slice(from, target.end).trim();
      if (code.length < MIN || code.length > MAX) { sizeRej++; continue; }
      const a = analyze(text.slice(target.start, target.end));   // analyze code only (not the comment)
      if (!a.syntax || a.free.length) { freeRej++; continue; }
      if (!nodeChecks(code)) { checkRej++; continue; }
      const h = createHash('sha1').update(code.replace(/\s+/g, ' ').trim()).digest('hex');
      if (seen.has(h)) { dup++; continue; }
      seen.add(h);
      kept++; repoKept++;
      rows.push({ messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: instructionFor(kind, nm, doc) },
        { role: 'assistant', content: '```javascript\n' + code + '\n```' },
      ] });
    }
  }
  console.log(`  ${name}: kept ${repoKept} snippets`);
  rmSync(root, { recursive: true, force: true });
}

rmSync(TMP, { recursive: true, force: true });
const outPath = join('factory', 'dataset_snippets.jsonl');
writeFileSync(outPath, rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''), 'utf8');

console.log(`\n=== snippet harvest ===`);
console.log(`  candidates scanned:    ${scanned}`);
console.log(`  KEPT (self-contained): ${kept}`);
console.log(`  rejected free-vars:    ${freeRej}`);
console.log(`  rejected size:         ${sizeRej}`);
console.log(`  rejected node --check: ${checkRej}`);
console.log(`  duplicate:             ${dup}`);
console.log(`\n  -> ${outPath}  (${rows.length} rows)`);
if (rows.length) console.log(`  review, then from factory/:  Get-Content dataset_snippets.jsonl | Add-Content ..\\correctness\\dataset.jsonl`);
