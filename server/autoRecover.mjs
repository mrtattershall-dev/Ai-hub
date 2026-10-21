// Recovery is separate from the queue supervisor: it never creates new tasks or approves tools.
export async function recoverInterrupted(run, { now = Date.now(), healthy, save, resume, report = () => {} }) {
  if (run.status !== 'interrupted' || run.busy || run.depth || run.pending) return false;
  const r = run.autoRecovery ||= { attempts: 0, nextAt: 0 };
  if (r.attempts >= 6) { report('needs attention: six recovery attempts exhausted'); return false; }
  if (!r.nextAt) { r.nextAt = now + 30000; save(run); }
  if (now < r.nextAt) { report('recovering: backoff', { nextAt: r.nextAt }); return false; }
  let ok = false;
  try { ok = await healthy(); } catch { /* daemon restarting */ }
  if (!ok) { r.nextAt = now + 30000; save(run); report('recovering: waiting for Ollama'); return false; }
  // Persist the attempt before acting, so restarts cannot reset the retry budget.
  r.attempts++;
  r.nextAt = now + Math.min(15 * 60000, 30000 * 2 ** r.attempts);
  save(run);
  report('resuming', { attempt: r.attempts });
  await resume(run);
  return true;
}
