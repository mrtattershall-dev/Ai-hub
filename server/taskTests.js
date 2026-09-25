/**
 * taskTests.js - ONE DOCUMENTED COMMAND THAT RUNS THE TASK'S TESTS AND SAYS WHAT WENT WRONG.
 *
 * WHY THIS EXISTS, from the BENCH-3 / CHECK-1 traces:
 *
 *   1. THE TEST DATA WAS NEVER IN THE WORKSPACE. The worker bind-mounts the workspace and
 *      nothing else (worker.js: "THE ONLY MOUNT"), and each task's seed is a single .py file.
 *      The vendored json_testcases sat on the HOST; the acceptance cases were materialised
 *      into /check at EVALUATION time, after the run. So the model could not have run the
 *      task's tests - my earlier obstacle note said it "never ran the test data although the
 *      seed ships with it", which was wrong. Host-side availability is not workspace
 *      availability.
 *   2. THE ORACLE IT DID REACH FOR IS A FALSE PASS. Every QuixBugs seed carries its examples
 *      in a string literal placed AFTER the function at module level - which is neither the
 *      module docstring nor the function docstring, just a discarded expression. So
 *      `doctest.testmod(m)` reports attempted=0, failed=0, exit 0 ON BROKEN CODE (proved in
 *      the worker, taskTests.test.mjs). Two BENCH-3 runs took exactly that route.
 *   3. WITHOUT AN EXPECTED VALUE, A FAILURE IS NOT A DIAGNOSIS. The runs that invented one or
 *      two calls and printed the result had no expected value to compare against, so a wrong
 *      answer looked like an answer and got re-run verbatim until the repeat guard stopped it.
 *
 * WHAT IS EXPOSED, EXACTLY. `run_tests.py` runs THE SAME CASES THE ACCEPTANCE EVALUATOR USES
 * for the requested check, and says so in its own header and output. It is NOT a held-out set.
 * Any experiment using it measures REPAIR WITH SUPPLIED TESTS, never generalization to unseen
 * cases. That label belongs on the result, not in a footnote.
 *
 * WHAT IS NOT EXPOSED:
 *   - the reference implementation (it has never been in any workspace, and is not added here)
 *   - the acceptance evaluator itself: it materialises its own /check directory fresh from the
 *     task definition at evaluation time and mounts the candidate READ-ONLY, so editing (or
 *     deleting) the workspace copy of the cases cannot change a verdict. Asserted, not assumed:
 *     taskTests.test.mjs rewrites the workspace cases to nonsense and shows the verdict is
 *     unmoved.
 *
 * The command is deliberately plain - `python3 run_tests.py` - and is named in the guidance.
 */

/** Cap the per-case report so a wide failure cannot flood the model's context. */
const MAX_REPORTED = 12;

/**
 * The runner that lands in the workspace.
 * `name` is the module/function under test; `casesRel` is the case file beside it.
 *
 * Output contract, one line per case plus a summary:
 *   PASS  case 3  lcs_length('fun', '') -> 0
 *   FAIL  case 1  lcs_length('witch', 'sandwich') -> 1   EXPECTED 2
 *   ERROR case 5  pascal(3) raised IndexError: list index out of range
 *   SUMMARY 7/9 cases pass, 2 fail  (these are the cases the task is graded on)
 */
