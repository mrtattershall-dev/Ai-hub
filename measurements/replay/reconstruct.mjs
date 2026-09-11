// reconstruct.mjs - rebuild the model replies a PRUNED run.history lost, from the run's untrimmed steps.
//
// run.history is a context window (pruneHistory drops old messages in place); run.steps is never trimmed and
// records every executed action with its arguments. For runs recorded before the hub wrote full transcripts
// (sets A-D), the replies that fell out of the history can be rebuilt in the exact plain-text format the hub's
// parser reads - IF the step -> reply mapping follows the hub's semantics:
//   tool                  the model's action (unless it is the test_web the hub runs itself right after a
//                         "Verifying in a browser before finishing" block, or a batch-internal action)
//   policy_denied /       the model's action, refused or parked by the approval policy
//   approval_request
//   error + tool          the model's action that the hub then stopped on (e.g. "Same error persisted")
//   error + thought       a finish the gate blocked ("Verifying...", "Do NOT finish yet"), or an unknown tool
//   error, no thought     "Could not parse an action" / "cut off" = an unparseable reply; "Stopped: the model produced
//                         the same response" = the previous reply again (never executed); anything else is the hub's
//   finish               the model's finish (thought 'auto' = the hub's auto-finish after clean tests: not a reply)
//   plan, checkpoint, policy_allowed, note, subtask_*  - bookkeeping, not replies
// What cannot come back: the 2nd..Nth actions of a multi-action reply (never executed, so never a step), and write
// contents the run file cut on disk (RUN_ARG_MAX) - such replies are flagged lossy.
//
//   node reconstruct.mjs --validate <scenarios.jsonl> <runsDir>   check the mapping on runs that were NOT pruned
const FENCE = '`'.repeat(3);
const CUT = /\n… \[\d+ more characters not kept on disk\]$/;

export function modelSteps(steps) {
  const out = [];
  let hubTestNext = false;
  for (const s of steps || []) {
    const t = s.type;
    if (t === 'tool') {
      if (hubTestNext && s.tool === 'test_web') { hubTestNext = false; continue; }
      hubTestNext = false; out.push(s); continue;
    }
    if (t === 'policy_denied' || t === 'approval_request') { hubTestNext = false; out.push({ ...s, type: 'tool' }); continue; }
    if (t === 'error') {
      if (s.tool) { out.push({ ...s, type: 'tool' }); continue; }
      if (s.thought !== undefined) {
        if (/^Unknown tool: /.test(String(s.text || ''))) { out.push({ type: 'unknown', tool: String(s.text).slice(14).trim(), thought: s.thought }); continue; }
        out.push({ type: 'finish', thought: s.thought, summary: '(blocked finish)' });
        hubTestNext = /^Verifying in a browser before finishing/.test(String(s.text || ''));
        continue;
      }
      if (/Could not parse an action|cut off inside its code block/.test(String(s.text || ''))) { out.push({ type: 'unparseable' }); continue; }
      // The repetition guard stops on a reply it never executes: the model said the previous reply again.
      if (/^Stopped: the model produced the same response/.test(String(s.text || '')) && out.length) { out.push(out[out.length - 1]); continue; }
      continue;
    }
    if (t === 'finish') { if (s.thought === 'auto') continue; out.push(s); continue; }
  }
  return out;
}

