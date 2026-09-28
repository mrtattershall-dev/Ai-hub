#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// makeBatch1.mjs — BATCH-1's two groups, from the prompts frozen in BATCH-1_DEFINITION.md.
//
//   GROUP A  scoreboard pages whose prompt states the contract layout verbatim. The visual gate is
//            BLOCKING for these, so non-conformance is a requirement failure.
//   GROUP B  a filterable product list. No canvas, no game. A new domain.
//
// Every page is kept with its GENERATION-LOG, eligible or not.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const sha = (t) => createHash('sha256').update(t).digest('hex');
const NL = String.fromCharCode(10);
const MODEL = 'qwen2.5-coder:1.5b';

const SEAM = `REQUIRED, the page will be rejected without it: the last line of the script must be exactly
window.app = { state: () => ({ ...<every piece of state the page keeps> }) }; so that automated
tests can read the state.`;
const LISTENER = `REQUIRED, the page will be rejected without it: attach key handling with
document.addEventListener('keydown', ...) and NOT to the canvas element.`;

const GROUP_A_LAYOUT = `The canvas must be exactly 400 wide and 100 high. Draw with font 20px Arial and
fillStyle #000000. Draw 'Player A: <score>' at x=10 y=20 and 'Player B: <score>' at x=290 y=20.`;

const A = (ask) => `Write one complete HTML file, nothing else, no explanation, no markdown fence.
${ask}
${GROUP_A_LAYOUT}
${LISTENER}
${SEAM}
Use a single <canvas> and one inline <script>. Plain JavaScript, no libraries.`;

const B = (ask) => `Write one complete HTML file, nothing else, no explanation, no markdown fence.
${ask}
REQUIRED, the page will be rejected without it: attach handling with
document.addEventListener(...) on the document, not inline onclick attributes.
${SEAM}
Use plain HTML and one inline <script>. No canvas. Plain JavaScript, no libraries.`;

const PAGES = [
  ['a1-scores', 'A', A("Two players' scores. Key a scores a point for the first player and key b for the second.")],
  ['a2-tally', 'A', A('A tally for two teams. Key a adds one to the first team and key b adds one to the second.')],
  ['a3-points', 'A', A('A points display for two competitors. Key a increases the first, key b increases the second.')],
  ['a4-counter', 'A', A('Two counters side by side. Key a increments the left counter and key b the right.')],
  ['b1-products', 'B', B("A page listing five products, each with a name and a category. A text input with id 'filter' narrows the visible list to items whose name contains the typed text.")],
  ['b2-inventory', 'B', B("A page showing five inventory items with a name and a quantity. A text input with id 'filter' shows only the items whose name contains the typed text.")],
  ['b3-contacts', 'B', B("A page listing five contacts with a name and a role. A text input with id 'filter' hides the contacts whose name does not contain the typed text.")],
  ['b4-tasks', 'B', B("A page listing five tasks with a title and a status. A text input with id 'filter' shows only the tasks whose title contains the typed text.")],
];

let calls = 0;
console.log(`generating ${PAGES.length} pages (4 group A, 4 group B), model ${MODEL}`);
for (const [name, group, prompt] of PAGES) {
  const dir = `legasus/bench/batch1/${name}`;
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
    `group         ${group}`,
    `out           baseline-as-delivered.html`,
    `sha256        ${sha(text)}`,
    `chars         ${text.length}`,
    `model         ${MODEL}  seed 7  num_predict 2600  temperature 0.3`,
    `outputTokens  ${j.eval_count}   doneReason ${j.done_reason}   ms ${Date.now() - t0}`,
    `seamWording   BATCH-1 frozen template, group ${group}`,
    `fullPrompt    ${JSON.stringify(prompt)}`,
    '',
  ].join(NL), 'utf8');
  console.log(`  ${group} ${name.padEnd(14)} ${String(text.length).padStart(5)} chars  ${String(j.eval_count).padStart(4)} tok  done=${String(j.done_reason).padEnd(6)} ${sha(text).slice(0, 12)}`);
}
console.log(`\npageGenerationCalls: ${calls}`);
