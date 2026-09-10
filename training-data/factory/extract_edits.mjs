/**
 * extract_edits.mjs - mine "edit-in-place" training rows from version chains of the
 * user's single-file HTML canvas games.
 *
 *   node factory/extract_edits.mjs raw-projects --out <path.jsonl> [--strict]
 *
 * WHY
 * ---
 * raw-projects/ holds ~144 saved copies of a handful of games. Most are successive
 * versions of the same game (dust-harvest-v10 -> v11 -> ..., cursebound_s10 -> s11 ...).
 * The DIFFERENCE between two consecutive versions of the same named function is a real
 * edit the author made to working code - exactly what an agent does inside an existing
 * codebase, and the one kind of row no public corpus gives us. This script:
 *
 *   1. groups files into families and orders versions (main version number, then mtime),
 *   2. extracts top-level units (functions/classes) from each version with tree-sitter,
 *   3. pairs units by NAME across consecutive versions and emits MODIFIED / ADDED rows,
 *      plus within-file REDEFINITION rows (the author patches by appending a second
 *      declaration of the same name - "Full replacement of X" - which wins at runtime),
 *   4. attaches a mechanical diff summary, dedupes identical edits across chains,
 *   5. prints real counts so the output can be judged rather than trusted.
 *
 * ORDERING FINDING
 * ----------------
 * A trailing `_N` is ambiguous in this corpus: dust-harvest-v34_1.._19 are working slices
 * saved BEFORE dust-harvest-v34.html (mtimes: v33 -> v34_1..19 -> v34 -> v35), while
 * v38-doorways_1 / slices1-17-final_1 / v35-multiplayer_1 are browser duplicate suffixes
 * saved AFTER their base file. mtime orders both cases correctly, so within one main
 * version number (v34, s11, ...) files are ordered by mtime. `(n)` copies are the same:
 * `x(1).html` is created only when `x.html` already exists, but `x.html` is often
 * overwritten later, so mtime, not the copy index, says which content is newer.
 *
 * UNIT EXTRACTION
 * ---------------
 * factory/ts_extract.mjs#extractUnits keeps only units whose free identifiers resolve to a
 * top-level declaration (right for standalone rows, ~35% loss here). Version diffs do not
 * need that guarantee, so by default this script walks the same AST itself and keeps every
 * named top-level function/class in the size window; each row carries `strict: true` when
 * extractUnits also accepted it (then `context` holds its resolved declarations). Pass
 * --strict to emit only those rows.
 *
 * Data URIs (inlined sprites/audio) are replaced with the literal DATAURI before parsing.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { extractUnits, parserFor } = await import(pathToFileURL(join(__dirname, 'ts_extract.mjs')).href);

// ── CLI ─────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const dirArg = argv.find((a) => !a.startsWith('--')) || 'raw-projects';
const outIdx = argv.indexOf('--out');
const OUT = outIdx > -1 ? argv[outIdx + 1] : 'edits.jsonl';
const STRICT_ONLY = argv.includes('--strict');
const RAW_DIR = resolve(dirArg);

const MIN = 80, MAX = 8000, CTX_MAX = 8000;
const UNIT_OPTS = { lang: 'js', min: MIN, max: MAX, ctxMax: CTX_MAX };
const DATA_URI_RE = /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+\/=]+/gi;
const UNIT_TYPES = new Set(['function_declaration', 'generator_function_declaration', 'class_declaration']);

// ── 1. families + ordering ──────────────────────────────────────────────────────
/** Words that mark a copy/state of a version rather than a different game. */
const VERSION_WORDS = new Set(['demo', 'playable', 'fixed', 'final', 'new', 'old', 'copy', 'test']);

/**
 * Parse a filename into { family, series, version, copy }.
 *   dust-harvest-v34_5.html        -> family dust-harvest, series v,     version 34, sub 5,    copy 0
 *   cursebound_s13(2).html         -> family cursebound,   series s,     version 13, sub null, copy 2
 *   index(7).html                  -> family index,        series -,     version null,         copy 7
 *   dust-harvest-fixed2(1).html    -> family dust-harvest, series fixed, version 2,  sub null, copy 1
 * Family = tokens before the first version-like token, minus VERSION_WORDS. Words after
 * the version token (multiplayer, jungle, stable) describe the version, not a new game.
 * `sub` is used for ordering only when every file at that main version carries one
 * (cursebound_v2_0/1/3/4); mixed groups (v34.html + v34_1..19) fall back to mtime.
 */
