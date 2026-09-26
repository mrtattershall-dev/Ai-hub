/**
 * autodiag.js - RUN THE DIAGNOSTIC FOR THE MODEL, AND HAND IT THE RESULT.
 *
 * TESTCMD-1 established what this replaces. The model was given the graded cases, a runner
 * over them, and a sentence naming the command; the instruction went out intact, in the same
 * position, in all 25 capturable runs, and the runner's full source was inlined in the same
 * 25. Execution was nevertheless observed in only 5 of 27 runs. The workflow required the
 * model to discover and choose the diagnostic, and it mostly did not.
 *
 * THE DISTINCTION THAT MATTERS: receiving the runner's SOURCE is not receiving the test
 * RESULTS. Those are different inputs, and only the second is behavioural feedback about the
 * code as it stands. This module supplies the second.
 *
 *   - before the first model call, against the starting candidate
 *   - again after a successful edit to the target file, before the next model call
 *
 * FOUR PROPERTIES, each one a thing that has gone wrong here before:
 *
 *   1. PRISTINE. The runner and the case file are written fresh into a scratch copy of the
 *      workspace, overwriting anything the candidate put there. A model that edits its own
 *      tests changes nothing about what it is told.
 *   2. BOUND TO CONTENT. Every result carries the sha256 and line count of the exact file
 *      tested. A result that cannot name what it judged is not a result - and a STALE result
 *      presented as current would be worse than none.
 *   3. INFRASTRUCTURE FAILURE IS NOT A FAILING CASE. Docker unavailable, a timeout, an
 *      unreadable case file: these produce DIAGNOSTIC_UNAVAILABLE, which says plainly that
 *      nothing is known about the code's behaviour. Scoring apparatus failure as "your code
 *      fails" would be a lie to the model of exactly the kind this project keeps finding.
 *   4. BOUNDED, AND HONEST ABOUT WHAT IT OMITS. At most MAX_SHOWN failing cases are printed,
 *      and if any are withheld the message says how many. The model is never left to infer
 *      that it has seen everything.
 *
 * The independent acceptance evaluator is untouched: it materialises its own checks at
 * evaluation time and mounts the candidate read-only. Nothing here can move a verdict.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WORKER_IMAGE } from './worker.js';
import { RUN_TESTS_PY } from './taskTests.js';

const exec = promisify(execFile);

/** How many failing cases the model is shown. Withheld ones are always counted out loud. */
export const MAX_SHOWN = 6;

export const DIAG = Object.freeze({
  OK: 'OK',                                       // the diagnostic ran; its verdict is about the code
  UNAVAILABLE: 'DIAGNOSTIC_UNAVAILABLE',          // apparatus failed; NOTHING is known about the code
});

/** sha256 + line count of the file under test, so a result names exactly what it judged. */
/**
 * GAME SNAPSHOT: the tracked files of a browser game (html/js/css/json at the top level and
 * one level down; never node_modules or dotfiles), their contents, and one sha256 over all of
 * them in name order. This is the play kind's "target": freshness, checkpoints and exact
 * restoration work over the SET, not a single module.
 */
export function gameSnapshot(workspace) {
  const files = {};
  const walk = (dir, rel, depth) => {
    let names = [];
    try { names = readdirSync(dir).sort(); } catch { return; }
    for (const n of names.slice(0, 400)) {
      if (n === 'node_modules' || n.startsWith('.')) continue;
      const p = join(dir, n), r = rel ? `${rel}/${n}` : n;
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) { if (depth < 1) walk(p, r, depth + 1); continue; }
      // html/js/css only: package.json is written by the Hub itself when it prepares a workspace
      // and would make the game's identity churn with the Hub's bookkeeping.
      if (/\.(html|js|mjs|css)$/i.test(n) && st.size <= 512 * 1024) files[r] = readFileSync(p, 'utf8');
    }
  };
  walk(workspace, '', 0);
  const h = createHash('sha256');
  let bytes = 0;
  for (const k of Object.keys(files).sort()) { h.update(k).update('\0').update(files[k]).update('\0'); bytes += Buffer.byteLength(files[k]); }
  return { files, sha256: h.digest('hex'), count: Object.keys(files).length, bytes };
}

function identify(workspace, moduleName) {
  const p = join(workspace, `${moduleName}.py`);
  if (!existsSync(p)) return null;
  const raw = readFileSync(p);
  return { sha256: createHash('sha256').update(raw).digest('hex'), bytes: raw.length, lines: raw.toString('utf8').split('\n').length };
}

