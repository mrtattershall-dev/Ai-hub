/**
 * harvest_games.mjs - mine SELF-CONTAINED systems out of your own single-file games.
 *
 *   node factory/harvest_games.mjs "C:/Users/tatte/Downloads/dust-harvest-v38-maps-fixed.html" ...
 *   node factory/harvest_games.mjs --dir "C:/Users/tatte/Downloads" --pattern dust-harvest-v38
 *
 * WHY THIS EXISTS
 * ---------------
 * Measured 2026-09-09: your own games were barely in the training data.
 *
 *     TURBO DRIFT     54 of 121 functions   45%
 *     ROUGE-ENGINE    18 of  50            36%
 *     CURSEBOUND      17 of 113            15%
 *     DUST & HARVEST  45 of 695             6%   <- the big one, barely touched
 *
 * Meanwhile 30% of run5 was a correctness slice that scored WORSE than the untouched
 * base model (5/9 vs 7/9), and half of that slice was one prompt repeated 2,105 times.
 * So the trade is: drop borrowed generic code, add your own proven game code.
 *
 * Your games also have the property the harvested Phaser slice catastrophically lacked -
 * ZERO external asset references across all four. Everything is drawn procedurally.
 * They pass the portability gate by construction, which is the single defect that made
 * run3 score 0/12 on Phaser.
 *
 * THE HARD PART: SELF-CONTAINMENT
 * -------------------------------
 * A function lifted straight out of a 37,000-line game references globals - `inventory`,
 * `ctx`, `WORLD`, sibling helpers. On its own it does not run, and a training row whose
 * code does not run is exactly the poison we spent the night removing.
 *
 * So each row is a TRANSITIVE CLOSURE: start from one function, pull in every top-level
 * declaration it references, then everything those reference, until the set is closed.
 * If the closure is still not self-contained (it reaches a genuine runtime global like a
 * canvas), the candidate is DROPPED rather than patched. Only closures that pass
 * gate.analyze() with zero free variables and `node --check` are kept.
 *
 * That is deliberately lossy - most functions in a tightly-coupled game will not close.
 * The ones that do are real, standalone systems, which is precisely what is worth
 * training on.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import * as acorn from 'acorn';
import { analyze, dependsOnExternalResources } from './gate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'dataset_games.jsonl');

const SYSTEM = 'You are a senior engineer who writes complete, self-contained, runnable code. '
  + 'Every identifier you reference must be declared or imported, declarations must precede use, '
  + 'and you only call methods/APIs that actually exist. Return code that runs as given.';

const MIN_CHARS = 220;     // below this it is a one-liner, not a system
const MAX_CHARS = 12_000;  // fits an 8k-token context with room for the prompt
const MAX_CLOSURE = 25;    // a closure needing more than this is really "most of the game"

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const dirIdx = argv.indexOf('--dir');
const patIdx = argv.indexOf('--pattern');
let FILES = argv.filter((a) => !a.startsWith('--') && /\.html?$/i.test(a));
if (dirIdx > -1) {
  const dir = argv[dirIdx + 1];
  const pat = patIdx > -1 ? argv[patIdx + 1] : '';
  FILES = readdirSync(dir).filter((f) => /\.html?$/i.test(f) && (!pat || f.includes(pat))).map((f) => join(dir, f));
}
if (!FILES.length) {
  console.error('usage: node factory/harvest_games.mjs <game.html> [...]');
  console.error('   or: node factory/harvest_games.mjs --dir <folder> [--pattern <substr>]');
  process.exit(1);
}

// ── extract every <script> body from an HTML file ──────────────────────────────
function scriptsOf(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/.test(attrs)) continue;                       // external, nothing to read
    if (/type\s*=\s*["'](?!text\/javascript|module|application\/javascript)/i.test(attrs)) continue; // json, importmap, templates
    out.push(m[2]);
  }
  return out;
}

/**
 * Is this initializer BEHAVIOUR rather than data?
 *
 * The module pattern - `const Physics = (() => { ... })()` - is a top-level `const`, so
 * a naive "only seed from function/class declarations" filter skips it entirely. That
 * cost TURBO DRIFT almost everything it has: Audio, Input, Tracks, Physics, AI and
 * Particles are all IIFE modules, and they are the most complete self-contained systems
 * in the file. A bare `const MAX_SPEED = 5` is still data and still not a seed.
 */
