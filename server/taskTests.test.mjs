/**
 * taskTests.test.mjs - THE TEST COMMAND, VERIFIED IN THE WORKER ON BUGGY SEEDS AND KNOWN-GOOD FIXES.
 *
 *   node server/taskTests.test.mjs
 *
 * No model calls. Everything runs in the qualified worker image, the way a task would.
 *
 *   1. THE PREMISE: the test data was never reachable from a task workspace, and the oracle
 *      the model did reach for (doctest) reports a clean pass on broken code.
 *   2. ON A BUGGY SEED the command fails, names the first failing case, and prints expected
 *      vs actual per case.
 *   3. ON THE KNOWN-GOOD REFERENCE it passes, every case, exit 0 - the positive control, so
 *      "it failed" cannot pass because the runner is simply broken.
 *   4. ON A FILE THAT DOES NOT IMPORT it says so instead of reporting a case failure.
 *   5. ITS EXPOSURE IS EXACTLY THE REQUESTED CASES - asserted against the task definition,
 *      so the experiment's label ("repair with supplied tests") is checked, not claimed.
 *   6. IT CANNOT MOVE A VERDICT: rewriting the workspace cases to nonsense leaves the
 *      acceptance evaluator's result unchanged, and the reference is absent from the workspace.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const { externalTasks } = await import('./benchTasks.js');
const { RUN_TESTS_PY, testCommandFiles } = await import('./taskTests.js');
const { evaluate, VERDICT } = await import('./evaluator.js');
const { WORKER_IMAGE } = await import('./worker.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);
const dirs = [];

const BENCH = join(HERE, '..', 'legasus', 'bench', 'quixbugs');
const TASKS = externalTasks();

/** Run a command in the worker against a directory, exactly as a task's run_command would. */
async function inWorker(dir, cmd) {
  const args = ['run', '--rm', '--network', 'none', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges', '-v', `${dir}:/work`, '-w', '/work',
    WORKER_IMAGE, 'sh', '-c', cmd];
  try {
    const { stdout, stderr } = await exec('docker', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, windowsHide: true });
    return { exit: 0, out: String(stdout) + String(stderr) };
  } catch (e) {
    return { exit: e.code ?? 1, out: String(e.stdout || '') + String(e.stderr || '') };
  }
}
function scratchFor(taskName, files) {
  const dir = mkdtempSync(join(tmpdir(), `tt-${taskName}-`));
  dirs.push(dir);
  for (const [f, body] of Object.entries(files)) writeFileSync(join(dir, f), body, 'utf8');
  return dir;
}
const casesOf = (name) => readFileSync(join(BENCH, name, 'cases.jsonl'), 'utf8');
const seedOf = (name) => readFileSync(join(BENCH, name, 'seed.py'), 'utf8');
const refOf = (name) => {
  for (const f of ['reference.py', 'fixed.py', 'correct.py']) {
    const p = join(BENCH, name, f);
    if (existsSync(p)) return readFileSync(p, 'utf8');
  }
  return null;
};

