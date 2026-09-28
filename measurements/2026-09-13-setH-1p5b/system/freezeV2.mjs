// V2 REPRODUCIBILITY MANIFEST. Emitted before either arm generates a single byte for goals 41-60.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const GOALS_PATH = 'C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json';
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const short = (h) => h.slice(0, 16);

const MODULES = [
  ['contract.mjs', 'typed contract derivation + human/prompt renderings'],
  ['contractCheck.mjs', 'typed obligations, source-binding exports, referenced-JS DOM classes, execution isolation'],
  ['_htmlcheck.mjs', 'html structural check'],
  ['derive.mjs', 'lead file / language / edit detection'],
  ['operation.mjs', 'operation planner + editSurface; comments and strings stripped before analysis'],
  ['fimspan.mjs', 'add_method / add_function / replace_method spans with origPrefix/origSuffix'],
  ['spanSafety.mjs', 'span validity -> preservation -> structural safety'],
  ['deps.mjs', 'dependency firewall + load-side-effect classification'],
  ['repairGates.mjs', 'failure classifier, deterministic transforms, explicit refusals'],
  ['repairPipeline.mjs', 'repair routing, FIM repair, typed retry, rollback'],
  ['probes.mjs', 'six behavioural oracles'],
  ['probeBrowser.mjs', 'isolated-storage puppeteer harness for the DOM oracles'],
  ['arm.mjs', 'the two arms; ONE shared evaluator'],
];

