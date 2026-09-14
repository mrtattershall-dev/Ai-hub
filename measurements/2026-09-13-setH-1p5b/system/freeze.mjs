// REPRODUCIBILITY MANIFEST. Emitted BEFORE the held-out evaluation so the evaluated system is
// byte-identifiable afterwards. If any hash below differs at analysis time, the evaluation is void.
//
// The scientific purpose is narrow: a held-out result means nothing unless the system that produced
// it can be shown not to have changed while the result was being produced.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const HERE = 'C:/Users/tatte/AppData/Local/Temp/claude/C--Users-tatte-OneDrive-Documents-ai-native-engine/a8160f8c-9099-46b5-8e59-75485c848e44/scratchpad/gates';
const GOALS_PATH = 'C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json';
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const short = (h) => h.slice(0, 16);

const FILES = [
  ['contract.mjs', 'typed contract derivation + prompt/human renderings'],
  ['contractCheck.mjs', 'contract checker + execution isolation'],
  ['_htmlcheck.mjs', 'html structural check'],
  ['repairGates.mjs', 'failure classifier + deterministic transforms + FIM localization'],
  ['repairPipeline.mjs', 'repair routing, FIM call, typed retry, rollback'],
  ['baseline.mjs', 'paired baseline runner'],
  ['derive.mjs', 'lead-file / language / edit derivation (upstream of contract.mjs)'],
];

let ollamaVersion = 'unknown';
try { ollamaVersion = execSync('ollama --version', { encoding: 'utf8' }).trim(); } catch (e) { /* not fatal */ }

let modelInfo = {};
try {
  const r = execSync('curl -s http://127.0.0.1:11434/api/show -d "{\\"name\\":\\"qwen2.5-coder:1.5b\\"}"',
    { encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 });
  const j = JSON.parse(r);
  modelInfo = {
    digest: (j.details && j.details.parent_model) || undefined,
    family: j.details && j.details.family,
    parameter_size: j.details && j.details.parameter_size,
    quantization_level: j.details && j.details.quantization_level,
    context_length: j.model_info && j.model_info['qwen2.context_length'],
    block_count: j.model_info && j.model_info['qwen2.block_count'],
    embedding_length: j.model_info && j.model_info['qwen2.embedding_length'],
    feed_forward_length: j.model_info && j.model_info['qwen2.feed_forward_length'],
    head_count: j.model_info && j.model_info['qwen2.attention.head_count'],
    head_count_kv: j.model_info && j.model_info['qwen2.attention.head_count_kv'],
    rope_freq_base: j.model_info && j.model_info['qwen2.rope.freq_base'],
    capabilities: j.capabilities,
  };
} catch (e) { modelInfo = { error: String(e.message).slice(0, 120) }; }

const manifest = {
  frozen_at: new Date().toISOString(),
  purpose: 'pre-evaluation freeze; held-out set = setH goals 21-40, outputs not yet inspected',
  model: {
    tag: 'qwen2.5-coder:1.5b',
    runtime: 'ollama',
    ollama_version: ollamaVersion,
    ...modelInfo,
  },
  decoding: {
    temperature: 0.7, top_p: 0.8, top_k: 20, repeat_penalty: 1.1, repeat_last_n: 64,
    num_predict_generation: 2500, num_predict_repair: 600,
    note: 'pinned explicitly on every call; backend defaults are never relied on',
  },
  endpoints: {
    generation: '/api/chat',
    fim_repair: '/api/generate with prompt(prefix)+suffix  (native insert capability)',
  },
  goal_set: {
    path: GOALS_PATH,
    sha256: sha(GOALS_PATH),
    development: '1-20  (inspected; repair rules designed on these)',
    held_out: '21-40  (contracts audited and rendered; generated outputs NOT inspected)',
  },
  code: Object.fromEntries(FILES.map(([f, desc]) => [f, { sha256: sha(join(HERE, f)), purpose: desc }])),
  fixtures: {
    'contract.test.mjs': '24/24 - typed contract, both witnesses on every branch',
    'isolation.test.mjs': '10/10 - execution isolation, adversarial specimen is goal 20 real bytes',
    'repairGates.test.mjs': '29/29 - transforms AND refusals',
    'spec2check.test.mjs': '7/7 - html check, includes the positive control that caught over-strictness',
    total: '70/70',
  },
  success_criterion: 'Typed repair succeeds if it recovers failures WITHOUT decreasing already-correct '
    + 'artifacts, through externally verified transformations rather than evaluator accommodation. '
    + 'A pass is terminal: passing specimens are never touched.',
  development_check: {
    note: 'NOT an evaluation - the rules were designed on these six failures',
    first_turn: '14/20', after_repair: '17/20', repairs_attempted: 6, repairs_succeeded: 3,
    model_calls: 1, regressions: 0,
    by_route: { deterministic: '2/2', generate_artifact: '1/1', localized_semantic: '0/2', quarantine: '0/1' },
  },
  holdout_rule: 'If an instrument defect is discovered on 21-40, fix it, INVALIDATE that evaluation, '
    + 'and run a fresh held-out set. Do not revise the system and keep counting 21-40 as holdout.',
};

const out = join(HERE, 'FREEZE.json');
writeFileSync(out, JSON.stringify(manifest, null, 2), 'utf8');

console.log('  FROZEN ' + manifest.frozen_at);
console.log('  model   ' + manifest.model.tag + '  ' + (manifest.model.parameter_size || '?')
  + '  ' + (manifest.model.quantization_level || '?') + '  ctx ' + (manifest.model.context_length || '?'));
console.log('  ollama  ' + ollamaVersion);
console.log('  caps    ' + JSON.stringify(manifest.model.capabilities));
console.log('  goals   sha ' + short(manifest.goal_set.sha256));
console.log('  code:');
for (const [f, v] of Object.entries(manifest.code)) console.log('    ' + f.padEnd(22) + short(v.sha256));
console.log('  fixtures ' + manifest.fixtures.total);
console.log('\n  manifest written to ' + out);
