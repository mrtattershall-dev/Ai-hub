// WITNESSES for the substrate validator. Both directions, because a validator that rejects everything
// passes every known-bad suite - the failure mode this project has hit five times.
//
// The decisive witness is LEAKAGE: a task whose contract mentions an identifier the reference introduces
// must be REJECTED even though every schema key is legal. That is the contaminated-contract defect in
// miniature, and no key-list check would catch it.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateTask } from './validate-task.mjs';

const NL = String.fromCharCode(10);
const SRC = ['def to_html(text):', '    blocks = []', '    current = []', '    return blocks'].join(NL);
const PATCH = ['+    ol_items = []', '+    def flush_ol():', '+        blocks.append("<ol>")'].join(NL);

function build(over = {}) {
  const d = mkdtempSync(join(tmpdir(), 'subq-'));
  mkdirSync(join(d, 'source'));
  mkdirSync(join(d, 'evidence'));
  writeFileSync(join(d, 'source', 'm.py'), SRC, 'utf8');
  writeFileSync(join(d, 'evidence', 'reference.patch'), PATCH, 'utf8');
  const task = Object.assign({
    task_id: 't01', goal: 'Add ordered lists, written like the unordered lists.',
    lead: 'm.py', language: 'py', run_with: 'python',
  }, over.task || {});
  const oracle = Object.assign({
    task_id: 't01', analogy_class: 'analogy_specified',
    analogy_justification: 'the task names the unordered-list feature as the relation to parallel',
    transaction: { operation_count: 3, operations: [], dependency_edges: [['op1', 'op2']],
      permitted_orders: [['op1', 'op2', 'op3']], transaction_length: 3 },
    complexity: { structural_class: 'loop-feature', affected_region_lines: 12 },
    reference: { source_hash: 'x', reference_hash: 'y', changed_sites: [], implementation: 'reference.patch' },
    witnesses: { noop_fails_delta: true, each_operation_omitted_fails_delta: [true, true, true],
      reference_preserves_old_behavior: true, reference_passes_delta: true },
    sealing: { authored_commit: 'a', evidence_commit: 'b', pre_generation: true },
  }, over.oracle || {});
  writeFileSync(join(d, 'task.json'), JSON.stringify(task, null, 2), 'utf8');
  writeFileSync(join(d, 'evidence', 'oracle.json'), JSON.stringify(oracle, null, 2), 'utf8');
  return d;
}

const cases = [
  { name: 'KNOWN-GOOD  clean task, legal analogy, sealed evidence', over: {}, expect: true },
  { name: 'LEAKAGE     contract names ol_items, introduced by the reference',
    over: { task: { goal: 'Add ordered lists using an ol_items accumulator.' } }, expect: false },
  { name: 'FORBIDDEN   contract names an insertion point',
    over: { task: { goal: 'Add ordered lists at the insertion point after items.' } }, expect: false },
  { name: 'FORBIDDEN   contract carries an extra key',
    over: { task: { operation_count: 3 } }, expect: false },
  { name: 'RULE 5      a single-operation-omitted variant does not fail the delta',
    over: { oracle: { witnesses: { noop_fails_delta: true,
      each_operation_omitted_fails_delta: [true, false, true],
      reference_preserves_old_behavior: true, reference_passes_delta: true } } }, expect: false },
  { name: 'RULE 14     evidence not sealed before generation',
    over: { oracle: { sealing: { authored_commit: 'a', evidence_commit: 'b', pre_generation: false } } },
    expect: false },
  { name: 'ORACLE      classification without justification',
    over: { oracle: { analogy_justification: '' } }, expect: false },
  { name: 'KNOWN-GOOD  non-analogy task, also clean',
    over: { task: { goal: 'Add fenced code blocks between lines of three backticks.' },
      oracle: { analogy_class: 'no_supported_analogy',
        analogy_justification: 'no existing feature in the file is a stateful multi-line block' } },
    expect: true },
];

let fail = 0;
for (const c of cases) {
  const d = build(c.over);
  const r = validateTask(d);
  const pass = r.ok === c.expect;
  if (!pass) fail++;
  console.log('  ' + (pass ? 'ok  ' : 'FAIL') + '  ' + c.name);
  if (!pass || (!r.ok && c.expect === false)) {
    for (const p of (r.problems || []).slice(0, 2)) console.log('          ' + p.kind + ': ' + p.detail);
  }
  rmSync(d, { recursive: true, force: true });
}
const good = cases.filter((c) => c.expect).length;
console.log('\n  ' + (fail ? fail + ' WITNESS FAILURE(S)' : 'all ' + cases.length + ' witnesses pass'));
console.log('  Non-vacuity: ' + good + ' known-good cases must be ADMITTED, including one of each');
console.log('  analogy class. A validator that rejected everything would fail those and the suite.');
