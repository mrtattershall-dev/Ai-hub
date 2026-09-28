#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// makeSet3.mjs — TRANSFER-3's eight pages, from the prompt frozen in TRANSFER-3_DEFINITION.md.
//
// The prompt template and the eight asks are copied from the frozen definition and must not differ from
// it. The cap is eight: no ninth page, whatever the eligibility rate turns out to be.
//
// EVERY page is written to disk and kept, including ones that will turn out ineligible, because the
// eligibility rate is part of the result and a discarded page cannot be counted.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const sha = (t) => createHash('sha256').update(t).digest('hex');
const NL = String.fromCharCode(10);
const MODEL = 'qwen2.5-coder:1.5b';

const TEMPLATE = (ask) => `Write one complete HTML file, nothing else, no explanation, no markdown fence.
${ask}
REQUIRED, the page will be rejected without it: attach key handling with
document.addEventListener('keydown', ...) and NOT to the canvas element.
REQUIRED, the page will be rejected without it: the last line of the script must be exactly
window.app = { state: () => ({ ...<every piece of state the page keeps> }) }; so that automated
tests can read the state.
Use a single <canvas> and one inline <script>. Plain JavaScript, no libraries.`;

const ASKS = [
  ['s3-01-square', 'A single square on a canvas that moves one cell left or right when ArrowLeft or ArrowRight is pressed.'],
  ['s3-02-votes', 'A tally of votes for two options drawn on a canvas. Key 1 adds a vote to the first, key 2 to the second.'],
  ['s3-03-bright', 'A brightness level from 0 to 5 drawn as a bar on a canvas. ArrowUp raises it and ArrowDown lowers it, staying in range.'],
  ['s3-04-colour', 'A colour name shown on a canvas. Key c cycles through red, green and blue.'],
  ['s3-05-stack', 'A stack of up to five blocks drawn on a canvas. Key a pushes a block and key b pops one.'],
  ['s3-06-scores', "Two players' scores drawn on a canvas. Key a scores a point for the first player and key b for the second."],
  ['s3-07-grid', 'A 3x3 grid of cells on a canvas, all empty. Keys 1, 2 and 3 fill the first, second and third cell of the top row.'],
  ['s3-08-bars', 'Three vertical bars on a canvas, all at height one. Keys a, b and c each make their own bar one taller.'],
];

let calls = 0;
console.log(`generating ${ASKS.length} pages, cap ${ASKS.length}, model ${MODEL}`);
for (const [name, ask] of ASKS) {
  const dir = `legasus/bench/set3/${name}`;
  const prompt = TEMPLATE(ask);
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
    `out           baseline-as-delivered.html`,
    `sha256        ${sha(text)}`,
    `chars         ${text.length}`,
    `model         ${MODEL}  seed 7  num_predict 2600  temperature 0.3`,
    `outputTokens  ${j.eval_count}   doneReason ${j.done_reason}   ms ${Date.now() - t0}`,
    `seamWording   firm + document-listener (TRANSFER-3 frozen template)`,
    `ask           ${ask}`,
    `fullPrompt    ${JSON.stringify(prompt)}`,
    '',
  ].join(NL), 'utf8');
  console.log(`  ${name.padEnd(16)} ${String(text.length).padStart(5)} chars  ${String(j.eval_count).padStart(4)} tok  done=${String(j.done_reason).padEnd(6)} ${sha(text).slice(0, 12)}`);
}
console.log(`\npageGenerationCalls: ${calls}`);
