#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// tokenBudget.mjs — match two prompts by TOKENS, measured by the model that will read them.
//
// Character counts were the wrong instrument. A block of `// FACT line 14: ...` and a block of
// indented JavaScript do not tokenise at the same rate, so equal character counts hand one arm more
// of the model's actual context than the other. The budget that matters is the one the model spends.
//
// The oracle is the server itself: a generate call returns `prompt_eval_count` for the prompt it was
// given. That is the tokeniser the run will actually use, not an approximation of it, and it costs
// nothing locally.
//
// It asks for ONE token, not zero. `num_predict: 0` looked like the obvious choice and took 40.7
// seconds on a 509-token prompt; `num_predict: 1` returned the IDENTICAL count in 0.4 seconds. A
// hundredfold difference for the same number, and the sizing search makes many of these calls, so the
// obvious choice would have made the instrument unusable and looked like a hang.
//
// THE CACHE HAZARD, and what is done about it. A repeated prefix can be served from cache, and a
// cached prompt can report FEWER evaluated tokens than it contains - which would silently corrupt
// every match. So each measurement is taken twice with the pair interleaved, and any prompt whose two
// readings disagree is reported as UNSTABLE rather than used. A number that cannot be reproduced is
// not a measurement.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { pathToFileURL } from 'node:url';

/** One measurement: how many tokens does this server make of this prompt? */
export async function countTokens(text, { modelUrl = 'http://127.0.0.1:11434', model = 'qwen2.5-coder:1.5b', timeoutMs = 120_000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${modelUrl.replace(/\/$/, '')}/api/generate`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ model, prompt: text, stream: false, options: { num_predict: 1, temperature: 0 } }),
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const j = await res.json();
    if (j.prompt_eval_count === undefined || j.prompt_eval_count === null) return { ok: false, reason: 'THE_SERVER_REPORTED_NO_PROMPT_TOKEN_COUNT' };
    return { ok: true, tokens: j.prompt_eval_count, raw: { done_reason: j.done_reason } };
  } catch (e) {
    return { ok: false, reason: ctrl.signal.aborted ? `TIMED_OUT_AFTER_${timeoutMs}MS` : String(e.message || e) };
  } finally { clearTimeout(timer); }
}

/**
 * Two readings, taken with the candidates interleaved so a cache that serves the second reading
 * cannot make a prompt look shorter without the disagreement showing up.
 */
export async function countTokensStable(texts, opts = {}) {
  const first = [], second = [];
  for (const t of texts) first.push(await countTokens(t, opts));
  for (const t of texts) second.push(await countTokens(t, opts));
  return texts.map((t, i) => ({
    tokens: first[i].tokens,
    stable: first[i].ok && second[i].ok && first[i].tokens === second[i].tokens,
    readings: [first[i].tokens, second[i].tokens],
  }));
}

/**
 * Grow a block with `make(size)` until its token count is as close as possible to `targetTokens`
 * without exceeding it. Returns the chosen block, its measured tokens, and every size tried - so the
 * record shows the search rather than only its answer.
 */
export async function growToTokens(make, targetTokens, { from = 40, to = 3000, step = 20, ...opts } = {}) {
  const tried = [];
  let best = null;
  for (let size = from; size <= to; size += step) {
    const text = make(size);
    if (tried.length && tried[tried.length - 1].chars === text.length) continue;   // no new content
    const m = await countTokens(text, opts);
    if (!m.ok) return { ok: false, reason: m.reason, tried };
    tried.push({ size, chars: text.length, tokens: m.tokens });
    if (m.tokens > targetTokens) break;
    best = { text, size, chars: text.length, tokens: m.tokens };
  }
  if (!best) return { ok: false, reason: 'NOTHING_FITS_THE_TOKEN_TARGET', tried };
  return { ok: true, ...best, tried };
}

const DIRECT = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (DIRECT) {
  const argv = process.argv.slice(2);
  const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
  const probes = ['a', 'const a = 1;', '// FACT line 14: LAMPS is declared `const` and holds a container.',
    '            if (e.key === \'1\') toggleLamp(0);\n            if (e.key === \'2\') toggleLamp(1);'];
  const r = await countTokensStable(probes, { model: opt('model', 'qwen2.5-coder:1.5b'), modelUrl: opt('model-url', 'http://127.0.0.1:11434') });
  probes.forEach((t, i) => console.log(`${String(r[i].tokens).padStart(5)} tokens  ${r[i].stable ? 'stable  ' : 'UNSTABLE'}  ${JSON.stringify(t.slice(0, 60))}`));
}
