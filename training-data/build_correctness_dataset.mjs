/**
 * build_correctness_dataset.mjs — assemble correctness/dataset.jsonl (chat format).
 *
 * Sources (all already gate-verified):
 *   correctness/repairs/  — prompts are real (broken+error → fix). Used as-is.
 *   correctness/clean/    — module/game code. Instruction derived from the file's
 *                           leading doc-comment (no model backtranslation needed).
 *   correctness/games/    — whole small games. Instruction from family/source.
 *
 * System prompt is correctness-first so the objective itself rewards runnable code.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(process.cwd(), 'correctness');
const MAX_CHARS = 14000;   // keep every row inside maxlen 8192 (repair rows carry code twice)
const SYSTEM = 'You are a senior engineer who writes complete, self-contained, runnable code. Every identifier you reference must be declared or imported, declarations must precede use, and you only call methods/APIs that actually exist. Return code that runs as given.';

function headerDoc(code) {
  const m = code.match(/^﻿?\s*\/\*\*?([\s\S]*?)\*\//);
  if (!m) return null;
  const line = m[1].split('\n').map(s => s.replace(/^\s*\*?\s?/, '').trim()).find(Boolean);
  if (!line) return null;
  return line.replace(/^[\w./()-]+\.(js|mjs|html)\b\s*[—:-]+\s*/i, '').trim();
}
function instructionFor(dir, name, promptTxt, code, lang) {
  if (promptTxt && !/\[REVIEW/.test(promptTxt)) return promptTxt.trim();   // real prompt (repairs)
  const doc = headerDoc(code);
  if (lang === 'html') {
    const fam = (name.match(/-game-([\w-]+)/) || [, name])[1].replace(/-/g, ' ');
    return `Write a complete, self-contained single-file HTML5 canvas game: ${doc || fam}.`;
  }
  return doc
    ? `Write a complete, self-contained, runnable JavaScript module that does the following: ${doc}`
    : `Write a complete, self-contained, runnable JavaScript module named ${name.replace(/^\d+-\w+-/, '')}.`;
}

const rows = [];
for (const sub of ['repairs', 'clean', 'games']) {
  const base = join(ROOT, sub);
  if (!existsSync(base)) continue;
  let n = 0;
  for (const d of readdirSync(base)) {
    let files; try { files = readdirSync(join(base, d)); } catch { continue; }
    const out = files.find(f => f.startsWith('output') && (f.endsWith('.js') || f.endsWith('.html')));
    if (!out) continue;
    const code = readFileSync(join(base, d, out), 'utf8');
    if (code.length > MAX_CHARS) continue;   // too big for a training example — would truncate
    const lang = out.endsWith('.html') ? 'html' : 'js';
    const pf = join(base, d, 'prompt.txt');
    const promptTxt = existsSync(pf) ? readFileSync(pf, 'utf8') : '';
    const instr = instructionFor(sub, d, promptTxt, code, lang);
    rows.push({ messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: instr },
      { role: 'assistant', content: `\`\`\`${lang}\n${code}\n\`\`\`` },
    ] });
    n++;
  }
  console.log(`  ${sub.padEnd(8)} ${n}`);
}

const outPath = join(ROOT, 'dataset.jsonl');
writeFileSync(outPath, rows.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');
console.log(`\ncorrectness/dataset.jsonl  ->  ${rows.length} rows`);
