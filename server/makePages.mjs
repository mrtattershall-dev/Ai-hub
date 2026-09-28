#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// makePages.mjs — ASSISTED-1's two pages, written by the local 1.5B from one-line requests.
//
// Both are generated in ONE batch, before either is read. Page A is printed, because it is the
// development case and I have to inspect it. Page B is written to disk and only its sha256 is printed:
// it is sealed for a future transfer test, and reading it now would destroy the only property that
// makes it useful.
//
// The state seam is part of the request, identically for both pages, because the check harness needs
// somewhere to read state from. It is declared plumbing, not assistance about the addition - the
// addition does not exist yet at generation time.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const sha = (t) => createHash('sha256').update(t).digest('hex');
const MODEL = 'qwen2.5-coder:1.5b';
const URL = 'http://127.0.0.1:11434/api/generate';

const SEAM = "Expose the state for testing as window.app = { state: () => <a plain JSON-safe copy of the state> };";

const REQUESTS = [
  { id: 'A', dir: 'legasus/bench/traffic', ask: 'A traffic light drawn on a canvas. Keys 1, 2 and 3 switch it to red, amber and green.' },
  { id: 'B', dir: 'legasus/bench/dice', ask: 'A dice face drawn on a canvas. Key r rolls a six-sided die and draws the new number.' },
  // B hit the 1400-token cap on its first generation (done=length), so it may be truncated and
  // unusable as a baseline - and I cannot check that without reading it, which would unseal it. Two
  // spares are therefore generated NOW, with more room, so that a future transfer test has a choice of
  // pages ALL of which predate this experiment's assistance. Generating a replacement later would
  // forfeit exactly the property the seal exists to protect.
  { id: 'B2', dir: 'legasus/bench/counter', ask: 'A number shown on a canvas, starting at zero. Key ArrowUp adds one and ArrowDown subtracts one.' },
  { id: 'B3', dir: 'legasus/bench/bars', ask: 'Three vertical bars drawn on a canvas, all at height one. Keys a, b and c each make their own bar one taller.' },
];

let calls = 0;
const out = [];
for (const r of REQUESTS) {
  if (r.id === 'A' || r.id === 'B') { console.log(`PAGE ${r.id}: already generated, left untouched`); continue; }
  const prompt = `Write one complete HTML file, nothing else, no explanation, no markdown fence.
${r.ask}
${SEAM}
Use a single <canvas> and one inline <script>. Plain JavaScript, no libraries.`;
  const t0 = Date.now();
  const res = await fetch(URL, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: 0.3, num_predict: 2600, seed: 7 } }),
  });
  calls++;
  const j = await res.json();
  let text = String(j.response || '');
  // A fence is the model's packaging, not its program. Unwrapping it is not assistance about the task.
  const fence = /```(?:html)?\s*([\s\S]*?)```/.exec(text);
  if (fence) text = fence[1];
  text = text.trim() + '\n';
  if (!existsSync(r.dir)) mkdirSync(r.dir, { recursive: true });
  const path = `${r.dir}/baseline-as-delivered.html`;
  writeFileSync(path, text, 'utf8');
  out.push({ id: r.id, path, chars: text.length, sha: sha(text), ms: Date.now() - t0, outTok: j.eval_count, doneReason: j.done_reason, ask: r.ask });
}

console.log(`pageGenerationCalls: ${calls}`);
for (const o of out) {
  console.log(`\nPAGE ${o.id}  ${o.path}\n  ${o.chars} chars, sha256 ${o.sha.slice(0, 16)}, ${o.outTok} output tokens in ${o.ms}ms, done=${o.doneReason}\n  request: ${o.ask}`);
}
console.log('\nPage B is sealed: written to disk, hashed above, and deliberately not printed.');
