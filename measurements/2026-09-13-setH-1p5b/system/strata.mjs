// FROZEN STRATIFICATION FOR GOALS 41-60.
//
// Derived ONLY from: goal text, the frozen canonical seed (commit 77eed90), the planner, and the
// behavioural oracles. NO model output is consulted, and none exists for these goals.
//
// This is emitted as its own committed artifact so the mechanism analysis cannot be accused of
// post-hoc slicing: the FIM_ELIGIBLE labels provably existed before either arm produced a byte.
//
// The planner is STATE-DEPENDENT - add_method requires the owner to already exist - so each row
// records the exact predecessor source hash it was stratified against.
import { deriveContract } from './contract.mjs';
import { planOperation } from './operation.mjs';
import { probeFor } from './probes.mjs';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const SEED = join(HERE, 'seed');
const GOALS_PATH = 'C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json';
const GOALS = JSON.parse(readFileSync(GOALS_PATH, 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const shaFile = (p) => sha(readFileSync(p));

// Workspace = the frozen seed, exactly as both arms will start.
const ws = mkdtempSync(join(tmpdir(), 'strata-'));
writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
const seedFiles = readdirSync(SEED).filter((f) => statSync(join(SEED, f)).isFile()).sort();
for (const f of seedFiles) copyFileSync(join(SEED, f), join(ws, f));

const bundle = createHash('sha256');
for (const f of seedFiles) bundle.update(f).update('\0').update(readFileSync(join(SEED, f)));
const seedBundleSha = bundle.digest('hex');

const git = (cmd) => { try { return execSync(cmd, { cwd: 'C:/Users/tatte/Projects/ai-coding-hub-indent', encoding: 'utf8' }).trim(); } catch (e) { return 'unknown'; } };

const rows = [];
for (let g = 41; g <= 60; g++) {
  const goalText = GOALS[g - 1];
  const c = deriveContract(goalText);
  const plan = planOperation(c, ws, goalText);
  const probe = probeFor(g);
  const localizable = plan.op === 'add_method' || plan.op === 'add_function';
  const leadPath = join(ws, c.lead);
  const leadExists = existsSync(leadPath);
  const src = leadExists ? readFileSync(leadPath, 'utf8') : '';

  // Oracle strength. A goal with no structural obligation AND no probe would be a free pass, so it
  // is labelled explicitly rather than being allowed to enter a numerator on loadability.
  const hasStructural = c.moduleExports.length > 0 || c.members.length > 0
    || c.domIds.length > 0 || c.domClasses.length > 0;
  let oracle;
  if (probe && hasStructural) oracle = 'STRUCTURAL_PLUS_BEHAVIORAL';
  else if (probe) oracle = 'BEHAVIORAL_REQUIRED';
  else if (hasStructural && plan.fallbackReason === 'BEHAVIORAL_DELTA_UNPROVEN') oracle = 'STRUCTURAL_WEAK_NO_OP_PASSES';
  else if (hasStructural) oracle = 'STRUCTURAL';
  else oracle = 'UNSCORED_NO_ORACLE';

  const pre = {
    owner_exists: null, owner_unique: null, member_absent: null,
    lead_exists: leadExists,
    predecessor_source_sha256: leadExists ? shaFile(leadPath) : null,
  };
  if (plan.op === 'add_method') {
    const esc = plan.owner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = c.lang === 'py' ? new RegExp('^class\\s+' + esc + '\\b', 'gm')
      : new RegExp('^(?:class|const|let|var|function)\\s+' + esc + '\\b', 'gm');
    const n = (src.match(re) || []).length;
    pre.owner_exists = n > 0;
    pre.owner_unique = n === 1;
    pre.member_absent = true;   // planOperation only routes here for members it found absent
  } else if (plan.op === 'add_function') {
    pre.member_absent = true;
  }

  rows.push({
    goal: g,
    stratum: localizable ? 'FIM_ELIGIBLE' : 'WHOLE_FILE_FALLBACK',
    operation: plan.op,
    lead: c.lead,
    owner: plan.owner || null,
    members: plan.members ? plan.members.map((m) => m.name) : (plan.fn ? [plan.fn] : []),
    localization_reason: localizable ? plan.reason : null,
    fallback_reason_enum: localizable ? null : (plan.fallbackReason || 'LOCALIZATION_FAILED'),
    fallback_reason_text: localizable ? null : plan.reason,
    oracle,
    probe_id: probe ? probe.id : null,
    structural_contract: hasStructural
      ? { moduleExports: c.moduleExports, members: c.members, domIds: c.domIds, domClasses: c.domClasses }
      : null,
    localization_preconditions: pre,
    new_dependencies_authorized: false,
    new_artifacts_authorized: /\bs9_board\.js\b/.test(String(goalText)) && c.lang === 'web'
      ? ['s9_board.js'] : [],
  });
}

const probeHashes = {};
for (const f of ['probes.mjs', 'probeBrowser.mjs']) probeHashes[f] = shaFile(join(HERE, f));
for (const d of readdirSync(join(HERE, 'ref'))) {
  for (const f of readdirSync(join(HERE, 'ref', d))) probeHashes['ref/' + d + '/' + f] = shaFile(join(HERE, 'ref', d, f));
}

const doc = {
  provenance: {
    created_at: new Date().toISOString(),
    v1_commit: 'a09e649',
    seed_commit: '77eed90',
    seed_bundle_sha: seedBundleSha,
    goal_set_sha: shaFile(GOALS_PATH),
    planner_sha: shaFile(join(HERE, 'operation.mjs')),
    contract_sha: shaFile(join(HERE, 'contract.mjs')),
    contract_check_sha: shaFile(join(HERE, 'contractCheck.mjs')),
    fimspan_sha: shaFile(join(HERE, 'fimspan.mjs')),
    span_safety_sha: shaFile(join(HERE, 'spanSafety.mjs')),
    deps_sha: shaFile(join(HERE, 'deps.mjs')),
    arm_sha: shaFile(join(HERE, 'arm.mjs')),
    probe_hashes: probeHashes,
    git_head_at_emit: git('git rev-parse --short HEAD'),
  },
  rules: {
    derived_from: 'goal text + frozen canonical seed + planner + behavioural oracles ONLY',
    model_output_consulted: false,
    note: 'Labels are frozen BEFORE either arm generates. The planner is state-dependent, so each '
      + 'row records the predecessor source hash it was stratified against.',
  },
  counts: {
    total: rows.length,
    FIM_ELIGIBLE: rows.filter((r) => r.stratum === 'FIM_ELIGIBLE').length,
    WHOLE_FILE_FALLBACK: rows.filter((r) => r.stratum === 'WHOLE_FILE_FALLBACK').length,
    by_operation: rows.reduce((a, r) => { a[r.operation] = (a[r.operation] || 0) + 1; return a; }, {}),
    by_oracle: rows.reduce((a, r) => { a[r.oracle] = (a[r.oracle] || 0) + 1; return a; }, {}),
    by_fallback_reason: rows.filter((r) => r.fallback_reason_enum)
      .reduce((a, r) => { a[r.fallback_reason_enum] = (a[r.fallback_reason_enum] || 0) + 1; return a; }, {}),
    with_behavioural_probe: rows.filter((r) => r.probe_id).length,
  },
  goals: rows,
};

const body = JSON.stringify(doc, null, 2);
const out = join(HERE, 'goal-strata-41-60.json');
writeFileSync(out, body, 'utf8');
const strataSha = sha(body);
writeFileSync(join(HERE, 'goal-strata-41-60.sha256'), strataSha + '\n', 'utf8');

console.log('  FIM_ELIGIBLE          ' + doc.counts.FIM_ELIGIBLE + '/20');
console.log('  WHOLE_FILE_FALLBACK   ' + doc.counts.WHOLE_FILE_FALLBACK + '/20');
console.log('  by operation          ' + JSON.stringify(doc.counts.by_operation));
console.log('  by oracle             ' + JSON.stringify(doc.counts.by_oracle));
console.log('  by fallback reason    ' + JSON.stringify(doc.counts.by_fallback_reason));
console.log('  behavioural probes    ' + doc.counts.with_behavioural_probe + '/20');
console.log('  seed_bundle_sha       ' + seedBundleSha.slice(0, 24));
console.log('  strata_sha            ' + strataSha.slice(0, 24));
console.log('  -> ' + out);
