/**
 * extract_units.mjs - pull self-contained code units out of single-file games.
 *
 *   node factory/extract_units.mjs <dir-or-file> [--emit out.jsonl] [--min 200] [--max 6000]
 *
 * WHY
 * ---
 * The user's 144 games are 111.9 MB of real, working, owned canvas-game code, and none of
 * it is reachable as training data: each game is ONE html file of ~800 KB, far past any
 * usable row. The interesting parts are the units inside - an inventory system, a
 * pathfinder, a save/load round-trip - which are row-sized and are the kind of thing the
 * model is actually asked to write.
 *
 * A row must stand on its own, so a unit only counts when it does not reach for identifiers
 * it never declares. That is checked here rather than assumed: the original Phaser harvest
 * shipped 4,242 rows that referenced things they never defined and scored 0/12.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, basename } from 'path';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i > -1 && args[i + 1] ? args[i + 1] : d; };
const TARGET = args.find((a) => !a.startsWith('--'));
const EMIT = flag('emit', null);
const MIN = Number(flag('min', 200));
const MAX = Number(flag('max', 6000));
const CLI = !!TARGET;

const DATA_URI = /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi;

/** Globals a browser game may use without declaring. Anything else must be local. */
const AMBIENT = new Set([
  'window', 'document', 'console', 'Math', 'JSON', 'Date', 'Array', 'Object', 'String',
  'Number', 'Boolean', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Symbol', 'RegExp',
  'Error', 'TypeError', 'RangeError', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'localStorage', 'sessionStorage', 'fetch', 'Image', 'Audio',
  'CanvasRenderingContext2D', 'Float32Array', 'Uint8Array', 'Uint8ClampedArray',
  'Int32Array', 'Uint32Array', 'ArrayBuffer', 'DataView', 'TextEncoder', 'TextDecoder',
  'structuredClone', 'performance', 'navigator', 'location', 'history', 'alert',
  'Infinity', 'NaN', 'undefined', 'null', 'true', 'false', 'this', 'arguments',
  'AudioContext', 'webkitAudioContext', 'URL', 'Blob', 'FileReader', 'devicePixelRatio',
]);

const KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return',
  'function', 'class', 'const', 'let', 'var', 'new', 'typeof', 'instanceof', 'in', 'of',
  'delete', 'void', 'throw', 'try', 'catch', 'finally', 'extends', 'super', 'static',
  'get', 'set', 'async', 'await', 'yield', 'default', 'export', 'import', 'from', 'as',
]);

/** Find the matching close brace for the `{` at `open`. Skips strings, template literals and comments. */
function matchBrace(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) return -1; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2); if (i < 0) return -1; i++; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      for (i++; i < src.length; i++) {
        if (src[i] === '\\') { i++; continue; }
        if (src[i] === q) break;
        if (q === '`' && src[i] === '$' && src[i + 1] === '{') {
          let d = 1; i += 2;
          for (; i < src.length && d; i++) { if (src[i] === '{') d++; else if (src[i] === '}') d--; }
          i--;
        }
      }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) return i; }
  }
  return -1;
}

