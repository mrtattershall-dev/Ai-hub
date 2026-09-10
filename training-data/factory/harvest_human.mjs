/**
 * harvest_human.mjs — mine real human SYSTEMS (modules + classes) from git repos.
 *
 *   node harvest_human.mjs https://github.com/trekhleb/javascript-algorithms <more-urls...>
 *
 * Unlike harvest_snippets (tiny utility functions), this targets SUBSTANTIAL self-contained
 * units — full modules and classes (data structures, state machines, algorithms, game
 * systems) — across many styles. For each .js file:
 *   1. MODULE-FIRST: if the WHOLE file is self-contained (zero free vars) + node --check +
 *      fits the size cap, keep it as one module row (a complete human system).
 *   2. FALLBACK: otherwise extract each top-level class / function / arrow-const that IS
 *      self-contained (its leading JSDoc kept with it), so coupled files still yield their
 *      clean pieces.
 * Gate-verified self-contained + node --check + sized + deduped. NOT execution-proven like
 * factory/systems (no demo to assert) — this layer adds human STYLE + breadth; the systems
 * add proven behaviour. Prefer MIT/permissive repos. -> factory/dataset_human.jsonl
 */
import { execSync, execFileSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'fs';
import { join, basename, dirname } from 'path';
import { createHash } from 'crypto';
import * as acorn from 'acorn';
import { analyze } from './gate.mjs';

const REPOS = process.argv.slice(2);
if (!REPOS.length) { console.error('usage: node harvest_human.mjs <git-url> [<git-url> ...]'); process.exit(1); }

const SYSTEM = 'You are a senior engineer who writes complete, self-contained, runnable code. Every identifier you reference must be declared or imported, declarations must precede use, and you only call methods/APIs that actually exist. Return code that runs as given.';
const MIN = 200;            // skip trivial one-liners — we want substantial systems
const MAX = 14000;          // fits maxlen 8192; a "full system" file/class, not a whole game
const CAP = parseInt(process.env.CAP || '120', 10);   // max rows per repo, for source balance
// not actually self-contained: needs an external local file (require / relative import)
const COUPLED = /\brequire\s*\(|\b(?:import\b[^\n]*?|from\s+)['"]\.\.?\//;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', 'lib', 'libs', 'assets', '.github', 'docs', 'test', 'tests', 'spec', 'specs', '__tests__', '__mocks__', 'e2e', 'coverage', 'examples', 'example', 'demo', 'benchmark', 'bin']);
const TEST_FILE = /(\.|[-_.])(test|spec|min|config|d)\.(m?js)$/i;
const TMP = join('factory', '_human_tmp');

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
function words(name) { return name.replace(/\.(m?js)$/i, '').replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().trim(); }
function isMinified(code) {
  const lines = code.split('\n');
  return code.length / Math.max(lines.length, 1) > 200 || lines.reduce((m, l) => Math.max(m, l.length), 0) > 1000;
}
function nodeChecks(code) {
  const f = join(TMP, 'h_' + createHash('sha1').update(code).digest('hex').slice(0, 12) + '.js');
  writeFileSync(f, code, 'utf8');
  try { execFileSync('node', ['--check', f], { stdio: 'pipe', timeout: 5000 }); return true; }
  catch { return false; }
}
// strip import/export lines so a module is judged on its own logic (re-exports aren't systems)
function stripModuleSyntax(code) {
  return code.replace(/^\s*export\s+default\s+/gm, '').replace(/^\s*export\s+/gm, '').replace(/^\s*import\s.+$/gm, '');
}

const seen = new Set();
const rows = [];
let files = 0, modules = 0, units = 0, fileCoupled = 0, freeRej = 0, sizeRej = 0, checkRej = 0, dup = 0, minRej = 0;

function selfContained(code) { const a = analyze(code); return a.syntax && a.free.length === 0; }
function tryPush(kind, name, doc, code) {
  if (code.length < MIN || code.length > MAX) { sizeRej++; return false; }
  if (isMinified(code) || COUPLED.test(code)) { minRej++; return false; }
  const a = analyze(code);
  if (!a.syntax || a.free.length) { freeRej++; return false; }
  if (!nodeChecks(code)) { checkRej++; return false; }
  const h = createHash('sha1').update(code.replace(/\s+/g, ' ').trim()).digest('hex');
  if (seen.has(h)) { dup++; return false; }
  seen.add(h);
  const disp = name.replace(/\.(m?js)$/i, '');
  const first = doc && doc.split(/\.\s|\n/).map(s => s.trim()).find(s => s && s.length > 8);
  let instr;
  if (process.env.CASUAL === '1') {
    // casual, user-style instructions — reinforce "light/terse request -> real code"
    const lead = ['a ', 'make a ', 'just a ', 'a quick ', 'a simple ', 'i need a ', 'gimme a ', 'can you do a ', 'a basic '];
    const what = (first ? first.replace(/\.$/, '') : words(name)).replace(/^(a|an|the)\s+/i, '');
    instr = (lead[Math.floor(Math.random() * lead.length)] + what.toLowerCase()).trim();
  } else {
    instr = first
      ? `Write a complete, self-contained JavaScript ${kind} that does the following: ${first.replace(/\.$/, '')}.`
      : `Write a complete, self-contained JavaScript ${kind} \`${disp}\` (${words(name)}).`;
  }
  rows.push({ messages: [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: instr },
    { role: 'assistant', content: '```javascript\n' + code.trim() + '\n```' },
  ] });
  return true;
}

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

