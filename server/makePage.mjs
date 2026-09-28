#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// makePage.mjs — generate ONE page from a one-line request, recording the exact request used.
//
//   node server/makePage.mjs --dir legasus/bench/traffic --ask "..." --seam firm --out-name baseline-a2.html
//
// ASSISTED-1's budget says page generation does not count against the 20 attempt calls, so a page that
// fails the baseline requirement can be regenerated. What must not happen is regenerating it quietly:
// every attempt's request text, sha and outcome goes in the record, because "the model wrote this page
// from a one-line request" is only true of the request that was actually used.
//
// The seam is harness plumbing - somewhere for the checker to read state - and is identical whatever
// the addition turns out to be. Strengthening its wording is setup, not assistance about the task.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const DIR = opt('dir', null);
const ASK = opt('ask', null);
const OUT = opt('out-name', 'baseline-as-delivered.html');
const SEAM = opt('seam', 'plain');
const SEED = parseInt(opt('seed', '7'), 10);
const MODEL = opt('model', 'qwen2.5-coder:1.5b');
if (!DIR || !ASK) { console.error('usage: node server/makePage.mjs --dir <dir> --ask "<one line>" [--seam plain|firm] [--out-name f.html]'); process.exit(2); }

const SEAMS = {
  plain: 'Expose the state for testing as window.app = { state: () => <a plain JSON-safe copy of the state> };',
  // The plain wording was ignored: the delivered page had no window.app at all, so its state could not
  // be read and it failed the baseline requirement before any attempt. This states it as a hard
  // requirement and shows the shape, which is plumbing every page needs regardless of its addition.
  firm: 'REQUIRED, the page will be rejected without it: the last line of the script must be exactly '
      + 'window.app = { state: () => ({ ...<every piece of state the page keeps> }) }; so that automated '
      + 'tests can read the state. Do not omit this line.',
};
const seamText = SEAMS[SEAM] || SEAMS.plain;

const prompt = `Write one complete HTML file, nothing else, no explanation, no markdown fence.
${ASK}
${seamText}
Use a single <canvas> and one inline <script>. Plain JavaScript, no libraries.`;

const t0 = Date.now();
const res = await fetch('http://127.0.0.1:11434/api/generate', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: 0.3, num_predict: 2600, seed: SEED } }),
});
const j = await res.json();
let text = String(j.response || '');
const fence = /```(?:html)?\s*([\s\S]*?)```/.exec(text);
if (fence) text = fence[1];
text = text.trim() + '\n';

if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
const path = `${DIR}/${OUT}`;
writeFileSync(path, text, 'utf8');
const sha = createHash('sha256').update(text).digest('hex');

// An append-only log, so a page cannot be silently regenerated out from under its own record.
appendFileSync(`${DIR}/GENERATION-LOG.txt`, [
  `at            ${new Date().toISOString()}`,
  `out           ${OUT}`,
  `sha256        ${sha}`,
  `chars         ${text.length}`,
  `model         ${MODEL}  seed ${SEED}  num_predict 2600  temperature 0.3`,
  `outputTokens  ${j.eval_count}   doneReason ${j.done_reason}   ms ${Date.now() - t0}`,
  `seamWording   ${SEAM}`,
  `ask           ${ASK}`,
  `fullPrompt    ${JSON.stringify(prompt)}`,
  '',
].join('\n'), 'utf8');

console.log(`${path}\n  ${text.length} chars, sha256 ${sha.slice(0, 16)}, ${j.eval_count} tokens, done=${j.done_reason}, ${Date.now() - t0}ms`);
console.log(`  request and hash appended to ${DIR}/GENERATION-LOG.txt`);
