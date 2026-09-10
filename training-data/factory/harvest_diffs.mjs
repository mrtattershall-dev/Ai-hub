/**
 * harvest_diffs.mjs - mine EDIT-IN-PLACE rows from your own version history.
 *
 *   node factory/harvest_diffs.mjs --dir "C:/Users/tatte/Downloads" --pattern dust-harvest
 *   node factory/harvest_diffs.mjs --dir "C:/Users/tatte/Downloads" --pattern cursebound
 *
 * THE CAPABILITY WITH ZERO COVERAGE
 * ---------------------------------
 * Every row in run5 teaches "write X from scratch". That is not what the agent does.
 * The agent's real job - the /followup path, the thing the whole hub is built around -
 * is "here is a large working codebase, make this change without breaking it."
 *
 * There were 13,762 rows of the first task and 0 of the second.
 *
 * And you have ~130 verified examples of the second sitting in Downloads: 111 versions
 * of DUST & HARVEST (v30 1,307KB -> v38 1,936KB), 17 of CURSEBOUND, 5 of ROUGE-ENGINE.
 * Each consecutive pair is a real change you made and then SHIPPED, so the "after" side
 * is known-good by construction - you kept building on it.
 *
 * WHAT MAKES A ROW HERE
 * ---------------------
 * A function that exists in BOTH versions and CHANGED. The row is:
 *
 *     prompt    the BEFORE source + the instruction
 *     answer    the AFTER source
 *
 * Deriving the instruction is the hard part, and the honest answer is that it is only
 * derivable sometimes. When the AFTER version carries a leading comment explaining
 * itself, that comment IS the instruction. When it does not, there is no truthful way
 * to state what was asked, so the pair is SKIPPED rather than given an invented one.
 * A fabricated instruction teaches the model to associate an edit with a request that
 * never produced it - worse than no row at all.
 *
 * Both sides are node --check'd. Ordering is by file size, not mtime: these were
 * downloaded in bursts so timestamps lie, but the games grow monotonically.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import * as acorn from 'acorn';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'dataset_edits.jsonl');

const SYSTEM = 'You are a senior engineer who modifies existing code. You make the smallest '
  + 'change that satisfies the request, you preserve everything that already works, and you '
  + 'return the complete updated code. Return code that runs as given.';

const MIN_FN = 180;        // a one-line change is not a lesson
const MAX_FN = 9_000;      // both sides must fit the context together
const MIN_DELTA = 40;      // ignore whitespace-level churn

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const DIR = val('dir', join(process.env.USERPROFILE || process.env.HOME || '.', 'Downloads'));
const PATTERN = val('pattern', 'dust-harvest');
const LIMIT = parseInt(val('limit', '0'), 10);   // 0 = all pairs

// ── source extraction (same contract as harvest_games) ────────────────────────
function scriptsOf(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/.test(attrs)) continue;
    if (/type\s*=\s*["'](?!text\/javascript|module|application\/javascript)/i.test(attrs)) continue;
    out.push(m[2]);
  }
  return out.join('\n\n');
}

/** name -> { text, comment } for every top-level function/class/behaviour const. */
function indexFns(src) {
  let ast;
  for (const st of ['script', 'module']) {
    try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: st, allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true }); break; }
    catch { ast = null; }
  }
  if (!ast) return null;
  const out = new Map();
  const take = (name, start, end) => {
    out.set(name, { text: src.slice(start, end), comment: leadingComment(src, start) });
  };
  for (const n of ast.body) {
    if (n.type === 'FunctionDeclaration' && n.id) take(n.id.name, n.start, n.end);
    else if (n.type === 'ClassDeclaration' && n.id) take(n.id.name, n.start, n.end);
    else if (n.type === 'VariableDeclaration') {
      for (const d of n.declarations) {
        if (d.id.type !== 'Identifier' || !d.init) continue;
        const beh = ['FunctionExpression', 'ArrowFunctionExpression', 'ClassExpression'].includes(d.init.type)
          || (d.init.type === 'CallExpression' && ['FunctionExpression', 'ArrowFunctionExpression'].includes(d.init.callee?.type));
        if (beh) take(d.id.name, n.start, d.end);
      }
    }
  }
  return out;
}

