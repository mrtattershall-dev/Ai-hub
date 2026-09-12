/**
 * substitutionHonesty.test.mjs - the loop-break substitution must not present a fragment as a whole file.
 *
 *   node server/substitutionHonesty.test.mjs
 *
 * Audited 2026-09-11. When an orientation tool is called twice with the same arguments and returns the same answer,
 * the hub breaks the loop by replacing the second result with the goal's file:
 *
 *     const src = readFileSync(join(WORKSPACE, target), 'utf8').slice(0, 6000);
 *     substituted = `TOOL RESULT (read_file ${target}):\n\`\`\`\n${src}\n\`\`\`\n\n`
 *       + `(You called ${tool} twice ... so it was replaced with the contents of ${target}. You now have what you
 *          need — do the work.)`;
 *
 * Three things wrong with that, in order of damage:
 *   1. The content is cut at 6,000 characters with NO notice, no line numbers, and a label claiming it is a read_file
 *      result - a tool the model never called. So a file over 6k is silently beheaded and presented as complete, and
 *      the very next sentence says "You now have what you need - do the work." This fires exactly when the hub has
 *      decided the model is confused, i.e. when ground truth matters most. If the model then rewrites the file from
 *      what it was shown, everything past 6k is destroyed - and the destructive-write refusal only protects named
 *      definitions and exports in .py/.cjs/.js/.mjs, not statements, data or any other file type.
 *   2. `target` is read with join(WORKSPACE, target) rather than safePath, and comes from a regex over run.goal - so a
 *      goal naming ../../hub.json would be read from outside the workspace into the model's context. Goals are usually
 *      human-authored, but queue_task and spawn_subtask let a model author its own.
 *   3. It impersonates a tool result. Everything the hub says about itself should be distinguishable from what a tool
 *      returned, or the transcript stops being evidence.
 *
 * Cases marked "(known)" are expected to fail until this is fixed.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const list = (t) => `THOUGHT: ${t}\nACTION: list_dir\nPATH: .`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';
let passed = 0, failed = 0, known = 0;
const openCases = [];
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { if (/\(known\)/.test(n)) { known++; openCases.push(n.replace(/^\(known\) /, '')); console.log(`  KNOWN ${n}\n        ${e.message.split('\n')[0]}`); } else { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } }
};
console.log('\nthe loop-break substitution tells the truth about what it shows\n');

// The mock keeps every message the hub adds after the model speaks, which is where the substitution lands.
const [mockPort, hubPort] = await freePorts(2);
const rig = { script: [], news: [], log: [] };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'subst', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    const planner = m.length === 2;
    if (!planner) { const la = m.map((x) => x.role).lastIndexOf('assistant'); rig.news.push(m.slice(la + 1).map((x) => String(x.content || '')).join('\n---\n')); }
    const text = planner ? 'Plan: look around.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'subst', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'subst-'));
const ws = join(dir, 'workspace');
mkdirSync(ws, { recursive: true });
// A file comfortably over the 6,000-char slice, with a recognisable last line.
const LINES = 300;
const body = Array.from({ length: LINES }, (_, i) => `function handler${i}(event) { return process${i}(event); }`);
body.push('module.exports = { LAST_MARKER: true };');
writeFileSync(join(ws, 'big_module.js'), body.join('\n'), 'utf8');

writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'subst' } }, history: [], settings: {} }), 'utf8');
const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
    AGENT_MAX_STEPS: '14', AGENT_MAX_MINUTES: '4', MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', (d) => rig.log.push(String(d))); hub.stderr.on('data', (d) => rig.log.push(String(d)));
const API = `http://127.0.0.1:${hubPort}/api`;
let up = false; for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
if (!up) { console.error('  FAIL  the hub did not start\n' + rig.log.join('').slice(-600)); hub.kill(); mock.close(); process.exit(1); }

// Two identical list_dir calls: same tool, same args, same answer - which is what triggers the substitution. Different
// THOUGHT text so the reply-based stuck-loop guard stays out of it.
rig.script = [list('looking around'), list('looking again to be sure'), FINISH];
const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Add a clear() function to big_module.js.' }) });
let run = null; const deadline = Date.now() + 4 * 60000;
while (Date.now() < deadline) { run = await api('/agent/' + st.runId).catch(() => null); if (run && TERMINAL.includes(run.status) && run.busy !== true) break; await sleep(300); }
// Find the injected message by something the FIX cannot change: it names the target file and wraps its content in a
// fence. Keying on the old sentence ("it was replaced with the contents of") broke the moment the fix reworded it -
// the premise then failed on an empty string and both honesty verdicts became meaningless, one of them passing
// vacuously. A matcher that goes stale when the code improves is a test that stops testing.
const FENCE3 = '`'.repeat(3);
const injected = rig.news.find((n) => n.includes('big_module.js') && n.includes(FENCE3)) || '';
const noteText = (run?.steps || []).map((s) => String(s.text || '')).join('\n');

// This premise is load-bearing: when the substitution does not fire, BOTH assertions below become meaningless - one
// passes vacuously (there is no injected text to impersonate anything) and the other fails on an empty string. That is
// exactly what happened first time, and it uncovered a regression rather than a test bug: the repeated-call notice was
// appended to `result` upstream, the substitution keyed its duplicate signature on `result`, so the signatures differed
// and the mechanical loop-break had been unreachable since that notice was merged.
await test('the premise: the substitution actually fired on the repeated call', () => {
  assert.ok((run?.escalations || 0) >= 1,
    `escalations is ${run?.escalations} - the substitution never ran, so nothing below is being tested. Steps: ` + noteText.slice(0, 200));
  assert.ok(injected, 'no injected text found in what the model was sent');
  assert.match(noteText, /substituted the contents of big_module\.js/, noteText.slice(0, 200));
});
await test('(known) a file cut short is not presented as the whole file', () => {
  // Accept EITHER the whole file, OR an honest account of what was left out. The measured honest form is
  // "(lines 1-102 of 301)" plus "… 199 more line(s) below … you do NOT have the whole file" - so the matcher keys on a
  // line-range header or a more-lines notice. An earlier version of this assertion looked for the words
  // "trimmed/truncated/of N characters" and went stale the moment the fix worded it in LINES, which made a working fix
  // read as a live bug. Third stale matcher in this file; they cost more than they save when written from memory.
  const complete = injected.includes('LAST_MARKER');
  const announced = /\(lines \d+-\d+ of \d+\)/.test(injected) || /more line\(s\) below/.test(injected);
  assert.ok(complete || announced,
    'the content is cut with no account of what is missing - and the model is told to get on with the work');
  if (!complete) {
    assert.match(injected, /do not rewrite it from this|read_file .* OFFSET/,
      'it says the file is partial but not how to get the rest, which is the half that stops a rewrite-from-fragment');
  }
});
await test('(known) and it is not labelled as a tool result the model never asked for', () => {
  assert.doesNotMatch(injected, /^TOOL RESULT \(read_file /m,
    'the hub is impersonating a read_file result the model never called');
});

hub.kill(); mock.close();
// Both were red when this file was written and both are fixed: the substitution now shows numbered lines with an
// explicit line-range header and a "you do NOT have the whole file" notice pointing at read_file with an OFFSET, and it
// no longer labels itself as a read_file result the model never called. Getting here also uncovered that the mechanical
// substitution had been UNREACHABLE since the repeat-notice merge - the premise above is the guard against that
// returning. The "(known)" labels stay on the case names as a record of what each caught.
const KNOWN_EXPECTED = 0;
console.log(`\n${passed} passed, ${failed} failed, ${known} known-open`);
console.log(`KNOWN-OPEN: ${known} of ${KNOWN_EXPECTED} expected`);
if (openCases.length) console.log('  still open: ' + openCases.join(' | '));
if (known !== KNOWN_EXPECTED) {
  console.error(`  FAIL  known-open count changed: ${known}, expected ${KNOWN_EXPECTED}`
    + (known > KNOWN_EXPECTED ? ' - a NEW failure is hiding behind the "(known)" label'
      : ' - a "(known)" case now PASSES; fix the expectation and the header, or drop the label'));
  failed++;
}
process.exit(failed ? 1 : 0);