function isBehaviour(init) {
  if (!init) return false;
  if (['FunctionExpression', 'ArrowFunctionExpression', 'ClassExpression'].includes(init.type)) return true;
  // IIFE: (function(){...})() or (() => {...})()
  if (init.type === 'CallExpression' &&
      ['FunctionExpression', 'ArrowFunctionExpression'].includes(init.callee?.type)) return true;
  return false;
}

/**
 * Index every TOP-LEVEL declaration by name, keeping its exact source text.
 * Only top level: a nested helper travels with its parent already.
 */
function indexTopLevel(src) {
  let ast;
  for (const sourceType of ['script', 'module']) {
    try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType, allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true }); break; }
    catch { ast = null; }
  }
  if (!ast) return null;

  const decls = new Map();   // name -> { name, text, kind }
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration' && node.id) {
      decls.set(node.id.name, { name: node.id.name, text: src.slice(node.start, node.end), kind: 'function' });
    } else if (node.type === 'ClassDeclaration' && node.id) {
      decls.set(node.id.name, { name: node.id.name, text: src.slice(node.start, node.end), kind: 'class' });
    } else if (node.type === 'VariableDeclaration') {
      // Keep the WHOLE statement per declarator so `const A = ..., B = ...` stays valid.
      for (const d of node.declarations) {
        if (d.id.type !== 'Identifier') continue;
        const text = `${node.kind} ${src.slice(d.start, d.end)};`;
        decls.set(d.id.name, { name: d.id.name, text, kind: node.kind, behaviour: isBehaviour(d.init) });
      }
    }
  }
  return decls;
}

/** What top-level names does this snippet reference but not declare? */
function freeNames(code) {
  const a = analyze(code);
  return a.syntax ? a.free : null;
}

/**
 * Grow a closure from one seed declaration until it references nothing external.
 * Returns the assembled source, or null when it cannot close.
 */
function close(seedName, decls) {
  const chosen = new Map();
  const queue = [seedName];
  while (queue.length) {
    const name = queue.shift();
    if (chosen.has(name)) continue;
    const d = decls.get(name);
    if (!d) return null;                              // reaches something not top-level here
    chosen.set(name, d);
    if (chosen.size > MAX_CLOSURE) return null;       // pulling in most of the game
    const free = freeNames(d.text);
    if (free === null) return null;                   // the fragment does not even parse
    for (const f of free) {
      if (chosen.has(f)) continue;
      if (decls.has(f)) queue.push(f);
      else return null;                               // a genuine runtime global - drop it
    }
  }
  // Emit in dependency-friendly order: the seed last reads most naturally.
  const parts = [...chosen.values()].filter((d) => d.name !== seedName).map((d) => d.text);
  parts.push(chosen.get(seedName).text);
  return parts.join('\n\n');
}

