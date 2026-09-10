/**
 * process_raw.mjs — the gate + build half of the data factory (runs locally).
 *
 *   node process_raw.mjs raw/raw_v0.4.1.jsonl 0.4.1
 *
 * Takes the raw Modal generations, applies the SAME runnability gate as
 * verify_gate.mjs (acorn free-variable analysis — zero free vars = self-contained
 * = trainable), dedups, and emits train-ready chat rows in the exact format of
 * correctness/dataset.jsonl. Only gate-PASS generations survive.
 *
 * Output:
 *   factory/dataset_v<ver>.jsonl   <- append this to ../correctness/dataset.jsonl
 *
 * The analyze()/GLOBALS/extractJS below are copied verbatim from verify_gate.mjs
 * so the factory's standard is byte-identical to the permanent gate. If you ever
 * change the gate, change it there and re-copy.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { analyze, extractJS } from './gate.mjs';

const RAW = process.argv[2];
const VER = process.argv[3] || 'batch';
if (!RAW || !existsSync(RAW)) { console.error('usage: node process_raw.mjs <raw.jsonl> <version>'); process.exit(1); }

const SYSTEM = 'You are a senior engineer who writes complete, self-contained, runnable code. Every identifier you reference must be declared or imported, declarations must precede use, and you only call methods/APIs that actually exist. Return code that runs as given.';
const MAX_CHARS = 14000;   // keep every row inside maxlen 8192 (matches build_correctness_dataset.mjs)

// ---- pull the first fenced code block out of a model reply ----
function extractBlock(text) {
  const m = text.match(/```(\w+)?\s*\n([\s\S]*?)```/);
  if (!m) return null;
  const tag = (m[1] || '').toLowerCase();
  const lang = tag === 'html' ? 'html' : 'js';
  return { lang, code: m[2].trim() };
}

// ---- run ----
const lines = readFileSync(RAW, 'utf8').split('\n').filter(Boolean);
let noBlock = 0, syntaxFail = 0, fragment = 0, tooBig = 0, dup = 0, pass = 0;
const seen = new Set();
const freeTally = new Map();
const rows = [];

for (const line of lines) {
  let rec; try { rec = JSON.parse(line); } catch { continue; }
  const blk = extractBlock(rec.text || '');
  if (!blk) { noBlock++; continue; }
  if (blk.code.length > MAX_CHARS) { tooBig++; continue; }
  const code = extractJS(blk.lang === 'html' ? 'x.html' : 'x.js', blk.code);
  const r = analyze(code);
  if (!r.syntax) { syntaxFail++; continue; }
  if (r.free.length) { fragment++; for (const n of r.free) freeTally.set(n, (freeTally.get(n) || 0) + 1); continue; }
  const h = createHash('sha1').update(blk.code).digest('hex');
  if (seen.has(h)) { dup++; continue; }
  seen.add(h);
  pass++;
  rows.push({ messages: [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: rec.spec },
    { role: 'assistant', content: '```' + blk.lang + '\n' + blk.code + '\n```' },
  ] });
}

const outPath = join('factory', `dataset_v${VER}.jsonl`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, rows.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');

const total = lines.length;
const pct = (n) => `${n} (${total ? (100 * n / total).toFixed(0) : 0}%)`;
console.log(`\n=== factory gate: ${RAW} (${total} generations) ===`);
console.log(`  VERIFIED (kept):       ${pct(pass)}`);
console.log(`  fragment (free vars):  ${pct(fragment)}`);
console.log(`  syntax error:          ${pct(syntaxFail)}`);
console.log(`  no code block:         ${pct(noBlock)}`);
console.log(`  too big (>${MAX_CHARS}):    ${pct(tooBig)}`);
console.log(`  duplicate:             ${pct(dup)}`);
const top = [...freeTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
if (top.length) {
  console.log(`\n  top rejected refs (why the fragments failed):`);
  for (const [name, n] of top) console.log(`    ${String(n).padStart(4)}  ${name}`);
}
console.log(`\n  -> ${outPath}  (${rows.length} verified rows)`);
console.log(`  append to the training set:`);
console.log(`    Get-Content ${outPath} | Add-Content ..\\correctness\\dataset.jsonl`);
