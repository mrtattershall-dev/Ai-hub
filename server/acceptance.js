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
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluate, VERDICT } from './evaluator.js';

const exec = promisify(execFile);
const git = async (ws, args) => {
  try { const { stdout } = await exec('git', ['-C', ws, ...args], { encoding: 'utf8', windowsHide: true }); return { ok: true, out: String(stdout).trim() }; }
  catch (e) { return { ok: false, err: String(e.stderr || '').trim() }; }
};

/**
 * ACTUAL BYTES, not git's opinion. Tree equality and a passing recheck supported the earlier
 * RESTORED claims at those levels; they did not support byte-identical restoration, and with
 * core.autocrlf on they were not (governedRun.test, 2026-09-24). This reads every blob of the
 * start commit and compares it to the file on disk, and requires no extra files.
 */
async function bytesIdentical(ws, startRef) {
  const ls = await git(ws, ['ls-tree', '-r', '-z', startRef]);
  if (!ls.ok) return { identical: false, reason: 'ls-tree failed: ' + ls.err };
  const differing = [];
  for (const line of ls.out.split('\0').filter(Boolean)) {
    const m = line.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/);
    if (!m) continue;
    let want;
    try { const { stdout } = await exec('git', ['-C', ws, 'cat-file', 'blob', m[1]], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, windowsHide: true }); want = stdout; }
    catch { differing.push(m[2] + ' (blob unreadable)'); continue; }
    let got;
    try { got = readFileSync(join(ws, m[2])); } catch { differing.push(m[2] + ' (missing)'); continue; }
    if (!got.equals(want)) differing.push(m[2]);
  }
  const st = await git(ws, ['status', '--porcelain']);
  const extra = st.ok ? st.out.split('\n').filter(Boolean) : ['status unavailable'];
  return { identical: differing.length === 0 && extra.length === 0, differing, extra };
}

export const DISPOSITION = Object.freeze({
  RETAIN: 'RETAIN',                          // verified completion, kept
  PRESERVE_INCOMPLETE: 'PRESERVE_INCOMPLETE', // kept, but not a completion and not a baseline
  RESTORED: 'RESTORED',                      // damage rolled back, starting state re-verified
  RESTORE_FAILED: 'RESTORE_FAILED',          // damage detected and NOT undone - must halt
  NO_VERIFIED_BASELINE: 'NO_VERIFIED_BASELINE', // the START state does not satisfy the protected
                                             // spec, so nothing was damaged and there is nothing
                                             // to restore TO - must halt, for a different reason
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
    await git(ws, ['config', 'core.autocrlf', 'false']);   // restore the BYTES that were verified, not a line-ending translation of them
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
    const bytes = await bytesIdentical(ws, startRef);
    out.survivingBytes = bytes.identical ? 'IDENTICAL_TO_START' : `DIFFER: ${[...(bytes.differing || []), ...(bytes.extra || [])].slice(0, 5).join(', ') || bytes.reason}`;
    // RESTORED now claims three things, each checked: git reset succeeded, the protected check
    // passes again, and every byte matches the start commit with nothing extra on disk.
    if (after.protected?.verdict === VERDICT.PASS && bytes.identical) {
      out.disposition = DISPOSITION.RESTORED;
    } else if (bytes.identical) {
      // The bytes ARE the start commit's and the protected check STILL fails. So the candidate
      // damaged nothing: the start state never satisfied the protected spec in the first place,
      // and `startRef`'s documented precondition ("already verified as the task's starting
      // point") was violated by the caller. Reporting that as RESTORE_FAILED - "damage detected
      // and NOT undone" - names a regression that did not happen and would send a recovery
      // controller hunting for damage instead of for its missing baseline.
      out.disposition = DISPOSITION.NO_VERIFIED_BASELINE;
      out.survivingWorkspaceVerdict.note = 'the workspace was restored to startRef byte for byte and the protected check still FAILS, so the starting state never satisfied it: nothing was damaged and there is nothing to restore to. startRef must be a state already verified against this task.';
    } else {
      out.disposition = DISPOSITION.RESTORE_FAILED;
      out.survivingWorkspaceVerdict.note = 'the recheck passed but the bytes on disk are not those of the verified start: ' + out.survivingBytes;
    }
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
