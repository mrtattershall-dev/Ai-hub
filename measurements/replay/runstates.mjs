// runstates.mjs - the workspace tree each goal of a sequential run STARTED and ENDED with, from the hub's own
// checkpoints. Shared by the regression tools (regress.mjs) and the replay-scenario builder.
//
// The hub commits the whole workspace BEFORE each mutating tool, but only when the tree is dirty, and logs every
// checkpoint in the run file as a step {type: 'checkpoint', text: 'checkpoint <sha>'}. So:
//   start(j) = the tree when goal j began:
//     - run j has no checkpoint and no mutating step -> start(j + 1)   (a read-only goal changes nothing)
//     - its first checkpoint comes before its first mutating step -> that checkpoint
//     - it mutated first with a CLEAN tree (no checkpoint then) -> the parent of its first checkpoint
//     - it has no checkpoint at all -> the newest checkpoint of an earlier goal, else the repo's root commit
//   end(i) = start(i + 1); for the last goal, 'final' (the final workspace).
// Timing is never used: git times are whole seconds and consecutive goals often start within one. And the first
// checkpoint a later goal makes is NOT the previous goal's end state when that goal's first write found a clean tree
// - its own first edit is already inside it. (That was the flaw in the first regress-C.)
import { execFileSync } from 'node:child_process';

export const MUTATING = new Set(['write_file', 'append_file', 'edit_file', 'run_command', 'run_python', 'download_file', 'spawn_subtask']);

export function runStates(ws, runs) {
  const git = (...a) => execFileSync('git', ['-C', ws, ...a], { encoding: 'utf8' }).trim();
  const all = git('log', '--format=%H').split('\n').filter(Boolean);   // newest first
  const full = (sha) => all.find((h) => h.startsWith(sha)) || sha;
  const root = all[all.length - 1];
  const info = runs.map((r) => {
    const cps = []; let firstCp = -1, firstMut = -1;
    (r.steps || []).forEach((s, k) => {
      if (s.type === 'checkpoint') {
        const m = /checkpoint\s+([0-9a-f]{7,40})/.exec(String(s.text || ''));
        if (m) { cps.push(full(m[1])); if (firstCp < 0) firstCp = k; }
      }
      if (s.type === 'tool' && MUTATING.has(s.tool) && firstMut < 0) firstMut = k;
    });
    return { cps, firstCp, firstMut: firstMut < 0 ? Infinity : firstMut };
  });
  const memo = new Map();
  const how = new Map();
  const start = (j) => {
    if (j >= runs.length) return 'final';
    if (memo.has(j)) return memo.get(j);
    const x = info[j]; let s, h;
    if (!x.cps.length && x.firstMut === Infinity) { s = start(j + 1); h = 'read-only goal: next goal\'s start'; }
    else if (x.cps.length && x.firstCp < x.firstMut) { s = x.cps[0]; h = 'its first checkpoint'; }
    else if (x.cps.length) { try { s = git('rev-parse', x.cps[0] + '^'); } catch { s = root; } h = 'clean tree at first write: parent of its first checkpoint'; }
    else { s = null; for (let k = j - 1; k >= 0 && !s; k--) if (info[k].cps.length) s = info[k].cps[info[k].cps.length - 1]; s = s || root; h = 'no checkpoint: newest earlier checkpoint'; }
    memo.set(j, s); how.set(j, h); return s;
  };
  return { start, end: (i) => start(i + 1), how: (j) => (start(j), how.get(j)), info, root };
}

/** Export one commit's tree into dir (created). */
export function exportTree(ws, sha, dir) {
  const u = (p) => p.replace(/\\/g, '/');
  execFileSync('bash', ['-c', `mkdir -p "${u(dir)}" && git -C "${u(ws)}" archive ${sha} | tar -x -C "${u(dir)}"`]);
}