export const RUN_TESTS_PY = (name, casesRel = 'task_cases.jsonl') => [
  '#!/usr/bin/env python3',
  '"""Run the task\'s tests and report case-level expected vs actual.',
  '',
  `    python3 run_tests.py            all cases`,
  `    python3 run_tests.py 4          just case 4`,
  '',
  'THESE ARE THE CASES THIS TASK IS GRADED ON. They are supplied to you deliberately.',
  'Passing every case here is the requested behaviour. The graded copy lives outside this',
  'workspace and is unaffected by anything you change in here, so editing the case file or',
  'this script changes your feedback only - never your result.',
  '"""',
  'import json, sys, importlib.util, traceback',
  '',
  `MODULE = ${JSON.stringify(name)}`,
  `CASES = ${JSON.stringify(casesRel)}`,
  `MAX_REPORTED = ${MAX_REPORTED}`,
  '',
  '',
  'def load():',
  '    spec = importlib.util.spec_from_file_location(MODULE, MODULE + ".py")',
  '    m = importlib.util.module_from_spec(spec)',
  '    spec.loader.exec_module(m)',
  '    return getattr(m, MODULE)',
  '',
  '',
  'def render(args):',
  '    return MODULE + "(" + ", ".join(repr(a) for a in args) + ")"',
  '',
  '',
  'def main():',
  '    only = None',
  '    if len(sys.argv) > 1:',
  '        try:',
  '            only = int(sys.argv[1])',
  '        except ValueError:',
  '            print("usage: python3 run_tests.py [case number]"); return 2',
  '    try:',
  '        fn = load()',
  '    except Exception:',
  '        # The file does not even import. That IS the first thing to fix, so say it plainly.',
  '        print("CANNOT RUN: " + MODULE + ".py failed to import - fix this first:")',
  '        traceback.print_exc()',
  '        return 2',
  '    try:',
  '        cases = [json.loads(l) for l in open(CASES) if l.strip()]',
  '    except Exception as e:',
  '        print("CANNOT RUN: could not read " + CASES + ": " + str(e))',
  '        return 2',
  '',
  '    results = []',
  '    for i, c in enumerate(cases, 1):',
  '        if only is not None and i != only:',
  '            continue',
  '        args, expected = c[0], c[1]',
  '        if not isinstance(args, list):',
  '            args = [args]',
  '        call = render(args)',
  '        try:',
  '            got = fn(*[list(a) if isinstance(a, list) else a for a in args])',
  '            try:',
  '                if hasattr(got, "__iter__") and not isinstance(got, (str, dict)):',
  '                    got = list(got)',
  '            except Exception:',
  '                pass',
  '            if got == expected:',
  '                results.append((True, "PASS  case %d  %s -> %r" % (i, call, got), None))',
  '            else:',
  '                results.append((False, "FAIL  case %d  %s -> %r   EXPECTED %r" % (i, call, got, expected), (call, repr(got), repr(expected))))',
  '        except Exception as e:',
  '            detail = type(e).__name__ + ": " + str(e)',
  '            results.append((False, "ERROR case %d  %s raised %s   EXPECTED %r" % (i, call, detail, expected), (call, detail, repr(expected))))',
  '',
  '    fails = [r for r in results if not r[0]]',
  '    passes = [r for r in results if r[0]]',
  '    passed, failed = len(passes), len(fails)',
  '    # FAILURES FIRST, always - they are the only lines that can be acted on.',
  '    shown = 0',
  '    for _, line, _ in fails[:MAX_REPORTED]:',
  '        print(line); shown += 1',
  '    if failed > MAX_REPORTED:',
  '        print("... %d more FAILING case(s) not shown" % (failed - MAX_REPORTED))',
  '    for _, line, _ in passes[:max(0, MAX_REPORTED - shown)]:',
  '        print(line); shown += 1',
  '    hidden_passes = passed - min(passed, max(0, MAX_REPORTED - len(fails[:MAX_REPORTED])))',
  '    if hidden_passes > 0:',
  '        print("... %d more passing case(s) not shown" % hidden_passes)',
  '    first_failure = fails[0][2] if fails else None',
  '    total = passed + failed',
  '    print("SUMMARY %d/%d cases pass, %d fail  (these are the cases this task is graded on)" % (passed, total, failed))',
  '    if failed and first_failure:',
  '        call, got, expected = first_failure',
  '        print("FIRST FAILING CASE: %s produced %s but must produce %s" % (call, got, expected))',
  '    return 1 if failed else 0',
  '',
  '',
  'if __name__ == "__main__":',
  '    sys.exit(main())',
  '',
].join('\n');

/**
 * Guidance naming the command. The ONLY difference between the two arms of TESTCMD-1:
 * the control keeps BENCH_GUIDANCE verbatim; the treatment appends these two sentences.
 * Deliberately minimal - the arm must differ by the test command, not by a new essay on
 * how to debug (every extra sentence has moved behaviour before: see the gate-prompt notes).
 */
export const TEST_COMMAND_GUIDANCE = [
  'This workspace contains run_tests.py and the task\'s test cases.',
  'Run `python3 run_tests.py` to see, for every case, the expected value against what your code actually produces.',
].join(' ');

/** The files the treatment arm adds to a task's seed. Nothing else changes. */
export function testCommandFiles(moduleName, casesJsonl) {
  return {
    'run_tests.py': RUN_TESTS_PY(moduleName),
    'task_cases.jsonl': casesJsonl,
  };
}
