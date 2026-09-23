/**
 * acceptance.js - CONNECT THE BEHAVIOURAL VERDICT TO WHAT SURVIVES.
 *
 * PILOT-2 detected a behavioural regression and then LET IT SURVIVE. t5 broke `cartTotal`, the
 * evaluator said FAIL, and the broken workspace remained the workspace. Detection without
 * disposition is the practical gap before unattended operation can be extended.
 *
 * THIS IS ORDINARY CHECK-AND-ROLLBACK. It is not credited to Legasus, and nothing here claims an
 * additional benefit over doing the obvious thing - that would need a comparison, which this is
 * not.
 *
 * THE POLICY, explicit for these five tasks:
 *
 *   protected  requested   disposition
 *   ---------  ---------   -----------------------------------------------------------------
 *   PASS       PASS        RETAIN as a verified completion
 *   PASS       FAIL        PRESERVE as incomplete work. NOT a completion, and NOT promoted
 *                          into the next task's baseline: passing a limited preservation suite
 *                          does not establish that a partial change is fit to build upon.
 *   FAIL       either      CAPTURE the candidate, RESTORE the verified starting state, RECHECK
 *   EVAL_ERROR unknown     PRESERVE the candidate separately and STOP without promoting it
 *
 * TWO VERDICTS ARE REPORTED, ALWAYS, AND SEPARATELY:
 *
 *     candidateVerdict          what the model actually produced
 *     survivingWorkspaceVerdict what is in the workspace afterwards
 *
 * Collapsing them would let a successful restore read as though the model never broke anything.
 * The regression must stay visible in the record after it has been rolled back.
 *
 * A RESTORE THAT CANNOT BE VERIFIED IS NOT A RESTORE. The recheck is what licenses the claim;
 * without it this would be "we ran a git command and assumed".
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { evaluate, VERDICT } from './evaluator.js';

const exec = promisify(execFile);
const git = async (ws, args) => {
  try { const { stdout } = await exec('git', ['-C', ws, ...args], { encoding: 'utf8', windowsHide: true }); return { ok: true, out: String(stdout).trim() }; }
  catch (e) { return { ok: false, err: String(e.stderr || '').trim() }; }
};

export const DISPOSITION = Object.freeze({
  RETAIN: 'RETAIN',                          // verified completion, kept
  PRESERVE_INCOMPLETE: 'PRESERVE_INCOMPLETE', // kept, but not a completion and not a baseline
  RESTORED: 'RESTORED',                      // damage rolled back, starting state re-verified
  RESTORE_FAILED: 'RESTORE_FAILED',          // damage detected and NOT undone - must halt
  HELD: 'HELD',                              // evaluation error: candidate held, nothing promoted
});

/**
 * Apply the policy to one evaluated task.
 *
 * `startRef` must be the state ALREADY VERIFIED as the task's starting point - the seed commit.
 * Restoring to an unverified earlier state would only move the problem.
 */
export async function applyAcceptance(ws, task, candidateVerdict, { startRef, captureDir, taskId, image }) {
  const out = {
    task: taskId || task.id,
    candidateVerdict: {
      overall: candidateVerdict.verdict,
      requested: candidateVerdict.requested?.verdict ?? null,
      protected: candidateVerdict.protected?.verdict ?? null,
      candidateTree: candidateVerdict.candidateTree ?? null,
    },
    disposition: null,
    capturedAt: null,
    survivingWorkspaceVerdict: null,
    promotable: false,          // may this workspace become a later task's baseline?
    countsAsCompletion: false,
  };

  const prot = candidateVerdict.protected?.verdict ?? null;
  const req = candidateVerdict.requested?.verdict ?? null;
  const anyError = candidateVerdict.verdict === VERDICT.EVALUATION_ERROR
    || prot === VERDICT.EVALUATION_ERROR || req === VERDICT.EVALUATION_ERROR;

  // ── EVALUATION ERROR: nothing is known, so nothing is promoted ──
  if (anyError) {
    out.disposition = DISPOSITION.HELD;
    out.capturedAt = capture(ws, captureDir, `${out.task}-held`);
    out.survivingWorkspaceVerdict = { overall: VERDICT.EVALUATION_ERROR, note: 'not re-evaluated: the instrument failed, so a second reading would be no more trustworthy than the first' };
    return out;
  }

  // ── PROTECTED FAILED: capture, restore, RECHECK ──
  if (prot === VERDICT.FAIL) {
    out.capturedAt = capture(ws, captureDir, `${out.task}-rejected`);
    const reset = await git(ws, ['reset', '--hard', startRef]);
    const clean = await git(ws, ['clean', '-fd']);
    if (!reset.ok || !clean.ok) {
      out.disposition = DISPOSITION.RESTORE_FAILED;
      out.survivingWorkspaceVerdict = { overall: VERDICT.EVALUATION_ERROR, note: `the workspace could not be restored: ${reset.err || clean.err}` };
      return out;
    }
    // THE RECHECK. Without it, "restored" is an assumption about a git command's exit code.
    const after = await evaluate(ws, task, { image });
    out.survivingWorkspaceVerdict = {
      overall: after.verdict,
      requested: after.requested?.verdict ?? null,
      protected: after.protected?.verdict ?? null,
      candidateTree: after.candidateTree ?? null,
    };
    out.disposition = after.protected?.verdict === VERDICT.PASS ? DISPOSITION.RESTORED : DISPOSITION.RESTORE_FAILED;
    // Restored means the damage is gone. It does NOT mean the task was completed.
    return out;
  }

  // ── PROTECTED PASSED ──
  const after = await evaluate(ws, task, { image });
  out.survivingWorkspaceVerdict = {
    overall: after.verdict,
    requested: after.requested?.verdict ?? null,
    protected: after.protected?.verdict ?? null,
    candidateTree: after.candidateTree ?? null,
  };
  if (req === VERDICT.PASS) {
    out.disposition = DISPOSITION.RETAIN;
    out.countsAsCompletion = true;
    out.promotable = true;
  } else {
    // Preserved, but explicitly NOT a completion and NOT a baseline for later work.
    out.disposition = DISPOSITION.PRESERVE_INCOMPLETE;
    out.countsAsCompletion = false;
    out.promotable = false;
  }
  return out;
}

function capture(ws, captureDir, name) {
  if (!captureDir) return null;
  const dest = join(captureDir, name);
  try {
    mkdirSync(captureDir, { recursive: true });
    rmSync(dest, { recursive: true, force: true });
    cpSync(ws, dest, { recursive: true });
    return dest;
  } catch { return null; }
}

export { VERDICT };