for (const repo of REPOS) {
  const name = basename(repo).replace(/\.git$/, '');
  const root = join('factory', '_repos', name);
  if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  mkdirSync(dirname(root), { recursive: true });
  console.log(`cloning ${repo} ...`);
  try { execSync(`git clone --depth 1 --quiet "${repo}" "${root}"`, { stdio: 'inherit' }); }
  catch { console.log('  (clone failed, skipping)'); continue; }

  let repoMods = 0, repoUnits = 0;
  for (const file of walk(root)) {
    if (repoMods + repoUnits >= CAP) break;     // keep one repo from dominating the mix
    files++;
    const text = readFileSync(file, 'utf8');
    let ast, comments = [];
    try { ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', onComment: comments, ranges: true }); }
    catch { try { ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'script', onComment: comments, ranges: true }); } catch { continue; } }

    // 1) module-first: whole file, import/export stripped, judged self-contained
    const stripped = stripModuleSyntax(text).trim();
    const fileDoc = comments.find(c => c.type === 'Block' && c.start < 200);
    const fileDocText = fileDoc ? fileDoc.value.split('\n').map(s => s.replace(/^\s*\*?\s?/, '').trim()).filter(l => l && !l.startsWith('@')).join(' ') : null;
    if (selfContained(stripped) && tryPush('module', basename(file), fileDocText, stripped)) {
      modules++; repoMods++; continue;            // whole module kept; don't also split it
    }
    fileCoupled++;

    // 2) fallback: extract self-contained top-level classes / functions
    const docBefore = (start) => {
      let best = null;
      for (const c of comments) if (c.end <= start && /^\s*$/.test(text.slice(c.end, start))) { if (!best || c.start < best.start) best = c; }
      if (!best) return { doc: null, from: start };
      const raw = best.type === 'Block' ? best.value.split('\n').map(s => s.replace(/^\s*\*?\s?/, '').trim()).filter(l => l && !l.startsWith('@')).join(' ') : best.value.trim();
      return { doc: raw.trim() || null, from: best.start };
    };
    for (const node of ast.body) {
      let target = node, kind = null, nm = null;
      if (node.type === 'ExportNamedDeclaration' && node.declaration) target = node.declaration;
      else if (node.type === 'ExportDefaultDeclaration' && node.declaration && /Function|Class/.test(node.declaration.type)) target = node.declaration;
      if (target.type === 'ClassDeclaration' && target.id) { kind = 'class'; nm = target.id.name; }
      else if (target.type === 'FunctionDeclaration' && target.id) { kind = 'function'; nm = target.id.name; }
      else if (target.type === 'VariableDeclaration') {
        const d = target.declarations[0];
        if (d && d.init && /ArrowFunctionExpression|FunctionExpression/.test(d.init.type) && d.id.type === 'Identifier') { kind = 'function'; nm = d.id.name; }
      }
      if (!kind) continue;
      const { doc, from } = docBefore(target.start);
      const code = text.slice(from, target.end).trim();
      if (selfContained(text.slice(target.start, target.end)) && tryPush(kind, nm, doc, code)) { units++; repoUnits++; }
    }
  }
  console.log(`  ${name}: ${repoMods} modules + ${repoUnits} units`);
  rmSync(root, { recursive: true, force: true });
}

rmSync(TMP, { recursive: true, force: true });
const outPath = join('factory', 'dataset_human.jsonl');
writeFileSync(outPath, rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''), 'utf8');

console.log(`\n=== human systems harvest ===`);
console.log(`  files scanned:           ${files}`);
console.log(`  whole modules kept:      ${modules}`);
console.log(`  class/function units:    ${units}`);
console.log(`  coupled files (split):   ${fileCoupled}`);
console.log(`  rejected free-vars:      ${freeRej}`);
console.log(`  rejected size/minified:  ${sizeRej + minRej}`);
console.log(`  rejected node --check:   ${checkRej}`);
console.log(`  duplicate:               ${dup}`);
console.log(`\n  -> ${outPath}  (${rows.length} rows)`);
if (rows.length) console.log(`  review, then from factory/:  Get-Content dataset_human.jsonl | Add-Content ..\\correctness\\dataset.jsonl`);