/**
 * Run the pristine diagnostic against the workspace as it currently stands.
 * Returns { status, identity, attempted, passed, failed, failures[], omitted, raw, reason }.
 */
export async function runDiagnostic(workspace, diag, { image = WORKER_IMAGE, timeoutSec = 60 } = {}) {
  if (diag && diag.kind === 'play') return runPlayDiagnostic(workspace, diag, { timeoutSec });
  const { moduleName, casesJsonl } = diag;
  const identity = identify(workspace, moduleName);
  if (!identity) {
    return { status: DIAG.UNAVAILABLE, identity: null, reason: `${moduleName}.py is not in the workspace` };
  }
  const scratch = mkdtempSync(join(tmpdir(), 'autodiag-'));
  try {
    cpSync(workspace, scratch, { recursive: true, filter: (src) => !src.includes('.git') });
    // PRISTINE - written after the copy, so a tampered workspace copy is overwritten.
    writeFileSync(join(scratch, 'run_tests.py'), RUN_TESTS_PY(moduleName, 'task_cases.jsonl', 100000), 'utf8');
    writeFileSync(join(scratch, 'task_cases.jsonl'), casesJsonl, 'utf8');
    const args = ['run', '--rm', '--network', 'none', '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges', '--user', '1000:1000',
      '-v', `${scratch}:/work`, '-w', '/work', image,
      'sh', '-c', `timeout ${timeoutSec} python3 run_tests.py`];
    let out = '', exitCode = 0;
    try {
      // HOST-SIDE timeout too: `timeout N` inside the container cannot help if docker
      // itself never returns. Same unbounded-wait class that cost AUTODIAG-1 half its units.
      const r = await exec('docker', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true, timeout: (timeoutSec + 30) * 1000 });
      out = String(r.stdout) + String(r.stderr);
    } catch (e) {
      out = String(e.stdout || '') + String(e.stderr || '');
      exitCode = e.code ?? 1;
      // Exit 1 is "cases failed" - a real verdict. Anything else with no runner output at all
      // is apparatus: docker missing, image gone, the container killed. Say which.
      const looksLikeRunner = /SUMMARY \d+\/\d+ cases pass|CANNOT RUN:/.test(out);
      if (!looksLikeRunner) {
        return { status: DIAG.UNAVAILABLE, identity, reason: `the diagnostic could not be executed (exit ${exitCode})`, raw: out.slice(0, 500) };
      }
    }
    if (/CANNOT RUN: .* failed to import/.test(out)) {
      // The candidate does not import. That IS about the code, not the apparatus.
      const tb = (out.match(/\n(\w*Error:[^\n]*)/) || [])[1] || 'see the traceback';
      return { status: DIAG.OK, identity, attempted: 0, passed: 0, failed: null, importError: tb, failures: [], omitted: 0, raw: out.slice(0, 2000) };
    }
    const sum = out.match(/SUMMARY (\d+)\/(\d+) cases pass, (\d+) fail/);
    if (!sum) {
      return { status: DIAG.UNAVAILABLE, identity, reason: 'the diagnostic produced no summary line', raw: out.slice(0, 500) };
    }
    const failures = [];
    for (const line of out.split('\n')) {
      const m = line.match(/^(FAIL|ERROR) +case (\d+) +(.*)$/);
      if (m) failures.push({ n: +m[2], kind: m[1], text: m[3].trim() });
    }
    return {
      status: DIAG.OK, identity,
      attempted: +sum[2], passed: +sum[1], failed: +sum[3],
      failures, omitted: Math.max(0, failures.length - MAX_SHOWN), raw: out.slice(0, 4000),
    };
  } catch (e) {
    return { status: DIAG.UNAVAILABLE, identity, reason: `the diagnostic could not be executed: ${e.message}`.slice(0, 200) };
  } finally {
    try { rmSync(scratch, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

/**
 * The PLAY kind: the declared play (playCheck.js) against the workspace as it stands. Same
 * result shape as the python kind - counts, failing cases with what was expected and what was
 * observed, an identity bound to the game's tracked files - so delivery, freshness, the
 * controller and acceptance treat a browser game exactly like a module.
 */
async function runPlayDiagnostic(workspace, diag, { timeoutSec = 60 } = {}) {
  const spec = diag.spec || {};
  const snap = gameSnapshot(workspace);
  const identity = { sha256: snap.sha256, bytes: snap.bytes, lines: snap.count };
  const entry = spec.entry || 'index.html';
  const label = `the game at ${entry}`;
  if (!snap.files[entry]) {
    return { status: DIAG.OK, identity, targetLabel: label, attempted: 0, passed: 0, failed: null, importError: `${entry} does not exist yet, so nothing can be played`, failures: [], omitted: 0, raw: '' };
  }
  let playCheck;
  try { playCheck = (await import('./playCheck.js')).playCheck; }
  catch (e) { return { status: DIAG.UNAVAILABLE, identity, targetLabel: label, reason: `the play runner could not load: ${String(e.message || e).slice(0, 120)}` }; }
  const r = await playCheck(workspace, spec, { timeoutMs: timeoutSec * 1000 });
  if (r.status !== 'OK') return { status: DIAG.UNAVAILABLE, identity, targetLabel: label, reason: r.reason || 'the play could not run', raw: r.log };
  const failures = r.cases.filter((c) => c.kind !== 'PASS').map((c) => ({ n: c.n, kind: c.kind, text: `${c.name}${c.text ? ' -> ' + c.text : ''}` }));
  return { status: DIAG.OK, identity, targetLabel: label, attempted: r.total, passed: r.passing.size, failed: r.failing.size, failures, omitted: Math.max(0, failures.length - MAX_SHOWN), raw: String(r.log).slice(0, 4000) };
}

/**
 * The message the model actually receives. Bounded, content-bound, and explicit about
 * anything withheld. `when` distinguishes the opening report from a post-edit re-run.
 */
export function diagnosticMessage(result, moduleName, when = 'start', { mode = 'full' } = {}) {
  // mode 'full' (default): counts plus up to MAX_SHOWN failing cases with expected vs actual.
  // mode 'summary': the SAME delivery points, header and counts, but no case is listed - a
  // truthful generic notification that tests were run and how many fail. It exists so an
  // experiment can separate "the model was told tests fail, now" from "the model was told
  // WHICH inputs fail and what came out". Nothing in it is fabricated or hand-authored.
  const head = when === 'start'
    ? 'AUTOMATIC DIAGNOSTIC - run for you before you started. You did not need to run it, and you do not need to run it yourself.'
    : 'AUTOMATIC DIAGNOSTIC - re-run for you just now, against the file as you have just left it.';

  if (result.status === DIAG.UNAVAILABLE) {
    return `${head}\n\nDIAGNOSTIC UNAVAILABLE: ${result.reason}.\n`
      + 'This is an INFRASTRUCTURE failure, not a test failure. NOTHING is known about whether '
      + `${moduleName}.py behaves correctly - do not treat this as a pass or a fail. Test it yourself if you can.`;
  }
  const id = result.targetLabel
    ? `${result.targetLabel}${result.identity ? ` (${result.identity.lines} tracked file(s), sha256 ${result.identity.sha256.slice(0, 16)})` : ''}`
    : result.identity
      ? `${moduleName}.py (sha256 ${result.identity.sha256.slice(0, 16)}, ${result.identity.lines} lines)`
      : `${moduleName}.py`;

  if (result.importError !== undefined) {
    return `${head}\n\nTESTED: ${id}\n`
      + (mode === 'summary'
        ? (result.targetLabel ? 'RESULT: the game cannot be played.\n' : 'RESULT: the file does not import.\n')
        : (result.targetLabel ? `RESULT: the game cannot be played - ${result.importError}\n` : `RESULT: the file does not import - ${result.importError}\n`))
      + (result.targetLabel ? 'No step could be attempted. Make the entry page load first; until it does, nothing else can be checked.' : 'No case could be attempted. Fix the import/syntax error first; until it imports, nothing else can be checked.');
  }
  const shown = result.failures.slice(0, MAX_SHOWN);
  const lines = [
    head, '',
    `TESTED: ${id}`,
    `RESULT: ${result.attempted} cases attempted, ${result.passed} passed, ${result.failed} failed.`,
  ];
  if (result.failed === 0) {
    lines.push('', 'Every case passes on the file as it now stands.');
  } else if (mode === 'summary') {
    lines.push('', 'This notification carries the counts only. Which cases fail, their inputs, what was expected and what your code produced are NOT included here.');
  } else {
    lines.push('', 'Failing cases (expected versus what your code actually produced):');
    for (const f of shown) lines.push(`  ${f.kind} case ${f.n}  ${f.text}`);
    if (result.omitted > 0) {
      lines.push(`  ... ${result.omitted} further failing case(s) NOT SHOWN here (${result.failures.length} fail in total).`);
      lines.push('  You are not seeing all of them. Do not assume the ones above are the only problems.');
    }
  }
  lines.push('', 'This result is about the file exactly as identified above. If you change it, this report is out of date until the next one.');
  return lines.join('\n');
}