try {
  // ── 1. THE PREMISE ──
  console.log('=== 1. the premise: unreachable data, and an oracle that passes broken code ===');
  {
    const t = TASKS.find((x) => x.id === 'ext-lcs_length');
    say(Object.keys(t.seed).length === 1 && Object.keys(t.seed)[0] === 'lcs_length.py',
      `a task seed is ONLY the buggy module (${Object.keys(t.seed).join(', ')}) - no cases, no tests`);
    const vendored = readdirSync(join(BENCH, 'lcs_length'));
    say(vendored.includes('cases.jsonl'), `the cases exist, but on the HOST only (${vendored.join(', ')})`);
    // the oracle the model reached for, in the worker, on the buggy seed
    const d = scratchFor('doctest', { 'lcs_length.py': seedOf('lcs_length') });
    const r = await inWorker(d, 'python3 -c "import lcs_length, doctest; r=doctest.testmod(lcs_length); print(\'attempted\', r.attempted, \'failed\', r.failed); print(\'buggy output\', lcs_length.lcs_length(\'witch\',\'sandwich\'))"');
    say(/attempted 0 +failed 0/.test(r.out) && r.exit === 0,
      `doctest.testmod on the buggy seed: attempted 0, failed 0, exit ${r.exit} - a CLEAN PASS on broken code`);
    say(/buggy output 1/.test(r.out), 'while the function actually returns 1 where the file\'s own example says 2');
    note('the examples sit in a string literal after the function - neither module nor function docstring');
  }

  // ── 2. BUGGY SEEDS ──
  console.log('\n=== 2. on every buggy seed: fails, with expected vs actual per case ===');
  {
    let allFail = 0, named = 0, hasExpected = 0;
    for (const t of TASKS) {
      const name = t.id.replace(/^ext-/, '');
      const dir = scratchFor(name, { [`${name}.py`]: seedOf(name), ...testCommandFiles(name, casesOf(name)) });
      const r = await inWorker(dir, 'python3 run_tests.py');
      if (r.exit === 1 && /SUMMARY \d+\/\d+ cases pass, [1-9]/.test(r.out)) allFail++;
      if (/FIRST FAILING CASE: .* produced .* but must produce /.test(r.out)) named++;
      if (/(FAIL|ERROR) +case \d+ .*EXPECTED /.test(r.out)) hasExpected++;
      if (name === 'lcs_length') note(r.out.split('\n').filter(Boolean).slice(0, 4).join('\n        '));
    }
    say(allFail === TASKS.length, `all ${TASKS.length} buggy seeds FAIL with a summary and exit 1 (${allFail}/${TASKS.length})`);
    say(named === TASKS.length, `all ${TASKS.length} name the first failing case in cause-and-effect terms (${named}/${TASKS.length})`);
    say(hasExpected === TASKS.length, `all ${TASKS.length} print EXPECTED alongside the actual value (${hasExpected}/${TASKS.length})`);
  }

  // ── 3. KNOWN-GOOD REPAIRS: the positive control ──
  console.log('\n=== 3. POSITIVE CONTROL: on the known-good reference it passes, exit 0 ===');
  {
    let checked = 0, ok = 0;
    for (const t of TASKS) {
      const name = t.id.replace(/^ext-/, '');
      const ref = refOf(name);
      if (!ref) continue;
      checked++;
      const dir = scratchFor(`${name}-ref`, { [`${name}.py`]: ref, ...testCommandFiles(name, casesOf(name)) });
      const r = await inWorker(dir, 'python3 run_tests.py');
      if (r.exit === 0 && /SUMMARY (\d+)\/\1 cases pass, 0 fail/.test(r.out)) ok++;
      else if (checked <= 2) note(`${name}: exit ${r.exit} ${r.out.split('\n').filter((l) => /SUMMARY|FAIL|ERROR|CANNOT/.test(l))[0] || ''}`);
    }
    say(checked > 0, `reference implementations available for ${checked} of ${TASKS.length} tasks`);
    say(checked > 0 && ok === checked, `every reference passes every case, exit 0 (${ok}/${checked}) - the runner is not simply always-fail`);
  }

  // ── 4. A FILE THAT DOES NOT IMPORT ──
  console.log('\n=== 4. an unparseable candidate is reported as that, not as a case failure ===');
  {
    const dir = scratchFor('broken', { 'lcs_length.py': 'def lcs_length(s, t)\n    return ???\n', ...testCommandFiles('lcs_length', casesOf('lcs_length')) });
    const r = await inWorker(dir, 'python3 run_tests.py');
    say(r.exit === 2 && /CANNOT RUN: lcs_length\.py failed to import/.test(r.out), `exit 2 and "CANNOT RUN ... failed to import" (exit ${r.exit})`);
    say(!/FAIL case/.test(r.out), 'and no case is reported as failing - the file never ran');
  }

  // ── 5. WHAT IS EXPOSED, ASSERTED ──
  console.log('\n=== 5. the exposed cases ARE the requested cases (so the label is checked) ===');
  {
    let same = 0;
    for (const t of TASKS) {
      const name = t.id.replace(/^ext-/, '');
      if (testCommandFiles(name, casesOf(name))['task_cases.jsonl'] === t.requested.files['cases.jsonl']) same++;
    }
    say(same === TASKS.length, `supplied cases are byte-identical to the requested check's cases (${same}/${TASKS.length})`);
    say(/graded on/.test(RUN_TESTS_PY('lcs_length')), 'and the script says so to the model, in its own output');
    const protOnly = TASKS.filter((t) => t.protectedCases < t.upstreamCases).length;
    say(protOnly === TASKS.length, `the PROTECTED check remains a subset (${protOnly}/${TASKS.length}) - passing these does not automatically mean protected behaviour is met`);
    note('LABEL: any result using this is REPAIR WITH SUPPLIED TESTS, not held-out generalization.');
  }

  // ── 6. IT CANNOT MOVE A VERDICT ──
  console.log('\n=== 6. the evaluator is outside the candidate\'s reach ===');
  {
    const t = TASKS.find((x) => x.id === 'ext-lcs_length');
    const dir = scratchFor('verdict', { 'lcs_length.py': seedOf('lcs_length'), ...testCommandFiles('lcs_length', casesOf('lcs_length')) });
    await exec('git', ['-C', dir, 'init', '-q'], { windowsHide: true });
    await exec('git', ['-C', dir, 'config', 'core.autocrlf', 'false'], { windowsHide: true });
    await exec('git', ['-C', dir, 'add', '-A'], { windowsHide: true });
    await exec('git', ['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'seed'], { windowsHide: true });
    const before = await evaluate(dir, t, { timeoutSec: 60 });
    // the candidate rewrites its own cases to something it trivially passes, and guts the runner
    writeFileSync(join(dir, 'task_cases.jsonl'), '[["a", "a"], 0]\n', 'utf8');
    writeFileSync(join(dir, 'run_tests.py'), 'print("SUMMARY 99/99 cases pass, 0 fail")\n', 'utf8');
    const after = await evaluate(dir, t, { timeoutSec: 60 });
    say(before.requested?.verdict === VERDICT.FAIL, `the buggy seed's requested verdict is FAIL (${before.requested?.verdict})`);
    say(after.requested?.verdict === VERDICT.FAIL, `still FAIL after the candidate rewrote the cases and the runner (${after.requested?.verdict})`);
    say(!existsSync(join(dir, 'reference.py')) && !readdirSync(dir).some((f) => /reference|solution|fixed|correct/i.test(f)),
      `no reference implementation is present in the workspace (${readdirSync(dir).filter((f) => f !== '.git').join(', ')})`);
  }
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log(`\n  task tests: ${passed} passed, ${failed} failed -> ${failed ? 'THE TEST COMMAND IS NOT TRUSTWORTHY YET' : 'the command fails on bugs, passes references, names the first failure, and cannot move a verdict'}`);
process.exit(failed ? 1 : 0);