/** Identifiers a snippet reads but never declares. */
function freeIdentifiers(code) {
  const declared = new Set();
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  for (const m of code.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  for (const m of code.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  for (const m of code.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}/g)) {
    for (const p of m[1].split(',')) { const n = p.split(':').pop().split('=')[0].trim(); if (n) declared.add(n); }
  }
  for (const m of code.matchAll(/\(([^)]*)\)\s*(?:=>|\{)/g)) {
    for (const p of m[1].split(',')) { const n = p.split('=')[0].replace(/[.\s]/g, ''); if (/^[A-Za-z_$][\w$]*$/.test(n)) declared.add(n); }
  }
  for (const m of code.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  for (const m of code.matchAll(/\bfor\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);

  const free = new Set();
  // Strip strings/comments before scanning for reads, or words inside them count.
  const bare = code
    .replace(/\/\/[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/`(?:\\.|[^`\\])*`/g, ' ').replace(/"(?:\\.|[^"\\])*"/g, ' ').replace(/'(?:\\.|[^'\\])*'/g, ' ');
  for (const m of bare.matchAll(/(\.)?\b([A-Za-z_$][\w$]*)\b(\s*:)?/g)) {
    if (m[1]) continue;            // property access
    if (m[3]) continue;            // object key / label
    const id = m[2];
    if (KEYWORDS.has(id) || AMBIENT.has(id) || declared.has(id)) continue;
    free.add(id);
  }
  return [...free];
}

function scriptBodies(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(m[0])) continue;
    out.push(m[1]);
  }
  return out.length ? out : [html];
}

/** Top-level `function name(...) {}` and `class Name {}` blocks. */
function units(src) {
  const found = [];
  const rx = /^[ \t]*(?:(?:async|export)\s+)*(function\s*\*?\s+([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*))/gm;
  for (const m of src.matchAll(rx)) {
    const open = src.indexOf('{', m.index + m[0].length - 1);
    if (open < 0) continue;
    const close = matchBrace(src, open);
    if (close < 0) continue;
    // Carry a leading comment block - it is the closest thing to a written intent.
    let start = m.index;
    const before = src.slice(Math.max(0, m.index - 500), m.index);
    const cm = before.match(/(\/\*\*[\s\S]*?\*\/|(?:^[ \t]*\/\/[^\n]*\n)+)\s*$/m);
    if (cm) start = m.index - (before.length - cm.index);
    found.push({
      kind: m[2] ? 'function' : 'class',
      name: m[2] || m[3],
      code: src.slice(start, close + 1).trim(),
    });
  }
  return found;
}

/**
 * Top-level declarations in a file, by name, so a unit's free identifiers can be resolved.
 *
 * A strict self-contained bar yields almost nothing from real game code: 25 units out of
 * 10,596, because a game's functions legitimately share state - `player`, `ctx`, `TILE`.
 * Those are not defects, they are what the code IS. So instead of discarding them, the
 * declarations a unit depends on are collected and shipped as CONTEXT, which is also
 * closer to the job: an agent edits inside a codebase, not in a vacuum.
 */
function declarations(src) {
  const map = new Map();
  const rx = /^[ \t]*(?:export\s+)?(?:(?:async\s+)?function\s*\*?\s+([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=)/gm;
  for (const m of src.matchAll(rx)) {
    const name = m[1] || m[2] || m[3];
    if (!name || map.has(name)) continue;
    let end;
    if (m[3]) {
      // A value declaration: take to the end of the statement, following any brace/bracket.
      const eq = src.indexOf('=', m.index);
      let i = eq + 1;
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] === '{' || src[i] === '[') {
        const close = matchBracket(src, i);
        end = close < 0 ? -1 : close + 1;
      } else {
        const nl = src.indexOf('\n', i);
        end = nl < 0 ? src.length : nl;
      }
    } else {
      const open = src.indexOf('{', m.index + m[0].length - 1);
      const close = open < 0 ? -1 : matchBrace(src, open);
      end = close < 0 ? -1 : close + 1;
    }
    if (end < 0) continue;
    map.set(name, src.slice(m.index, end).trim());
  }
  return map;
}

/** Like matchBrace but for `{` or `[`. */
function matchBracket(src, open) {
  const openCh = src[open];
  const closeCh = openCh === '{' ? '}' : ']';
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) return -1; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2); if (i < 0) return -1; i++; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      for (i++; i < src.length; i++) { if (src[i] === String.fromCharCode(92)) { i++; continue; } if (src[i] === q) break; }
      continue;
    }
    if (c === openCh) depth++;
    else if (c === closeCh) { depth--; if (!depth) return i; }
  }
  return -1;
}

/**
 * Extract units with their dependencies resolved, from one source string.
 * Shared with harvest_pipeline.mjs so repo files and local games go through identical
 * logic - two copies of a heuristic this fiddly would drift within a day.
 */
export function extractUnits(src, { min = 200, max = 6000, ctxMax = 8000 } = {}) {
  const decls = declarations(src);
  const out = [];
  for (const u of units(src)) {
    if (u.code.length < min || u.code.length > max) continue;
    const free = freeIdentifiers(u.code);
    const context = [];
    let unresolved = 0;
    for (const id of free) {
      const d = decls.get(id);
      if (!d || d === u.code) { unresolved++; continue; }
      context.push(d);
    }
    if (unresolved) continue;
    if (context.reduce((a, c) => a + c.length, 0) > ctxMax) continue;
    out.push({ kind: u.kind, name: u.name, code: u.code, context });
  }
  return out;
}

// Only scan and report when run directly; harvest_pipeline.mjs imports extractUnits.
if (CLI) {
  const targets = [];
  try {
    if (statSync(TARGET).isDirectory()) {
      for (const f of readdirSync(TARGET)) if (/\.html?$/i.test(f)) targets.push(join(TARGET, f));
    } else targets.push(TARGET);
  } catch (e) { console.error(e.message); process.exit(1); }

  const CTX_MAX = Number(flag('ctxmax', 8000));
  const rows = [];
  const seen = new Set();
  const declMap = new Map();
  const stats = { files: 0, raw: 0, tooSmall: 0, tooBig: 0, free: 0, ctxTooBig: 0, dupe: 0, kept: 0 };
  const freeHist = new Map();

  for (const t of targets) {
    let html = '';
    try { html = readFileSync(t, 'utf8'); } catch { continue; }
    stats.files++;
    const src = html.replace(DATA_URI, 'DATAURI');
    declMap.set(t, declarations(src));
    for (const body of scriptBodies(src)) {
      for (const u of units(body)) {
        stats.raw++;
        if (u.code.length < MIN) { stats.tooSmall++; continue; }
        if (u.code.length > MAX) { stats.tooBig++; continue; }
        const key = u.code.replace(/\s+/g, ' ');
        if (seen.has(key)) { stats.dupe++; continue; }
        seen.add(key);
        const free = freeIdentifiers(u.code);
        freeHist.set(free.length, (freeHist.get(free.length) || 0) + 1);

        // Resolve what it depends on, one hop, from the same file.
        const decls = declMap.get(t);
        const context = [];
        let unresolved = 0;
        for (const id of free) {
          const d = decls.get(id);
          if (!d || d === u.code) { unresolved++; continue; }
          context.push(d);
        }
        const ctxChars = context.reduce((a, c) => a + c.length, 0);
        if (unresolved) { stats.free++; continue; }
        if (ctxChars > CTX_MAX) { stats.ctxTooBig++; continue; }

        stats.kept++;
        rows.push({
          game: basename(t), kind: u.kind, name: u.name,
          chars: u.code.length, ctxChars, deps: free.length,
          context, code: u.code,
        });
      }
    }
  }

  console.log(`\nscanned ${stats.files} file(s)`);
  console.log(`  ${stats.raw} top-level unit(s) found`);
  console.log(`  -${stats.tooSmall} under ${MIN} chars`);
  console.log(`  -${stats.tooBig} over ${MAX} chars`);
  console.log(`  -${stats.dupe} identical to one already taken (version chains repeat a lot)`);
  console.log(`  -${stats.free} depend on something not declared anywhere in the file`);
  console.log(`  -${stats.ctxTooBig} need more than ${CTX_MAX} chars of context`);
  console.log(`  =${stats.kept} unit(s) with RESOLVED context\n`);
  const byName = new Map();
  for (const r of rows) byName.set(r.name, (byName.get(r.name) || 0) + 1);
  console.log(`  distinct names: ${byName.size}`);
  console.log(`  avg size: ${Math.round(rows.reduce((a, r) => a + r.chars, 0) / (rows.length || 1))} chars`);
  console.log('  free-identifier distribution (0 = self-contained):');
  for (const [n, c] of [...freeHist.entries()].sort((a, b) => a[0] - b[0]).slice(0, 8)) {
    console.log(`    ${String(n).padStart(3)} free -> ${c}`);
  }
  console.log('\n  sample kept:');
  for (const r of rows.slice(0, 8)) console.log(`    ${r.kind.padEnd(8)} ${r.name.padEnd(28)} ${String(r.chars).padStart(5)}ch  ${r.game.slice(0, 30)}`);

  if (EMIT) {
    writeFileSync(EMIT, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
    console.log(`\n  -> ${EMIT} (${rows.length} units, not yet prompted or verified)`);
  }

}