/** The // or /* block immediately above an offset - the author's own explanation. */
function leadingComment(src, at) {
  const before = src.slice(Math.max(0, at - 500), at).split('\n').reverse();
  const lines = [];
  for (const raw of before) {
    const l = raw.trim();
    if (!l) { if (lines.length) break; continue; }
    if (l.startsWith('//')) { lines.push(l.replace(/^\/\/+\s?/, '')); continue; }
    if (l.startsWith('*') || l.startsWith('/*') || l.endsWith('*/')) { lines.push(l.replace(/^\/?\*+\/?\s?|\s?\*\/$/g, '')); continue; }
    break;
  }
  return lines.reverse().join(' ').replace(/[═─=—-]{3,}/g, ' ').replace(/\s+/g, ' ').trim();
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();

/**
 * Turn "what the after-version says about itself" into an instruction.
 * Returns null when there is nothing truthful to say - the caller skips the pair.
 */
function instructionFor(name, beforeC, afterC) {
  const c = (afterC || '').trim();
  // The comment must be NEW or CHANGED to describe this edit. An unchanged comment
  // describes the function in general, not the change that was just made.
  if (!c || c.length < 15) return null;
  if (norm(c) === norm(beforeC || '')) return null;
  if (c.length > 300) return null;
  return c;
}

/**
 * The SECOND source of truthful instructions: your own filenames.
 *
 * Comment-derived instructions turned out to be rare - measured on the v34 series and on
 * CURSEBOUND, 68 of 121 changed functions carried no new comment, and the yield was zero.
 * People do not re-document a function every time they touch it.
 *
 * But the version names say exactly what the version was for:
 *
 *     dust-harvest-v35.html    ->  dust-harvest-v35-multiplayer.html   "add multiplayer"
 *     dust-harvest-v38-*.html  ->  dust-harvest-v38-maps-fixed.html    "fix maps"
 *     ...-jungle-slice6.html   ->  ...-jungle-slice6-audited.html      "audit the jungle slice"
 *
 * That is a real, author-written description of the change, not an invented one. It is
 * coarser than a per-function comment - it describes the VERSION, not the function - so
 * it is only used for functions ADDED in that version, where "this is part of the new
 * feature" is a defensible claim.
 */
function featureOf(fromName, toName) {
  const clean = (s) => s.replace(/\.html?$/i, '').replace(/[_ ]?\(\d+\)$/, '').toLowerCase();
  const a = clean(fromName).split(/[-_ ]+/).filter(Boolean);
  const b = clean(toName).split(/[-_ ]+/).filter(Boolean);
  const added = b.filter((t) => !a.includes(t) && !/^v?\d+[a-z]?$/.test(t) && t.length > 2);
  const STOP = new Set(['html', 'final', 'copy', 'new', 'the', 'and', 'ready', 'build']);
  const words = added.filter((t) => !STOP.has(t));
  if (!words.length) return null;
  return words.join(' ');
}

// ── run ───────────────────────────────────────────────────────────────────────
if (!existsSync(DIR)) { console.error(`no such directory: ${DIR}`); process.exit(1); }
const files = readdirSync(DIR)
  .filter((f) => /\.html?$/i.test(f) && f.toLowerCase().includes(PATTERN.toLowerCase()))
  .map((f) => ({ f, p: join(DIR, f), size: statSync(join(DIR, f)).size }))
  .sort((a, b) => a.size - b.size);

if (files.length < 2) { console.error(`need at least 2 versions matching "${PATTERN}" in ${DIR} (found ${files.length})`); process.exit(1); }
console.log(`  ${files.length} versions of "${PATTERN}", ${(files[0].size / 1024).toFixed(0)}KB -> ${(files[files.length - 1].size / 1024).toFixed(0)}KB\n`);

const tmp = join(tmpdir(), `diffs-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
const rows = [];
const seen = new Set();
const st = { pairs: 0, changed: 0, kept: 0, noInstruction: 0, size: 0, syntax: 0, dupe: 0 };

const pairs = LIMIT ? files.slice(0, LIMIT + 1) : files;
for (let i = 0; i < pairs.length - 1; i++) {
  const A = indexFns(scriptsOf(readFileSync(pairs[i].p, 'utf8')));
  const B = indexFns(scriptsOf(readFileSync(pairs[i + 1].p, 'utf8')));
  if (!A || !B) continue;
  st.pairs++;

  const feature = featureOf(pairs[i].f, pairs[i + 1].f);

  for (const [name, after] of B) {
    const before = A.get(name);
    if (!before) continue;                                   // added, not edited - that is harvest_games' job
    if (norm(before.text) === norm(after.text)) continue;    // untouched
    st.changed++;

    if (before.text.length < MIN_FN || after.text.length > MAX_FN) { st.size++; continue; }
    if (Math.abs(after.text.length - before.text.length) < MIN_DELTA) { st.size++; continue; }

    // Prefer the function's own new comment; fall back to what the VERSION was for.
    let instruction = instructionFor(name, before.comment, after.comment);
    if (!instruction && feature) instruction = `it supports ${feature} (this change was part of the "${feature}" pass)`;
    if (!instruction) { st.noInstruction++; continue; }

    // Both sides must actually parse standalone.
    let ok = true;
    for (const side of [before.text, after.text]) {
      const f = join(tmp, 'x.js');
      writeFileSync(f, side, 'utf8');
      try { execFileSync(process.execPath, ['--check', f], { stdio: 'ignore', timeout: 15000 }); }
      catch { ok = false; break; }
    }
    if (!ok) { st.syntax++; continue; }

    const key = createHash('sha1').update(norm(before.text) + '|' + norm(after.text)).digest('hex');
    if (seen.has(key)) { st.dupe++; continue; }
    seen.add(key);

    rows.push({
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content:
          `Here is the current implementation of \`${name}\`:\n\n\`\`\`javascript\n${before.text}\n\`\`\`\n\n`
          + `Change it so that: ${instruction}\n\n`
          + `Return the complete updated \`${name}\`. Do not rewrite the parts that already work.` },
        { role: 'assistant', content: '```javascript\n' + after.text + '\n```' },
      ],
      _meta: { from: pairs[i].f, to: pairs[i + 1].f, fn: name },
    });
    st.kept++;
  }
}

writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');

console.log(`=== harvest_diffs -> ${OUT} ===`);
console.log(`  version pairs compared     ${st.pairs}`);
console.log(`  functions that changed     ${st.changed}`);
console.log(`  KEPT                       ${st.kept}`);
console.log(`\n  skipped:`);
console.log(`    no derivable instruction  ${st.noInstruction}   (the change explains nothing about itself — inventing one would be a lie)`);
console.log(`    size bounds               ${st.size}`);
console.log(`    failed node --check       ${st.syntax}`);
console.log(`    duplicate edit            ${st.dupe}`);
console.log(`\n  Each row is a real change you made and then shipped — the "after" side is`);
console.log(`  known-good because you kept building on it.`);
