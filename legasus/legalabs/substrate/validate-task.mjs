// SUBSTRATE TASK VALIDATOR — enforces the specification/evaluation boundary mechanically.
//
// LegaLabs doctrine: specification tells the system what must become true; evaluation knows how you
// established that it became true. These are not the same artifact. The contaminated-contract defect of
// 2026-09-13 happened because one artifact fed both the prompt and the checker, and its results were
// quarantined as VOID. A boundary recorded only in prose gets crossed by convenience, so it is a check.
//
// The decisive test is LEAKAGE: no distinctive token from the reference implementation may appear in the
// prompt-visible contract. That catches the failure this project actually suffered, which no schema
// key-list would have caught.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const ALLOWED_TASK_KEYS = new Set(['task_id', 'goal', 'lead', 'language', 'run_with', 'analogy', 'interface']);
const FORBIDDEN_IN_TASK = [
  [/\bsite(s)?\b/i, 'names sites'],
  [/\banchor(s)?\b/i, 'names anchors'],
  [/insertion point/i, 'names an insertion point'],
  [/\bop(eration)?_?(count|order)\b/i, 'names operation count or order'],
  [/dependency[_ ]edge/i, 'names dependency edges'],
  [/\bline \d+\b/i, 'names a line number'],
];

const STOP = new Set(['self', 'return', 'None', 'True', 'False', 'else', 'elif', 'def', 'for', 'while',
  'in', 'if', 'and', 'or', 'not', 'the', 'with', 'from', 'import', 'class', 'this', 'const', 'let', 'var',
  'function', 'new', 'null', 'true', 'false']);

// Distinctive tokens of an implementation: identifiers it introduces that a task specification would
// have no reason to contain verbatim.
function implementationTokens(patch) {
  const out = new Set();
  for (const m of patch.matchAll(/\b([A-Za-z_][A-Za-z0-9_]{3,})\b/g)) {
    const t = m[1];
    if (!STOP.has(t)) out.add(t);
  }
  return out;
}

export function validateTask(dir) {
  const problems = [];
  const note = (kind, detail) => problems.push({ kind, detail });

  // ---- structure
  for (const p of ['task.json', 'source', 'evidence', join('evidence', 'oracle.json')]) {
    if (!existsSync(join(dir, p))) note('missing', p);
  }
  if (problems.length) return { ok: false, problems };

  const task = JSON.parse(readFileSync(join(dir, 'task.json'), 'utf8'));
  const oracle = JSON.parse(readFileSync(join(dir, 'evidence', 'oracle.json'), 'utf8'));

  // ---- task.json may contain ONLY permitted keys
  for (const k of Object.keys(task)) {
    if (!ALLOWED_TASK_KEYS.has(k)) note('forbidden_key', 'task.json contains "' + k + '"');
  }
  const taskText = JSON.stringify(task);
  for (const [re, why] of FORBIDDEN_IN_TASK) {
    if (re.test(taskText)) note('forbidden_content', 'task.json ' + why);
  }

  // ---- LEAKAGE: no distinctive implementation token may appear in the contract
  const patchPath = join(dir, 'evidence', 'reference.patch');
  if (!existsSync(patchPath)) note('missing', 'evidence/reference.patch');
  else {
    const patch = readFileSync(patchPath, 'utf8');
    const src = readdirSync(join(dir, 'source'))
      .map((f) => readFileSync(join(dir, 'source', f), 'utf8')).join('\n');
    // REQUESTED API vs INVENTED INTERNAL DETAIL. The first version of this check flagged add_weighted,
    // snapshot and undo - the deliverables the task legitimately requests. A specification MUST be able
    // to name the API it asks for; what it must not name is an identifier the reference INVENTED that
    // the task never requested (_weights, _marks, ol_items).
    //
    // So the contract declares its requested interface, and leakage is measured against that. This is the
    // deliverable-versus-prerequisite distinction one level down, and it was caught by the checker firing
    // on legitimately authored tasks rather than by inspection.
    const declared = new Set(Array.isArray(task.interface) ? task.interface : []);
    for (const d of declared) {
      // An interface cannot be used as a laundering channel for private names.
      if (/^_/.test(d)) note('interface', '"' + d + '" is private and cannot be declared as interface');
      if (!new RegExp('\\b' + d.replace(/[^\w]/g, '') + '\\b').test(String(task.goal || ''))) {
        note('interface', '"' + d + '" is declared as interface but the goal never asks for it');
      }
    }
    const patchText = readFileSync(patchPath, 'utf8');
    const introduced = [...implementationTokens(patchText)].filter((t) => !new RegExp('\\b' + t + '\\b').test(src));
    const leaked = introduced.filter((t) => !declared.has(t) && new RegExp('\\b' + t + '\\b').test(taskText));
    for (const t of leaked) {
      note('leakage', '"' + t + '" is introduced by the reference, is not declared interface, and appears in task.json');
    }
  }

  // ---- oracle completeness
  if (!['analogy_specified', 'no_supported_analogy'].includes(oracle.analogy_class)) {
    note('oracle', 'analogy_class must be analogy_specified or no_supported_analogy');
  }
  if (!oracle.analogy_justification || String(oracle.analogy_justification).trim().length < 12) {
    note('oracle', 'analogy_justification missing - classification could be changed retroactively');
  }
  const t = oracle.transaction || {};
  if (!(t.operation_count >= 2 && t.operation_count <= 4)) note('rule1', 'operation_count must be 2-4');
  if (!Array.isArray(t.dependency_edges) || t.dependency_edges.length < 1) {
    note('rule2', 'at least one real dependency edge is required');
  }
  const w = oracle.witnesses || {};
  if (w.noop_fails_delta !== true) note('rule5', 'noop_fails_delta must be proven true');
  if (!Array.isArray(w.each_operation_omitted_fails_delta)
      || w.each_operation_omitted_fails_delta.length !== t.operation_count
      || !w.each_operation_omitted_fails_delta.every(Boolean)) {
    note('rule3/5', 'every single-operation-omitted variant must fail the delta probe '
      + '(this is the rule that would have caught the goal-64 dead site at authoring time)');
  }
  if (w.reference_preserves_old_behavior !== true) note('rule4', 'reference must preserve old behaviour');
  if (w.reference_passes_delta !== true) note('rule4', 'reference must pass the delta probe');
  if (!oracle.sealing || oracle.sealing.pre_generation !== true) {
    note('rule14', 'sealing.pre_generation must be true - evidence sealed before any generation');
  }

  return { ok: problems.length === 0, problems, task_id: task.task_id,
    analogy_class: oracle.analogy_class,
    transaction_length: t.transaction_length, operation_count: t.operation_count };
}

