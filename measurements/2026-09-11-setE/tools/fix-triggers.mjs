// fix-triggers.mjs <runsDir> <goals.json> : how often each set-E hub fix (f-fixes) had its trigger in a recorded run.
// Reads the run files + full transcripts the set-E harness kept (runs/<label>/runs). Counts, per fix:
//   stale      goals whose per-call TASK LEDGER carried a leftover naming a file the goal does not name, and
//              task_done calls that closed a LEFT OVER task (the model acting on another goal's work)
//   verify     verify_project results that ran a different language/file than the goal's own code
//   noop       edit_file calls with FIND identical to REPLACE (answered "OK: edited" before the fix)
//   shadow     run results with "is not a function" / "object is not callable" (candidates for the hint)
//   conn       runs paused by a dropped model connection
//   repeat / rollback   repeat-guard stops, and end-of-run rollbacks (for context)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const [runsDir, goalsFile] = process.argv.slice(2);
const goals = JSON.parse(readFileSync(goalsFile, 'utf8'));
const FILE_RE = /[\w./-]+\.(?:js|mjs|cjs|py|html?|md|json)\b/gi;
const files = (t) => [...new Set((String(t || '').match(FILE_RE) || []).map((f) => f.toLowerCase()))];
const runs = readdirSync(runsDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(runsDir, f), 'utf8')))
  .sort((a, b) => (typeof a.createdAt === 'number' ? a.createdAt : Date.parse(a.createdAt)) - (typeof b.createdAt === 'number' ? b.createdAt : Date.parse(b.createdAt)));
const c = { goals: runs.length, staleGoals: 0, staleTurns: 0, closedLeftover: 0, verifyWrong: 0, verifyCalls: 0, noop: 0, shadowCand: 0, conn: 0, repeat: 0, rollback: 0 };
const ex = { stale: [], verify: [], noop: [], shadow: [], closed: [] };
for (const r of runs) {
  const g = goals.indexOf(r.goal) + 1;
  const want = new Set(files(r.goal));
  const tf = join(runsDir, `${r.id}.transcript.jsonl`);
  const turns = existsSync(tf) ? readFileSync(tf, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((x) => x.kind === 'turn') : [];
  let staleHere = 0;
  for (const t of turns) {
    const led = (t.sent || []).map((m) => String(m.content || '')).find((s) => s.startsWith('TASK LEDGER')) || '';
    const foreign = led.split('\n').filter((l) => /left over from earlier work/.test(l) && files(l).length && !files(l).some((f) => want.has(f)));
    if (foreign.length) { staleHere++; if (ex.stale.length < 3 && staleHere === 1) ex.stale.push(`g${g}: ${foreign[0].trim().slice(0, 110)}`); }
  }
  if (staleHere) { c.staleGoals++; c.staleTurns += staleHere; }
  const codeWanted = [...want].filter((f) => /\.(py|c?js|mjs)$/.test(f));
  for (const s of r.steps || []) {
    const res = String(s.result || '');
    if (s.type === 'tool' && s.tool === 'task_done' && /LEFT OVER from earlier work/.test(res)) { c.closedLeftover++; if (ex.closed.length < 3) ex.closed.push(`g${g}: ${res.slice(4, 100)}`); }
    if (s.type === 'tool' && s.tool === 'verify_project') {
      c.verifyCalls++;
      const ran = (res.match(/`(node|python) ([^`\s]+)`/) || []);
      if (ran[2] && codeWanted.length && !codeWanted.includes(ran[2].toLowerCase())) { c.verifyWrong++; if (ex.verify.length < 3) ex.verify.push(`g${g} (goal files ${codeWanted.join(',')}): ran ${ran[1]} ${ran[2]}`); }
    }
    if (s.type === 'tool' && s.tool === 'edit_file' && s.args && typeof s.args.find === 'string' && s.args.find === s.args.replace) { c.noop++; if (ex.noop.length < 3) ex.noop.push(`g${g}: ${s.args.path}`); }
    if (s.type === 'tool' && /run_(command|python)/.test(s.tool || '') && /is not a function|object is not callable/.test(res)) { c.shadowCand++; if (ex.shadow.length < 4) ex.shadow.push(`g${g}: ${(res.match(/TypeError: [^\n]{0,80}/) || [''])[0]}`); }
    if (s.type === 'error' && /Run paused/.test(String(s.text)) && /stream failed|Premature close|terminated|ECONNRESET/.test(String(s.text))) c.conn++;
    if (s.type === 'error' && /same response/.test(String(s.text))) c.repeat++;
    if (s.type === 'note' && /did not parse at the end of the run/.test(String(s.text))) c.rollback++;
  }
}
console.log(JSON.stringify(c));
for (const [k, v] of Object.entries(ex)) for (const x of v) console.log(`  ${k}: ${x}`);
