/**
 * buildcorpus14b.mjs - turn ONE real-model run folder into replay-corpus rows, tagged.
 *
 *   node buildcorpus14b.mjs <runsDir> <out.jsonl> <model> <source> [existingCorpus.jsonl]
 *
 * Same row shape as server/testdata/model-corpus.jsonl (goal, status, text, actions,
 * hasThought, hasPath, fenced, resultWasError) plus `model` and `source`, so a later slice
 * ("14B only") is one filter away. The original corpus rows carry neither, which is why the
 * traces contamination could not be separated - these must never have that problem.
 *
 * Dedupes against itself AND against an existing corpus (same first 400 chars), so appending
 * the output never duplicates a reply the fuzzer already has.
 */
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [runsDir, OUT, MODEL, SOURCE, EXISTING] = process.argv.slice(2);
if (!runsDir || !OUT || !MODEL || !SOURCE) {
  console.error('usage: node buildcorpus14b.mjs <runsDir> <out.jsonl> <model> <source> [existingCorpus.jsonl]');
  process.exit(2);
}

const seen = new Set();
let preexisting = 0;
if (EXISTING && existsSync(EXISTING)) {
  for (const l of readFileSync(EXISTING, 'utf8').split('\n').filter(Boolean)) {
    try { seen.add(String(JSON.parse(l).text || '').slice(0, 400)); preexisting++; } catch { /* skip */ }
  }
}

const rows = [];
let runsScanned = 0, dupes = 0;
for (const f of readdirSync(runsDir).filter((x) => x.endsWith('.json'))) {
  let r; try { r = JSON.parse(readFileSync(join(runsDir, f), 'utf8')); } catch { continue; }
  runsScanned++;
  const hist = r.history || [];
  for (let i = 0; i < hist.length; i++) {
    const m = hist[i];
    if (m.role !== 'assistant') continue;
    const text = String(m.content || '');
    if (!text.trim()) continue;
    const key = text.slice(0, 400);
    if (seen.has(key)) { dupes++; continue; }
    seen.add(key);
    const actions = (text.match(/ACTION:\s*([a-z_]+)/gi) || []).map((s) => s.split(':')[1].trim().toLowerCase());
    const next = hist[i + 1];
    const result = next && next.role === 'user' ? String(next.content || '').slice(0, 300) : '';
    rows.push({
      goal: String(r.goal || '').slice(0, 90),
      status: r.status,
      text,
      actions,
      hasThought: /THOUGHT:/i.test(text),
      hasPath: /PATH:/i.test(text),
      fenced: /```/.test(text),
      resultWasError: /^TOOL RESULT[^\n]*\n?ERROR:/m.test(result) || /\bERROR:/.test(result.slice(0, 120)),
      model: MODEL,
      source: SOURCE,
    });
  }
}

writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''), 'utf8');
const count = (p) => rows.filter(p).length;
console.log(`runs scanned            : ${runsScanned}`);
console.log(`new unique replies      : ${rows.length}   (dupes skipped ${dupes}, vs ${preexisting} existing corpus rows)`);
console.log(`  acting (>=1 action)   : ${count((r) => r.actions.length > 0)}`);
console.log(`  multi-action          : ${count((r) => r.actions.length > 1)}`);
console.log(`  no THOUGHT            : ${count((r) => !r.hasThought)}`);
console.log(`  hub answered ERROR    : ${count((r) => r.resultWasError)}`);
console.log(`written to ${OUT}`);
