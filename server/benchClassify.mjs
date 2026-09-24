/**
 * benchClassify.mjs - classify BENCH-1's external failures by FIRST EVIDENCED OBSTACLE.
 *
 *   node server/benchClassify.mjs <bench1-root>
 *
 * NO MODEL CALLS. Everything comes from records the run already produced: the run record (what
 * the model did), the terminal workspace (what it left), and a re-run of the frozen checks
 * against that workspace (why it still fails).
 *
 * CATEGORIES, assigned by the FIRST obstacle the evidence supports, in this order:
 *
 *   BUDGET_EXHAUSTED      terminated by the limit
 *   NO_EDIT_ATTEMPTED     the target file is unchanged and no write/edit ever targeted it
 *   EDIT_BLOCKED          a write/edit targeted it, every one was refused or malformed, file unchanged
 *   EDIT_WRONG            the target file changed, and the requested check still fails
 *   EVAL_OR_INTERPRETATION  the check errored rather than failed, or the model edited the wrong file
 *   UNCERTAIN             the evidence does not decide between the above
 *
 * "Uncertain" is a real category, not a failure of the classifier. A case that fits two readings
 * stays uncertain rather than being forced into the more convenient one.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const { externalTasks } = await import('./benchTasks.js');
const { evaluate, VERDICT } = await import('./evaluator.js');

const ROOT = process.argv[2];
if (!ROOT || !existsSync(ROOT)) { console.error('usage: node server/benchClassify.mjs <bench1-root>'); process.exit(2); }

const summary = readFileSync(join(ROOT, 'summary.jsonl'), 'utf8').split('\n').filter(Boolean)
  .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((e) => e && e.kind === 'run');
const runs = readdirSync(join(ROOT, 'runs')).filter((f) => f.endsWith('.json'))
  .map((f) => { try { return JSON.parse(readFileSync(join(ROOT, 'runs', f), 'utf8')); } catch { return null; } }).filter(Boolean);

const git = (ws, ...a) => { try { return execFileSync('git', ['-C', ws, ...a], { encoding: 'utf8' }).trim(); } catch { return null; } };

const out = [];
for (const task of externalTasks()) {
  const row = summary.find((r) => r.task === task.id);
  if (!row || row.accepted) continue;                       // failures only
  const name = task.id.replace('ext-', '');
  const target = `${name}.py`;
  const ws = join(ROOT, 'ws-ext', task.id);

  // the run record, matched by the goal text (it names the file)
  const rec = runs.find((r) => String(r.goal || '').includes(`${name}.py`)) || null;
  const steps = rec?.steps || [];
  const toolCalls = steps.filter((s) => s.tool);
  const writes = toolCalls.filter((s) => ['write_file', 'edit_file', 'append_file'].includes(s.tool));
  const writesOnTarget = writes.filter((s) => String(s.args?.path || '') === target);
  const writesElsewhere = writes.filter((s) => String(s.args?.path || '') !== target).map((s) => s.args?.path);
  const blockedOnTarget = writesOnTarget.filter((s) => /^ERROR/.test(String(s.result || '')));
  const okOnTarget = writesOnTarget.filter((s) => !/^ERROR/.test(String(s.result || '')));
  const parseFailures = steps.filter((s) => /Could not parse an action/.test(String(s.text || ''))).length;
  const tests = toolCalls.filter((s) => ['run_python', 'run_command'].includes(s.tool)).length;

  // did the target actually change, seed -> terminal?
  const seedRef = git(ws, 'rev-list', '--max-parents=0', 'HEAD');
  const changed = seedRef ? (git(ws, 'diff', '--name-only', seedRef, 'HEAD') || '').split('\n').filter(Boolean) : [];
  const targetChanged = changed.includes(target);

  // why does the requested check still fail? re-run the frozen check on the terminal workspace
  const ev = await evaluate(ws, task);
  const reqOut = String(ev.requested?.out || ev.requested?.reason || '').replace(/\s+/g, ' ').trim();
  const checkErrored = /Traceback|SyntaxError|ImportError|AttributeError|NameError/.test(reqOut) && !/FAIL \[|FAILED \d/.test(reqOut);
  const failCount = (reqOut.match(/FAILED (\d+)\/(\d+)/) || [])[0] || null;

  // ── classify, first obstacle wins ──
  let cls, why;
  if (row.termination === 'TIMEOUT') {
    cls = 'BUDGET_EXHAUSTED'; why = `hit the ${300}s limit; ${toolCalls.length} tool calls, target ${targetChanged ? 'changed' : 'unchanged'}`;
  } else if (!targetChanged && writesOnTarget.length === 0) {
    if (writesElsewhere.length) { cls = 'EVAL_OR_INTERPRETATION'; why = `never touched ${target}; wrote ${[...new Set(writesElsewhere)].join(', ')} instead`; }
    else { cls = 'NO_EDIT_ATTEMPTED'; why = `no write ever targeted ${target}; ${toolCalls.length} tool calls (${[...new Set(toolCalls.map((s) => s.tool))].join(', ') || 'none'}), ${parseFailures} unparseable replies`; }
  } else if (!targetChanged && blockedOnTarget.length > 0 && okOnTarget.length === 0) {
    cls = 'EDIT_BLOCKED'; why = `${blockedOnTarget.length} write(s) to ${target} all refused: ${String(blockedOnTarget[0].result).slice(0, 90)}`;
  } else if (targetChanged && ev.requested?.verdict === VERDICT.FAIL && !checkErrored) {
    cls = 'EDIT_WRONG'; why = `${target} changed (${okOnTarget.length} write(s) landed), still ${failCount || 'failing'}; ${tests} test run(s) by the model`;
  } else if (checkErrored) {
    cls = 'EVAL_OR_INTERPRETATION'; why = `the check ERRORED rather than failed: ${reqOut.slice(0, 90)}`;
  } else {
    cls = 'UNCERTAIN'; why = `changed=${targetChanged} writesOnTarget=${writesOnTarget.length} blocked=${blockedOnTarget.length} verdict=${ev.requested?.verdict}`;
  }

  out.push({ task: name, cls, why, termination: row.termination, protected: row.protected, disposition: row.disposition,
    toolCalls: toolCalls.length, writesOnTarget: writesOnTarget.length, blocked: blockedOnTarget.length, targetChanged, modelTests: tests, parseFailures, failCount, calls: row.modelCalls, secs: row.elapsedSec });
}

console.log('=== BENCH-1 external failures, by FIRST EVIDENCED OBSTACLE ===\n');
for (const r of out) {
  console.log(`${r.task.padEnd(28)} ${r.cls.padEnd(22)} ${r.why}`);
}
const tally = {};
for (const r of out) tally[r.cls] = (tally[r.cls] || 0) + 1;
console.log('\n=== TALLY ===');
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(2)}  ${k}`);
console.log(`  ${String(out.length).padStart(2)}  total failures classified`);
console.log('\nJSON:');
console.log(JSON.stringify(out, null, 1));
