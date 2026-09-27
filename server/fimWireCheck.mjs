/**
 * fimWireCheck.mjs - did the SUFFIX actually reach the model in this run's configuration?
 *
 *   node server/fimWireCheck.mjs [--model qwen2.5-coder:1.5b] [--url http://127.0.0.1:11434]
 *
 * WHY. INC4-1 argued that the suffix reached the model because the model's template renders
 * `{{ if .Suffix }}<|fim_prefix|>{{ .Prompt }}<|fim_suffix|>{{ .Suffix }}<|fim_middle|>`. That was
 * too strong: a template's SUPPORT for infilling establishes what the interface can do, not that
 * this run used it correctly. The claim needs the rendered request or the token sequence.
 *
 * ollama does not echo the rendered prompt, so this checks it by TOKEN ACCOUNTING, which is the
 * strongest evidence available without patching the server:
 *
 *   B  prompt + suffix - exactly what the harness sends
 *   C  raw:true, the FIM tokens written by hand: <|fim_prefix|>P<|fim_suffix|>S<|fim_middle|>
 *   D  raw:true, the same but with an EMPTY suffix: <|fim_prefix|>P<|fim_suffix|><|fim_middle|>
 *
 * B == C says the harness's request renders into the same token sequence as a hand-built infilling
 * request. B > D by about the suffix's own token count says those tokens are actually the suffix.
 * Together they establish that the suffix reached the model.
 *
 * A FOURTH measurement is NOT comparable and was my first mistake here: a request with no `suffix`
 * field at all goes down the CHAT template branch instead, which adds its own scaffolding, so its
 * prompt_eval_count is larger for reasons that have nothing to do with the suffix. Comparing
 * against it looked like evidence the suffix had been dropped. Like must be compared with like.
 *
 * THE LIMIT OF THIS CHECK, stated because the last claim overreached: it compares token COUNTS and
 * one generated token, not the literal byte sequence the server built. Counts matching is strong
 * evidence of the same rendering; it is not a dump of the request.
 */
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const URL_BASE = opt('url', 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = opt('model', 'qwen2.5-coder:1.5b');

const PREFIX = ['const a = 1;', 'function half(n) {'].join('\n');
const SUFFIX = ['}', '', 'console.log(half(8));', 'console.log(a);'].join('\n');

async function gen(body, label) {
  const res = await fetch(`${URL_BASE}/api/generate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, stream: false, options: { temperature: 0, num_predict: 1 }, ...body }),
  });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  const j = await res.json();
  return { label, promptTok: j.prompt_eval_count ?? null, first: JSON.stringify(j.response ?? '').slice(0, 40) };
}

async function tokenCount(text) {
  // ollama has no tokenize endpoint on every build; count via a 1-token generation instead.
  const r = await gen({ prompt: text, raw: true }, 'count');
  return r.promptTok;
}

const B = await gen({ prompt: PREFIX, suffix: SUFFIX }, 'B prompt + suffix (the harness)');
const C = await gen({ prompt: `<|fim_prefix|>${PREFIX}<|fim_suffix|>${SUFFIX}<|fim_middle|>`, raw: true }, 'C raw FIM, by hand');
const D = await gen({ prompt: `<|fim_prefix|>${PREFIX}<|fim_suffix|><|fim_middle|>`, raw: true }, 'D raw FIM, EMPTY suffix');
const chat = await gen({ prompt: PREFIX }, '(not comparable) no suffix');
const suffixTokens = await tokenCount(SUFFIX);

for (const r of [B, C, D, chat]) console.log(`  ${r.label.padEnd(30)} prompt_eval_count = ${String(r.promptTok).padStart(4)}   first token ${r.first}`);
console.log(`  tokens in the suffix alone     ${String(suffixTokens).padStart(4)}`);

const bEqualsC = B.promptTok === C.promptTok;
const gap = B.promptTok - D.promptTok;
const gapMatches = Math.abs(gap - suffixTokens) <= 2;
const sameFirstToken = B.first === C.first;
console.log('');
console.log(`  B == C  (renders like a hand-built infilling request):        ${bEqualsC ? 'YES' : 'NO'}`);
console.log(`  B  > D  by the suffix's own length (${gap} vs ${suffixTokens} tokens):${' '.repeat(Math.max(1, 12 - String(gap).length))}${gapMatches ? 'YES' : 'NO'}`);
console.log(`  same first token at temperature 0 (same conditioning):        ${sameFirstToken ? 'YES' : 'NO'}`);
console.log('');
const ok = bEqualsC && gapMatches;
if (ok) {
  console.log('  => the suffix DID reach the model in this configuration.');
  console.log('     Evidence is token accounting plus an identical greedy first token, NOT a dump of');
  console.log('     the rendered request. It shows the same rendering, not the literal bytes.');
} else {
  console.log('  => NOT established that the suffix reached the model. Treat every fim cell as a plain');
  console.log('     continuation from a prefix until this passes.');
}
process.exit(ok ? 0 : 1);
