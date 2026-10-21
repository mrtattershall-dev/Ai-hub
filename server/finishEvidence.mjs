/**
 * finishEvidence.mjs - did the agent's own last test fail? Read from the run's steps, not from the model's claim.
 *
 * The finish gate verifies the file the goal names. It never read what the agent itself ran, so a run whose own
 * check exited 1 could finish "Verified" because the entry file loads. This answers the one question the gate was
 * missing, as a pure function over the step record, so it can be tested without a hub and cannot drift from it.
 *
 * Only a command that RAN counts: a refused or denied command has no EXIT line and is not a failing test - a run
 * that never tested is the verifier's question, not this one. The LAST execution decides: a later passing run of
 * anything clears an earlier failure, and a write after a failure does not (the fix has not been re-run).
 *
 * The non-zero pattern is the one batchStepFailed (agent.js) uses for the same signal.
 */
export const EXIT_NONZERO = /(^|\n)EXIT: (?!0\s*$)\S+\s*$/;
const EXEC = new Set(['run_command', 'run_python']);
const EXIT_LINE = /(^|\n)EXIT: \S+\s*$/;

/** null, or { step, tool, command, exit } for the run's last execution when it exited non-zero. */
export function lastSelfTestFailure(steps = []) {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (!s || s.type !== 'tool' || !EXEC.has(s.tool)) continue;
    const r = String(s.result ?? '');
    if (!EXIT_LINE.test(r)) continue;                   // never ran (refused, denied, worker down)
    if (!EXIT_NONZERO.test(r)) return null;             // the last thing that ran passed
    const a = s.args || {};
    return {
      step: s.n,
      tool: s.tool,
      command: String(a.cmd || a.command || (a.path ? `python ${a.path}` : 'inline python')).slice(0, 200),
      exit: (r.match(/EXIT: (\S+)\s*$/) || [])[1] || '?',
      tail: r.replace(EXIT_LINE, '').trim().split('\n').slice(-6).join('\n').slice(-600),
    };
  }
  return null;
}