// ---- CLI: validate every task under a family directory, and check class/complexity matching (rule 13)
// CLI only when run directly. Executing at module scope meant importing this file ran its CLI - which
// swallowed author.mjs's output and would silently mislead any future importer.
const isMain = process.argv[1] ? import.meta.url.endsWith(basename(process.argv[1])) : false;
const dir = isMain ? process.argv[2] : null;
if (dir && existsSync(dir)) {
  const tasks = readdirSync(dir).filter((d) => existsSync(join(dir, d, 'task.json'))).sort();
  if (!tasks.length) { console.log('  no tasks authored yet under ' + dir); process.exit(0); }
  const rows = [];
  let bad = 0;
  for (const t of tasks) {
    const r = validateTask(join(dir, t));
    rows.push(r);
    if (!r.ok) { bad++; console.log('  ' + t + '  INVALID'); for (const p of r.problems) console.log('      ' + p.kind + ': ' + p.detail); }
    else console.log('  ' + t + '  ok   ' + r.analogy_class + '   ops=' + r.operation_count);
  }
  // RULE 13: applicability class must not be confounded with difficulty.
  const byClass = {};
  for (const r of rows.filter((x) => x.ok)) {
    (byClass[r.analogy_class] = byClass[r.analogy_class] || []).push(r.operation_count);
  }
  console.log('\n  rule 13 - class vs authored complexity:');
  for (const [k, v] of Object.entries(byClass)) {
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    console.log('    ' + k.padEnd(22) + 'n=' + v.length + '  operation_count mean ' + mean.toFixed(2)
      + '  range ' + Math.min(...v) + '-' + Math.max(...v));
  }
  const keys = Object.keys(byClass);
  if (keys.length === 2) {
    const m = keys.map((k) => byClass[k].reduce((a, b) => a + b, 0) / byClass[k].length);
    const gap = Math.abs(m[0] - m[1]);
    console.log('    mean operation_count gap between classes: ' + gap.toFixed(2)
      + (gap > 0.75 ? '   <-- CONFOUNDED: classes differ systematically in authored complexity'
        : '   (acceptable)'));
  } else if (keys.length === 1) {
    console.log('    <-- ONLY ONE CLASS PRESENT. Rule 13 requires both.');
  }
  console.log('\n  ' + (bad ? bad + ' invalid task(s)' : tasks.length + ' task(s) valid'));
}