const fence = (body, lang = '') => `${FENCE}${lang}\n${body}\n${FENCE}`;
export function formatReply(s) {
  const th = `THOUGHT: ${String(s.thought || 'Continuing.').split('\n')[0]}`;
  if (s.type === 'unparseable') return 'I will keep working on the goal now.';
  if (s.type === 'unknown') return `${th}\nACTION: ${s.tool}`;
  if (s.type === 'finish') return `${th}\nACTION: finish\nSUMMARY: ${s.summary || 'done'}`;
  const a = s.args || {}; const tool = s.tool;
  const head = `${th}\nACTION: ${tool}`;
  switch (tool) {
    case 'write_file': case 'append_file': return `${head}\nPATH: ${a.path}\n${fence(a.content ?? '')}`;
    case 'edit_file': return `${head}\nPATH: ${a.path}\nFIND:\n${fence(a.find ?? '')}\nREPLACE:\n${fence(a.replace ?? '')}`;
    case 'run_command': return `${head}\nCOMMAND: ${a.cmd}`;
    case 'run_python': return a.code != null ? `${head}\n${fence(a.code, 'python')}` : `${head}\nPATH: ${a.path}`;
    case 'read_file': return `${head}\nPATH: ${a.path}` + (a.offset && a.limit ? `\nLINES: ${a.offset}-${a.offset + a.limit - 1}` : '');
    case 'search_file': return `${head}\n${a.path ? `PATH: ${a.path}\n` : ''}QUERY: ${a.query}`;
    case 'task_done': return `${head}\nWHICH: ${a.which}`;
    case 'task_add': return `${head}\nTEXT: ${a.text}`;
    case 'git_diff': return `${head}${a.ref ? `\nREF: ${a.ref}` : ''}`;
    case 'git_log': return `${head}${a.n ? `\nN: ${a.n}` : ''}`;
    case 'git_commit': return `${head}\nMESSAGE: ${a.message}`;
    case 'git_undo': return `${head}${a.sha ? `\nSHA: ${a.sha}` : ''}`;
    case 'web_search': return `${head}\nQUERY: ${a.query}`;
    case 'web_fetch': return `${head}\nURL: ${a.url}`;
    case 'download_file': return `${head}\nURL: ${a.url}\nPATH: ${a.path}`;
    case 'spawn_subtask': case 'queue_task': return `${head}\nGOAL: ${a.goal}`;
    default: return a.path ? `${head}\nPATH: ${a.path}` : head;
  }
}
export const isLossy = (s) => Object.values(s.args || {}).some((v) => typeof v === 'string' && CUT.test(v));

/** replies (plan excluded) for a run whose history kept only the LAST `kept` model replies. */
export function rebuild(run, keptReplies) {
  const ms = modelSteps(run.steps);
  const missing = ms.length - keptReplies.length;
  if (missing < 0) return null;
  const rebuilt = ms.slice(0, missing);
  return { replies: [...rebuilt.map(formatReply), ...keptReplies], rebuilt: missing, lossy: rebuilt.filter(isLossy).length, modelSteps: ms.length };
}

// ── validation on runs that were never pruned: the mapping must reproduce the real replies' count and actions ──
if (process.argv[2] === '--validate') {
  const { readFileSync, readdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { parseActions } = await import('../../server/agentParse.js');
  const [, , , scenFile, runsDir] = process.argv;
  const runs = new Map(readdirSync(runsDir).filter((f) => f.endsWith('.json')).map((f) => { const r = JSON.parse(readFileSync(join(runsDir, f), 'utf8')); return [String(r.goal).trim(), r]; }));
  let n = 0, countOk = 0, actOk = 0, acts = 0, parseOk = 0, parsed = 0;
  const bad = [];
  for (const s of readFileSync(scenFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))) {
    if (!s.complete) continue;
    const r = runs.get(String(s.goal).trim()); if (!r) continue;
    n++;
    const real = s.replies.slice(1);            // drop the plan
    const ms = modelSteps(r.steps);
    if (ms.length === real.length) countOk++; else bad.push(`${s.id}: ${ms.length} model steps vs ${real.length} replies`);
    for (let k = 0; k < Math.min(ms.length, real.length); k++) {
      const want = (parseActions(real[k], undefined, 1)[0] || {}).tool || (/ACTION:\s*finish/i.test(real[k]) ? 'finish' : 'unparseable');
      const got = ms[k].type === 'tool' ? ms[k].tool : ms[k].type;
      acts++; if (want === got) actOk++; else if (bad.length < 12) bad.push(`${s.id} #${k + 1}: real ${want} vs rebuilt ${got}`);
      const re = formatReply(ms[k]); const p = parseActions(re, undefined, 1)[0];
      if (ms[k].type === 'tool' || ms[k].type === 'finish') { parsed++; if (p && p.tool === (ms[k].tool || 'finish')) parseOk++; }
    }
  }
  console.log(`unpruned runs checked ${n} | reply count matches ${countOk}/${n} | action matches ${actOk}/${acts} | rebuilt replies the parser reads back as the same tool ${parseOk}/${parsed}`);
  for (const b of bad.slice(0, 12)) console.log('  ' + b);
}