let ollamaVersion = 'unknown';
try { ollamaVersion = execSync('ollama --version', { encoding: 'utf8' }).trim(); } catch (e) { /* fine */ }
let modelInfo = {};
try {
  const r = execSync('curl -s http://127.0.0.1:11434/api/show -d "{\\"name\\":\\"qwen2.5-coder:1.5b\\"}"',
    { encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 });
  const j = JSON.parse(r);
  modelInfo = {
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
} catch (e) { modelInfo = { error: String(e.message).slice(0, 100) }; }

const seedFiles = readdirSync(join(HERE, 'seed')).filter((f) => statSync(join(HERE, 'seed', f)).isFile()).sort();
const bundle = createHash('sha256');
for (const f of seedFiles) bundle.update(f).update('\0').update(readFileSync(join(HERE, 'seed', f)));

const strata = JSON.parse(readFileSync(join(HERE, 'goal-strata-41-60.json'), 'utf8'));

const manifest = {
  kind: 'v2_architecture_freeze',
  frozen_at: new Date().toISOString(),
  provenance: {
    v1_commit: 'a09e649',
    seed_commit: '77eed90',
    seed_bundle_sha: bundle.digest('hex'),
    goal_set_sha: sha(GOALS_PATH),
    strata_sha: createHash('sha256').update(readFileSync(join(HERE, 'goal-strata-41-60.json'))).digest('hex'),
  },
  model: {
    tag: 'qwen2.5-coder:1.5b', runtime: 'ollama', ollama_version: ollamaVersion, ...modelInfo,
  },
  decoding: {
    temperature: 0.7, top_p: 0.8, top_k: 20, repeat_penalty: 1.1, repeat_last_n: 64,
    num_predict_whole_file: 2500, num_predict_fim: 600,
    note: 'pinned explicitly on every call; backend defaults never relied on',
  },
  endpoints: { whole_file: '/api/chat', fim: '/api/generate with prompt(prefix)+suffix' },
  arms: {
    v1: 'whole-file generation + v1-style deterministic repair',
    v2: 'operation-specific FIM-first generation where localization is PROVEN safe, + dependency '
      + 'firewall + typed repair',
    shared_evaluator: 'Both arms are scored by the SAME contract checker, execution isolation and '
      + 'behavioural oracles. The evaluator is not part of the intervention.',
    same_start_state: 'Both arms begin from the identical canonical post-goal-40 seed (77eed90).',
  },
  definitions: {
    VERIFIED_GOAL_PASS: 'all applicable structural obligations pass AND the behavioural oracle '
      + 'passes when that goal has one. A behavioural-only goal never passes on loadability.',
    localization_policy: 'FIM utilisation is NOT maximised. A false-negative localization costs a '
      + 'fallback; a false-positive can surgically corrupt the wrong code while looking clean. '
      + 'When uncertain, fall back.',
    dependency_policy: 'A newly invented unresolved import does NOT justify generating that '
      + 'dependency. A missing artifact is generated only when the typed contract independently '
      + 'establishes it should exist.',
  },
  code: Object.fromEntries(MODULES.filter(([f]) => existsSync(join(HERE, f)))
    .map(([f, purpose]) => [f, { sha256: sha(join(HERE, f)), purpose }])),
  references: Object.fromEntries(readdirSync(join(HERE, 'ref')).flatMap((d) => readdirSync(join(HERE, 'ref', d))
    .map((f) => ['ref/' + d + '/' + f, sha(join(HERE, 'ref', d, f))]))),
  fixtures: {
    'contract.test.mjs': 24, 'isolation.test.mjs': 10, 'repairGates.test.mjs': 29,
    'spec2check.test.mjs': 7, 'fimspan.test.mjs': 25, 'spanSafety.test.mjs': 15,
    'operation.test.mjs': 14, 'seedProof.test.mjs': 64, 'probes.test.mjs': 18,
    'boardProof.test.mjs': 20,
    total: 226,
  },
  strata_counts: strata.counts,
  known_limitations: [
    'replace_method is implemented and fixture-tested but deliberately NOT wired into the v2 '
      + 'planner. Its default action is destructive rather than additive, and a behaviour-changing '
      + 'replacement needs regression proofs to distinguish "implemented the new feature" from '
      + '"implemented it by deleting yesterday\'s feature". Goals 44, 45, 54, 55 therefore fall back '
      + 'to whole-file generation in BOTH arms, diluting any v2 effect on 4 of 20 goals.',
    'Preservation checks cannot detect a DUPLICATED method: duplication is insertion-only and loses '
      + 'no symbols. Only the downstream contract/load check catches it. The preservation layer is '
      + 'not claimed to prove more than it does.',
    'Five goals carry oracle STRUCTURAL_WEAK_NO_OP_PASSES or weaker on the structural side; six of '
      + 'twenty have behavioural probes. The remaining structural-only goals could in principle be '
      + 'satisfied by code that is structurally right and behaviourally wrong.',
    'The python seed modules are STRUCTURAL_VERIFIED_PLUS_SELF_ASSERTIONS, not BEHAVIORALLY_VERIFIED '
      + '- they carry goal-derived assertions but no independent external suite like the JS half.',
    'n=20 goals. This run can show mechanism; it cannot settle effect size.',
    'Architecture efficacy only. Both arms start from a known-good predecessor, so this measures the '
      + 'edit itself, NOT sequential survival under accumulated self-inflicted damage.',
  ],
  holdout_rule: 'No model output for goals 41-60 has been generated or inspected. If an instrument '
    + 'defect is found once the arms run, fix it, INVALIDATE that evaluation, and use a fresh '
    + 'held-out set rather than revising the system and continuing to count 41-60.',
};

const out = join(HERE, 'FREEZE_V2.json');
writeFileSync(out, JSON.stringify(manifest, null, 2), 'utf8');

console.log('  V2 FROZEN ' + manifest.frozen_at);
console.log('  model    ' + manifest.model.tag + '  ' + manifest.model.parameter_size + '  '
  + manifest.model.quantization_level + '  ctx ' + manifest.model.context_length
  + '  caps ' + JSON.stringify(manifest.model.capabilities));
console.log('  ollama   ' + ollamaVersion);
console.log('  seed     ' + short(manifest.provenance.seed_bundle_sha) + '  (commit ' + manifest.provenance.seed_commit + ')');
console.log('  goals    ' + short(manifest.provenance.goal_set_sha));
console.log('  strata   ' + short(manifest.provenance.strata_sha));
console.log('  modules:');
for (const [f, v] of Object.entries(manifest.code)) console.log('    ' + f.padEnd(22) + short(v.sha256));
console.log('  fixtures ' + manifest.fixtures.total);
console.log('  -> ' + out);