function parseName(file) {
  let base = file.replace(/\.html?$/i, '');
  let copy = 0;
  base = base.replace(/\((\d+)\)/g, (_, n) => { copy = Math.max(copy, +n); return ''; });
  const tokens = base.split(/[-_ .()]+/).filter(Boolean);
  const family = [];
  let version = null, series = '-', sub = null, prevWasVersion = false;
  for (const t of tokens) {
    const tl = t.toLowerCase();
    const m = /^([a-z]*)(\d+)([a-z]?)$/i.exec(t);
    if (m) {
      if (version !== null) {
        // a bare number right after the version token is a sub-version (v2_3, v34_5)
        if (prevWasVersion && !m[1] && !m[3]) sub = +m[2];
        prevWasVersion = false;
        continue;
      }
      prevWasVersion = true;
      const word = m[1].toLowerCase();
      version = +m[2];
      series = word || '-';
      if (word && !/^[vs]$/.test(word) && !VERSION_WORDS.has(word)) family.push(word);
      continue;
    }
    prevWasVersion = false;
    if (version !== null) continue;
    if (VERSION_WORDS.has(tl)) continue;
    family.push(tl);
  }
  return { file, family: family.join('-') || base.toLowerCase(), series, version, sub, copy };
}

/**
 * Order one family. A numbered series with >= 3 members is trusted: sorted by version
 * number, then mtime. Everything else (no number, or a minority series such as a lone
 * `fixed2` inside a v-numbered family) is inserted by mtime among them.
 */
function orderFamily(entries) {
  const bySeries = new Map();
  for (const e of entries) {
    if (e.version === null) continue;
    if (!bySeries.has(e.series)) bySeries.set(e.series, []);
    bySeries.get(e.series).push(e);
  }
  const trusted = [...bySeries.values()].filter((v) => v.length >= 3)
    .sort((p, q) => Math.min(...p.map((e) => e.mtime)) - Math.min(...q.map((e) => e.mtime)));
  const ordered = [];
  for (const block of trusted) {
    const allSub = new Map();
    for (const e of block) allSub.set(e.version, (allSub.get(e.version) ?? true) && e.sub !== null);
    block.sort((a, b) => a.version - b.version
      || (allSub.get(a.version) ? a.sub - b.sub : 0)
      || a.mtime - b.mtime);
    ordered.push(...block);
  }
  const rest = entries.filter((e) => !ordered.includes(e)).sort((a, b) => a.mtime - b.mtime);
  for (const e of rest) {
    let i = 0;
    while (i < ordered.length && ordered[i].mtime <= e.mtime) i++;
    ordered.splice(i, 0, e);
  }
  return ordered;
}

function buildFamilies(dir) {
  const files = readdirSync(dir).filter((f) => /\.html?$/i.test(f));
  const fams = new Map();
  for (const f of files) {
    const e = parseName(f);
    e.path = join(dir, f);
    e.mtime = statSync(e.path).mtimeMs;
    if (!fams.has(e.family)) fams.set(e.family, []);
    fams.get(e.family).push(e);
  }
  for (const [k, v] of fams) fams.set(k, orderFamily(v));
  return fams;
}

