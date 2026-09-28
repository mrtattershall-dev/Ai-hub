#!/usr/bin/env node
// OBSEVAL-1's eight pages, from the prompts frozen in OBSEVAL-1_DEFINITION.md. Four input-driven, four
// click-driven, so the evaluation is not all one modality. No state-seam clause: a page with no accessor
// must be observable through the DOM, and requiring one would hide whether that works.
import { writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const sha = (t) => createHash('sha256').update(t).digest('hex');
const NL = String.fromCharCode(10);
const MODEL = 'qwen2.5-coder:1.5b';

const TAIL = `REQUIRED, the page will be rejected without it: attach handling with
document.addEventListener(...) on the document, not inline onclick attributes.
Use plain HTML and one inline <script>. No canvas. Plain JavaScript, no libraries.`;

const P = (ask) => `Write one complete HTML file, nothing else, no explanation, no markdown fence.
${ask}
${TAIL}`;

const INPUT = (thing) => P(`A page listing five ${thing}, each with a name. A text input with id 'filter' shows only the items whose name contains the typed text.`);
const CLICK = (thing) => P(`A page listing five ${thing}, each with a name. A button with id 'toggle' hides the list, and clicking it again shows the list.`);

const PAGES = [
  ['e1-books', 'INPUT', INPUT('books')],
  ['e2-cities', 'INPUT', INPUT('cities')],
  ['e3-tools', 'INPUT', INPUT('tools')],
  ['e4-fruits', 'INPUT', INPUT('fruits')],
  ['e5-notes', 'CLICK', CLICK('notes')],
  ['e6-files', 'CLICK', CLICK('files')],
  ['e7-orders', 'CLICK', CLICK('orders')],
  ['e8-users', 'CLICK', CLICK('users')],
];

let calls = 0;
console.log(`generating ${PAGES.length} pages (4 input, 4 click), model ${MODEL}`);
for (const [name, shape, prompt] of PAGES) {
  const dir = `legasus/bench/obseval/${name}`;
  const t0 = Date.now();
  const res = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: 0.3, num_predict: 2600, seed: 7 } }),
  });
  calls++;
  const j = await res.json();
  let text = String(j.response || '');
  const fence = /```(?:html)?\s*([\s\S]*?)```/.exec(text);
  if (fence) text = fence[1];
  text = text.trim() + NL;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/baseline-as-delivered.html`, text, 'utf8');
  appendFileSync(`${dir}/GENERATION-LOG.txt`, [
    `at            ${new Date().toISOString()}`,
    `shape         ${shape}`,
    `out           baseline-as-delivered.html`,
    `sha256        ${sha(text)}`,
    `chars         ${text.length}`,
    `model         ${MODEL}  seed 7  num_predict 2600  temperature 0.3`,
    `outputTokens  ${j.eval_count}   doneReason ${j.done_reason}   ms ${Date.now() - t0}`,
    `fullPrompt    ${JSON.stringify(prompt)}`,
    '',
  ].join(NL), 'utf8');
  console.log(`  ${shape.padEnd(5)} ${name.padEnd(11)} ${String(text.length).padStart(5)} chars  ${String(j.eval_count).padStart(4)} tok  done=${String(j.done_reason).padEnd(6)} ${sha(text).slice(0, 12)}`);
}
console.log(`\npageGenerationCalls: ${calls}`);
