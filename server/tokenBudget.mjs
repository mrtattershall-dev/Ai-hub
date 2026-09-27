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
// IT MUST SEND THE SUFFIX. Generation sends `prompt` AND `suffix`, which selects the infill template;
// the first version of this file sent `prompt` alone. Measured on unique, never-seen prefixes, the two
// branches disagree by 21-24 tokens for identical content - so every match made by the prompt-only
// version was made on a template the run does not use. `countTokens` now takes the same prefix and
// suffix the generation call will take, and refuses to guess when the suffix is withheld.
//
// THE CACHE HAZARD, measured rather than assumed. Repeating an identical request does NOT move
// `prompt_eval_count` (60/60, 36/36, 37/37 on three unique prefixes), so the count is cache-safe. It
// moves the TIME by an order of magnitude - 2243ms cold, 191ms warm on the same request - so these
// calls warm the cache for whatever runs after them. Their time is therefore reported separately and
// never folded into generation timing. Readings are still taken twice and interleaved, because
// "stable" is the claim being checked, not one being assumed.
//
// STABLE IS NOT CORRECT. Agreement between two readings says the number reproduces; it says nothing
// about whether it is the number the run will spend. That is what sending the real suffix is for.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { pathToFileURL } from 'node:url';

/**
 * One measurement of the REQUEST THE RUN WILL MAKE: how many tokens does this server make of this
 * prefix and this suffix together? `suffix` is required unless `allowNoSuffix` is set, because
 * omitting it silently selects a different template.
 */
export async function countTokens(text, { modelUrl = 'http://127.0.0.1:11434', model = 'qwen2.5-coder:1.5b', timeoutMs = 120_000, suffix = null, allowNoSuffix = false } = {}) {
  if (suffix === null && !allowNoSuffix) {
    return { ok: false, reason: 'NO_SUFFIX_GIVEN: generation sends prompt AND suffix, and the two templates disagree by ~22 tokens; pass the suffix or set allowNoSuffix' };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const body = { model, prompt: text, stream: false, options: { num_predict: 1, temperature: 0 } };
    if (suffix !== null) body.suffix = suffix;
    const res = await fetch(`${modelUrl.replace(/\/$/, '')}/api/generate`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const j = await res.json();
    if (j.prompt_eval_count === undefined || j.prompt_eval_count === null) return { ok: false, reason: 'THE_SERVER_REPORTED_NO_PROMPT_TOKEN_COUNT' };
    // oracleMs is the COUNTING call's own cost, kept separate so it never lands in generation timing.
    return { ok: true, tokens: j.prompt_eval_count, oracleMs: Date.now() - t0, withSuffix: suffix !== null, raw: { done_reason: j.done_reason } };
  } catch (e) {
    return { ok: false, reason: ctrl.signal.aborted ? `TIMED_OUT_AFTER_${timeoutMs}MS` : String(e.message || e), oracleMs: Date.now() - t0 };
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
    withSuffix: first[i].withSuffix === true,
    oracleMs: (first[i].oracleMs || 0) + (second[i].oracleMs || 0),
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
  let oracleMs = 0, calls = 0;
  for (let size = from; size <= to; size += step) {
    const text = make(size);
    if (tried.length && tried[tried.length - 1].chars === text.length) continue;   // no new content
    const m = await countTokens(text, opts);
    oracleMs += m.oracleMs || 0; calls++;
    if (!m.ok) return { ok: false, reason: m.reason, tried, oracleMs, calls };
    tried.push({ size, chars: text.length, tokens: m.tokens });
    if (m.tokens > targetTokens) break;
    best = { text, size, chars: text.length, tokens: m.tokens };
  }
  if (!best) return { ok: false, reason: 'NOTHING_FITS_THE_TOKEN_TARGET', tried, oracleMs, calls };
  return { ok: true, ...best, tried, oracleMs, calls };
}

const DIRECT = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (DIRECT) {
  const argv = process.argv.slice(2);
  const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
  const probes = ['a', 'const a = 1;', '// FACT line 14: LAMPS is declared `const` and holds a container.',
    '            if (e.key === \'1\') toggleLamp(0);\n            if (e.key === \'2\') toggleLamp(1);'];
  const common = { model: opt('model', 'qwen2.5-coder:1.5b'), modelUrl: opt('model-url', 'http://127.0.0.1:11434') };
  const withS = await countTokensStable(probes, { ...common, suffix: '\n}\n' });
  const without = await countTokensStable(probes, { ...common, allowNoSuffix: true });
  console.log('infill  prompt-only  diff  stable    text');
  probes.forEach((t, i) => console.log(
    `${String(withS[i].tokens).padStart(6)}  ${String(without[i].tokens).padStart(11)}  ${String(without[i].tokens - withS[i].tokens).padStart(4)}  ${withS[i].stable ? 'stable' : 'UNSTABLE'}    ${JSON.stringify(t.slice(0, 50))}`));
  console.log(`\nthe two templates differ, which is why the suffix is mandatory. oracle time: ${withS.reduce((n, x) => n + x.oracleMs, 0)}ms for ${withS.length * 2} calls`);
  const refused = await countTokens('x');
  console.log(`withholding the suffix is refused: ${refused.reason.slice(0, 60)}`);
}