// ── 2. source + unit extraction ─────────────────────────────────────────────────
function scriptSource(html) {
  const stripped = html.replace(DATA_URI_RE, 'DATAURI');
  const parts = [];
  for (const m of stripped.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/i.test(m[1])) continue;
    if (/\btype\s*=\s*["'](?!(text\/javascript|module|application\/javascript)["'])/i.test(m[1])) continue;
    parts.push(m[2]);
  }
  return parts.join('\n;\n');
}

const fnBody = (n) => {
  if (!n) return null;
  if (n.type === 'parenthesized_expression') n = n.namedChild(0);
  if (n && (n.type === 'function_expression' || n.type === 'arrow_function' || n.type === 'function')) return n.childForFieldName('body');
  return null;
};

/**
 * Walk every named top-level function/class declaration in file order. Some games wrap
 * everything in `(function(){ ... })()` or an onload handler; when the root holds no
 * declarations, the largest wrapper block with >= 2 declarations is used instead.
 * Returns { units: [{kind,name,code}], unwrapped, hasError }.
 */
async function allUnits(src) {
  const parser = await parserFor('js');
  const tree = parser.parse(src);
  try {
    const root = tree.rootNode;
    const collect = (scope) => {
      const out = [];
      for (let i = 0; i < scope.namedChildCount; i++) {
        const n = scope.namedChild(i);
        if (!UNIT_TYPES.has(n.type)) continue;
        const nm = n.childForFieldName('name');
        if (!nm) continue;
        out.push({ kind: n.type.replace('_declaration', ''), name: nm.text, code: n.text });
      }
      return out;
    };
    let units = collect(root);
    let unwrapped = false, body = null;
    if (units.length === 0) {
      let best = null;
      const consider = (block) => {
        if (!block || block.type !== 'statement_block') return;
        if (collect(block).length >= 2 && (!best || block.text.length > best.text.length)) best = block;
      };
      for (let i = 0; i < root.namedChildCount; i++) {
        const st = root.namedChild(i);
        if (st.type !== 'expression_statement') continue;
        let ex = st.namedChild(0);
        if (ex && ex.type === 'assignment_expression') ex = ex.childForFieldName('right');
        if (!ex) continue;
        if (ex.type === 'call_expression') {
          consider(fnBody(ex.childForFieldName('function')));
          const args = ex.childForFieldName('arguments');
          if (args) for (let j = 0; j < args.namedChildCount; j++) consider(fnBody(args.namedChild(j)));
        } else consider(fnBody(ex));
      }
      if (best) { units = collect(best); unwrapped = true; body = best.text.slice(1, -1); }
    }
    return { units, unwrapped, body, hasError: root.hasError };
  } finally {
    if (typeof tree.delete === 'function') tree.delete();
  }
}

const fileCache = new Map();
/**
 * Per file: { last: Map name -> unit (LAST declaration wins, as at runtime),
 *             redefs: [{earlier, later}], strictCount, allCount, ... }
 * Each unit: { kind, name, code, context, strict }.
 */
async function unitsOf(entry) {
  if (fileCache.has(entry.file)) return fileCache.get(entry.file);
  const html = readFileSync(entry.path, 'utf8');
  const src = scriptSource(html);
  const strict = await extractUnits(src, UNIT_OPTS);
  const strictKey = new Map(strict.map((u) => [u.name + '\0' + normWS(u.code), u]));
  const { units, unwrapped, body, hasError } = await allUnits(src);
  if (unwrapped && body) {
    // extractUnits saw only the wrapper; re-run it on the unwrapped body for context.
    const inner = await extractUnits(body, UNIT_OPTS);
    for (const u of inner) strictKey.set(u.name + '\0' + normWS(u.code), u);
  }
  const last = new Map();
  const lastAny = new Map(); // every size, for diagnosing pairs whose only edits are oversize
  const redefs = [];
  let inWindow = 0;
  for (const u of units) {
    lastAny.set(u.name, u.code);
    if (u.code.length < MIN || u.code.length > MAX) continue;
    inWindow++;
    const s = strictKey.get(u.name + '\0' + normWS(u.code));
    const unit = { kind: u.kind, name: u.name, code: u.code, context: s ? s.context : [], strict: !!s };
    const prev = last.get(u.name);
    if (prev) redefs.push({ earlier: prev, later: unit });
    last.set(u.name, unit);
  }
  const rawFns = (src.match(/^[ \t]*(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/gm) || []).length;
  const info = { last, lastAny, redefs, srcHash: hash(normWS(src)), srcLen: src.length, allCount: units.length, inWindow, strictCount: strict.length, rawFns, unwrapped, hasError };
  fileCache.set(entry.file, info);
  return info;
}

// ── 3. comparison helpers ───────────────────────────────────────────────────────
function normWS(s) { return s.replace(/\s+/g, ' ').trim(); }

/** Strip line and block comments while respecting quote/backtick strings. Regex literals are not modelled. */
function stripComments(s) {
  let out = '';
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i], d = s[i + 1];
    if (c === '/' && d === '/') { while (i < n && s[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { const e = s.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n && s[j] !== c) { if (s[j] === '\\') j++; if (c !== '`' && s[j] === '\n') break; j++; }
      out += s.slice(i, j + 1); i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}
const normCode = (s) => normWS(stripComments(s));

function hash(s) {
  let h1 = 0x811c9dc5, h2 = 0x1000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x0100019b) >>> 0;
  }
  return h1.toString(16) + h2.toString(16) + ':' + s.length;
}

const KEYWORDS = new Set(('break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield async await of static get set null undefined true false NaN Infinity').split(' '));
function identifiers(code) {
  const ids = new Set();
  for (const m of stripComments(code).matchAll(/(?<![\w$.'"`])[A-Za-z_$][\w$]*/g)) if (!KEYWORDS.has(m[0])) ids.add(m[0]);
  return ids;
}

/** Line-level LCS diff -> added/removed counts and the first differing line pair. */
function lineDiff(before, after) {
  const a = before.split('\n').map((l) => l.trimEnd());
  const b = after.split('\n').map((l) => l.trimEnd());
  const n = a.length, m = b.length;
  let p = 0;
  while (p < n && p < m && a[p] === b[p]) p++;
  let s = 0;
  while (s < n - p && s < m - p && a[n - 1 - s] === b[m - 1 - s]) s++;
  const A = a.slice(p, n - s), B = b.slice(p, m - s);
  const N = A.length, M = B.length;
  const dp = Array.from({ length: N + 1 }, () => new Uint16Array(M + 1));
  for (let i = N - 1; i >= 0; i--) for (let j = M - 1; j >= 0; j--) {
    dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  let i = 0, j = 0, added = 0, removed = 0;
  let firstBefore = null, firstAfter = null;
  while (i < N || j < M) {
    if (i < N && j < M && A[i] === B[j]) { i++; j++; continue; }
    if (j < M && (i >= N || dp[i][j + 1] >= dp[i + 1][j])) { if (firstAfter === null) firstAfter = B[j].trim(); added++; j++; }
    else { if (firstBefore === null) firstBefore = A[i].trim(); removed++; i++; }
  }
  return { linesAdded: added, linesRemoved: removed, firstDiff: { before: firstBefore, after: firstAfter }, beforeLines: n, afterLines: m };
}

function diffSummary(before, after) {
  const idsA = before ? identifiers(before) : new Set();
  const idsB = identifiers(after);
  const newIds = [...idsB].filter((x) => !idsA.has(x));
  const goneIds = [...idsA].filter((x) => !idsB.has(x));
  const ld = lineDiff(before || '', after);
  return { ...ld, newIdentifiers: newIds.slice(0, 40), droppedIdentifiers: goneIds.slice(0, 40) };
}

// ── 4. main ─────────────────────────────────────────────────────────────────────
const fams = buildFamilies(RAW_DIR);
const famList = [...fams.entries()].sort((a, b) => b[1].length - a[1].length);
const multi = famList.filter(([, v]) => v.length > 1);

// extract every chained file up front so the ordering table can show sizes/unit counts
for (const [, list] of multi) for (const e of list) await unitsOf(e);
// A version that does not parse (the author saved a broken file) loses every declaration
// after the error, which would show up as hundreds of fake removals then fake additions.
// Such files are shown in the ordering but skipped when forming pairs.
const brokenFiles = [];
for (const [fam, list] of multi) for (const e of list) if (fileCache.get(e.file).hasError) brokenFiles.push(e.file);
const chains = multi.map(([fam, list]) => [fam, list.filter((e) => !fileCache.get(e.file).hasError)]).filter(([, l]) => l.length > 1);

console.log(`files: ${[...fams.values()].reduce((a, v) => a + v.length, 0)}   families: ${fams.size}   multi-version families: ${multi.length}   files in chains: ${multi.reduce((a, [, v]) => a + v.length, 0)}`);
console.log('\n== ordering of the 5 biggest families (version | mtime | script chars | units | file) ==');
const fmtT = (ms) => new Date(ms).toISOString().replace('T', ' ').slice(0, 16);
for (const [fam, list] of famList.slice(0, 5)) {
  console.log(`\n[${fam}] ${list.length} versions`);
  let inversions = 0, shrinks = 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i], info = fileCache.get(e.file);
    const prevInfo = i ? fileCache.get(list[i - 1].file) : null;
    const inv = i && e.mtime < list[i - 1].mtime;
    const shrink = prevInfo && info.srcLen < prevInfo.srcLen;
    if (inv) inversions++;
    if (shrink) shrinks++;
    const key = (e.series === '-' ? '' : e.series) + (e.version === null ? '?' : e.version) + (e.sub !== null ? '.' + e.sub : '') + (e.copy ? `(${e.copy})` : '');
    console.log(`  ${String(i + 1).padStart(3)}. ${key.padEnd(10)} ${fmtT(e.mtime)}  ${String(info.srcLen).padStart(8)}  ${String(info.last.size).padStart(4)}  ${e.file}${inv ? '  <- mtime earlier than previous' : ''}${shrink ? '  <- smaller than previous' : ''}${info.hasError ? '  <- PARSE ERROR, skipped from pairs' : ''}`);
  }
  console.log(`  mtime inversions vs chosen order: ${inversions}; versions smaller than their predecessor: ${shrinks}`);
}
console.log('\n== other multi-version families ==');
for (const [fam, list] of famList.slice(5)) if (list.length > 1) console.log(`  ${fam.padEnd(28)} ${list.length}: ${list.map((e) => e.file.replace(/\.html$/, '')).join(' -> ')}`);
console.log(`  singles (${famList.filter(([, v]) => v.length === 1).length}): ${famList.filter(([, v]) => v.length === 1).map(([k]) => k).join(', ')}`);

const stats = {
  pairs: 0, pairsIdenticalSource: 0, pairsNoUnitChange: 0, pairsOversizeOnly: 0, pairsAllDeduped: 0,
  modified: 0, added: 0, redefined: 0, removed: 0, skippedCommentOnly: 0, skippedOversize: 0, skippedNonStrict: 0, dedupDropped: 0,
  perFamily: new Map(),
};
const seen = new Set();
const rows = [];
const zeroPairs = [];

function emit(row, famCounter) {
  if (STRICT_ONLY && !row.strict) { stats.skippedNonStrict++; return false; }
  const key = hash(normWS(row.before || '')) + '|' + hash(normWS(row.after));
  if (seen.has(key)) { stats.dedupDropped++; return false; }
  seen.add(key);
  row.diffSummary = diffSummary(row.before, row.after);
  rows.push(row);
  stats.perFamily.set(famCounter, (stats.perFamily.get(famCounter) || 0) + 1);
  return true;
}

console.log(`\nparse-error files skipped from pairs (${brokenFiles.length}): ${brokenFiles.join(', ') || '-'}`);

for (const [fam, list] of chains) {
  // within-file redefinitions (each file once)
  for (const e of list) {
    const info = fileCache.get(e.file);
    for (const { earlier, later } of info.redefs) {
      if (normWS(earlier.code) === normWS(later.code)) continue;
      if (normCode(earlier.code) === normCode(later.code)) { stats.skippedCommentOnly++; continue; }
      stats.redefined++;
      emit({ family: fam, from: e.file, to: e.file, name: later.name, kind: later.kind, before: earlier.code, after: later.code, context: earlier.context, changeKind: 'modify', origin: 'redefinition', strict: earlier.strict && later.strict }, fam);
    }
  }
  for (let i = 0; i + 1 < list.length; i++) {
    const A = list[i], B = list[i + 1];
    const ua = fileCache.get(A.file), ub = fileCache.get(B.file);
    stats.pairs++;
    let changes = 0, emitted = 0;
    if (ua.srcHash === ub.srcHash) stats.pairsIdenticalSource++;
    for (const [name, u] of ub.last) {
      const prev = ua.last.get(name);
      let row;
      if (!prev) {
        changes++;
        row = { family: fam, from: A.file, to: B.file, name, kind: u.kind, before: null, after: u.code, context: u.context, changeKind: 'add', origin: 'version', strict: u.strict };
        stats.added++;
      } else {
        if (normWS(prev.code) === normWS(u.code)) continue;
        changes++;
        if (normCode(prev.code) === normCode(u.code)) { stats.skippedCommentOnly++; continue; }
        row = { family: fam, from: A.file, to: B.file, name, kind: u.kind, before: prev.code, after: u.code, context: prev.context, changeKind: 'modify', origin: 'version', strict: prev.strict && u.strict };
        stats.modified++;
      }
      if (emit(row, fam)) emitted++;
    }
    for (const name of ua.last.keys()) if (!ub.last.has(name)) stats.removed++;
    if (changes === 0) {
      stats.pairsNoUnitChange++;
      let oversize = 0;
      for (const [name, code] of ub.lastAny) { const p = ua.lastAny.get(name); if (code.length > MAX && (!p || normWS(p) !== normWS(code))) oversize++; }
      if (oversize) stats.pairsOversizeOnly++;
      zeroPairs.push({ a: A.file, b: B.file, identical: ua.srcHash === ub.srcHash, srcDelta: ub.srcLen - ua.srcLen, why: oversize ? `only ${oversize} unit(s) > ${MAX} chars changed` : 'no top-level unit changed (edits in data/top-level statements)' });
    }
    else if (emitted === 0) { stats.pairsAllDeduped++; zeroPairs.push({ a: A.file, b: B.file, identical: false, srcDelta: ub.srcLen - ua.srcLen, why: `${changes} change(s), all seen in another chain` }); }
  }
}

mkdirSync(dirname(resolve(OUT)), { recursive: true });
writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));

// ── 5. report ───────────────────────────────────────────────────────────────────
const median = (xs) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const mods = rows.filter((r) => r.changeKind === 'modify');
const adds = rows.filter((r) => r.changeKind === 'add');
const verMods = mods.filter((r) => r.origin === 'version');
const redefs = mods.filter((r) => r.origin === 'redefinition');
let allUnitsN = 0, inWindowN = 0, strictN = 0, rawN = 0, unwrappedN = 0, errN = 0;
for (const info of fileCache.values()) { allUnitsN += info.allCount; inWindowN += info.inWindow; strictN += info.strictCount; rawN += info.rawFns; if (info.unwrapped) unwrappedN++; if (info.hasError) errN++; }

console.log('\n== results ==');
console.log(`version pairs compared:        ${stats.pairs}`);
console.log(`  no unit-level change:        ${stats.pairsNoUnitChange}  (script byte-identical after data-URI strip: ${stats.pairsIdenticalSource}; edits only in functions > ${MAX} chars: ${stats.pairsOversizeOnly})`);
console.log(`  changes all deduped away:    ${stats.pairsAllDeduped}  (same edits already emitted from another chain)`);
console.log(`units (chained files):         top-level decls ${allUnitsN}; in ${MIN}..${MAX} window ${inWindowN}; accepted by strict extractUnits ${strictN}; regex-visible function decls ${rawN}`);
console.log(`files IIFE-unwrapped: ${unwrappedN}; files with parse errors: ${errN}`);
console.log(`rows written:                  ${rows.length}  -> ${resolve(OUT)}${STRICT_ONLY ? '   (--strict: non-strict rows skipped: ' + stats.skippedNonStrict + ')' : ''}`);
console.log(`  modify (version->version): ${verMods.length}   modify (within-file redefinition): ${redefs.length}   add: ${adds.length}`);
console.log(`  strict (free identifiers resolve): ${rows.filter((r) => r.strict).length}   non-strict: ${rows.filter((r) => !r.strict).length}`);
console.log(`  before dedupe: modify ${stats.modified}, redefinition ${stats.redefined}, add ${stats.added}; dedupe dropped ${stats.dedupDropped}`);
console.log(`  skipped: removed-only names ${stats.removed}, whitespace/comment-only changes ${stats.skippedCommentOnly}`);
console.log(`median before size (modify):   ${median(mods.map((r) => r.before.length))} chars   median after (modify): ${median(mods.map((r) => r.after.length))}   median after (add): ${median(adds.map((r) => r.after.length))}   median after (all): ${median(rows.map((r) => r.after.length))}`);
console.log('\nrows per family (top 10):');
for (const [fam, n] of [...stats.perFamily.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${fam.padEnd(28)} ${n}`);
console.log('\npairs that produced zero rows:');
for (const z of zeroPairs) console.log(`  ${z.identical ? 'IDENTICAL' : 'differs  '} ${z.a} -> ${z.b}${z.identical ? '' : `  (script delta ${z.srcDelta >= 0 ? '+' : ''}${z.srcDelta}; ${z.why})`}`);
const changeKinds = {};
for (const r of rows) changeKinds[r.changeKind] = (changeKinds[r.changeKind] || 0) + 1;
console.log('\nrows by changeKind:', JSON.stringify(changeKinds));

const trunc = (s, n = 300) => s == null ? null : (s.length > n ? s.slice(0, n) + `… [${s.length} chars]` : s);
console.log('\n== example rows ==');
const picks = [];
if (verMods.length) picks.push(verMods[Math.floor(verMods.length * 0.3)]);
if (redefs.length) picks.push(redefs[Math.floor(redefs.length * 0.5)]);
if (adds.length) picks.push(adds[Math.floor(adds.length * 0.5)]);
for (const r of picks) {
  const { diffSummary: d } = r;
  console.log(`\n--- ${r.changeKind}/${r.origin} ${r.kind} ${r.name}  [${r.family}] ${r.from} -> ${r.to}  strict=${r.strict}`);
  console.log(`diffSummary: +${d.linesAdded}/-${d.linesRemoved} lines; new ids: ${d.newIdentifiers.slice(0, 8).join(', ')}; dropped: ${d.droppedIdentifiers.slice(0, 8).join(', ')}`);
  console.log(`first diff: - ${trunc(d.firstDiff.before, 120)}\n            + ${trunc(d.firstDiff.after, 120)}`);
  console.log(`BEFORE: ${trunc(r.before)}`);
  console.log(`AFTER:  ${trunc(r.after)}`);
}