// ── prompt wording from the code itself ───────────────────────────────────────
const words = (n) => n.replace(/^_+/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase().trim();

/** Any leading // or /* comment directly above the seed, used as intent. */
function leadingComment(src, decl) {
  const at = src.indexOf(decl.text);
  if (at < 0) return '';
  const before = src.slice(Math.max(0, at - 400), at).split('\n').reverse();
  const lines = [];
  for (const raw of before) {
    const l = raw.trim();
    if (!l) { if (lines.length) break; continue; }
    if (l.startsWith('//')) { lines.push(l.replace(/^\/\/+\s?/, '')); continue; }
    if (l.startsWith('*') || l.startsWith('/*') || l.endsWith('*/')) { lines.push(l.replace(/^\/?\*+\/?\s?|\s?\*\/$/g, '')); continue; }
    break;
  }
  return lines.reverse().join(' ').replace(/[═─=-]{3,}/g, '').trim().slice(0, 200);
}

function promptFor(decl, comment, game) {
  const what = comment && comment.length > 12 ? comment : `${words(decl.name)}`;
  const unit = decl.kind === 'class' ? 'class' : 'module';
  return `Write a complete, self-contained, runnable JavaScript ${unit} for a 2D game: ${what}.`;
}

// ── run ───────────────────────────────────────────────────────────────────────
const tmp = join(tmpdir(), `harvest-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
const rows = [];
const seen = new Set();
const stats = { files: 0, decls: 0, closed: 0, kept: 0, dropUnclosed: 0, dropSize: 0, dropSyntax: 0, dropPortable: 0, dropDupe: 0 };

for (const file of FILES) {
  if (!existsSync(file)) { console.error(`  missing: ${file}`); continue; }
  stats.files++;
  const html = readFileSync(file, 'utf8');
  const title = (html.match(/<title>([^<]*)/i) || [, basename(file)])[1].trim();
  const src = scriptsOf(html).join('\n\n');
  const decls = indexTopLevel(src);
  if (!decls) { console.error(`  unparseable: ${basename(file)}`); continue; }
  stats.decls += decls.size;

  for (const [name, decl] of decls) {
    // Seed from anything that IS behaviour: a function/class declaration, or a const
    // holding a function, arrow, class or IIFE module. Never from plain data.
    if (!(decl.kind === 'function' || decl.kind === 'class' || decl.behaviour)) continue;
    const code = close(name, decls);
    if (!code) { stats.dropUnclosed++; continue; }
    stats.closed++;
    if (code.length < MIN_CHARS) { stats.dropSize++; continue; }
    if (code.length > MAX_CHARS) { stats.dropSize++; continue; }

    const port = dependsOnExternalResources(code);
    if (!port.portable) { stats.dropPortable++; continue; }

    // node --check: the closure must be valid standalone, not merely acorn-parseable.
    const f = join(tmp, 'c.js');
    writeFileSync(f, code, 'utf8');
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'ignore', timeout: 15000 }); }
    catch { stats.dropSyntax++; continue; }

    const key = createHash('sha1').update(code.replace(/\s+/g, ' ')).digest('hex');
    if (seen.has(key)) { stats.dropDupe++; continue; }
    seen.add(key);

    rows.push({
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: promptFor(decl, leadingComment(src, decl), title) },
        { role: 'assistant', content: '```javascript\n' + code + '\n```' },
      ],
      _meta: { game: title, seed: name, file: basename(file) },
    });
    stats.kept++;
  }
  console.log(`  ${basename(file).slice(0, 46).padEnd(46)} ${String(decls.size).padStart(4)} decls -> ${String(rows.length).padStart(4)} rows so far`);
}

writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');

console.log(`\n=== harvest_games -> ${OUT} ===`);
console.log(`  files scanned          ${stats.files}`);
console.log(`  top-level declarations ${stats.decls}`);
console.log(`  closures that closed   ${stats.closed}`);
console.log(`  KEPT                   ${stats.kept}`);
console.log(`\n  dropped:`);
console.log(`    could not self-contain  ${stats.dropUnclosed}   (reaches a runtime global — expected, most game code is coupled)`);
console.log(`    wrong size              ${stats.dropSize}`);
console.log(`    failed node --check     ${stats.dropSyntax}`);
console.log(`    non-portable            ${stats.dropPortable}`);
console.log(`    duplicate               ${stats.dropDupe}`);
console.log(`\n  Every kept row: self-contained (zero free variables), node --check clean,`);
console.log(`  portable (no external assets), deduped. Same contract as the Phaser slice.`);
