/**
 * lessons.test.mjs - context-keyed lessons: recorded, scoped, retrieved on recurrence, guarding
 * before an edit, and surviving a restart. Module-level checks, then the real Hub with scripted
 * replies across TWO hub processes on ONE workspace.
 *
 *   node server/lessons.test.mjs
 *
 *   A. module      scoping (javascript lesson does not apply to python), signature matching,
 *                  generic lessons, dedupe with `seen`, status suspected/confirmed
 *   B. run 1       a failing edit_file on app.js followed by a working one records a CONFIRMED
 *                  lesson automatically; the model records a SUSPECTED lesson with DETECT
 *   C. restart     a NEW hub on the same workspace opens with the javascript lessons; a write
 *                  matching DETECT in javascript is refused ONCE (file untouched), the same
 *                  content in python is NOT refused; a recurring edit failure on app.js carries
 *                  the lesson, the same failure on util.py carries nothing
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const { scratch, startHub, freePorts } = await import('./testHarness.mjs');
const { recordLesson, retrieve, relevance, lessonsForOpening, errorSignature, currentLessons } = await import('./lessons.js');
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('=== A. module ===');
{
  const ws = mkdtempSync(join(tmpdir(), 'lessons-a-'));
  writeFileSync(join(ws, 'a.js'), '', 'utf8'); writeFileSync(join(ws, 'b.py'), '', 'utf8');
  const sigJs = errorSignature('ERROR: the FIND snippet was not found in app.js.');
  const l1 = recordLesson(ws, { context: { language: 'javascript', tool: 'edit_file', errorSignature: sigJs }, mistake: 'FIND copied with changed whitespace', fix: 'copy the line verbatim from read_file' });
  const l2 = recordLesson(ws, { context: { language: 'python', tool: 'write_file' }, mistake: 'tabs in a python file', fix: 'spaces only', status: 'confirmed' });
  const l3 = recordLesson(ws, { context: {}, mistake: 'finishing without running the checks', fix: 'run the checks first' });
  say(l1.status === 'suspected' && l2.status === 'confirmed', `statuses: model-proposed ${l1.status}, declared ${l2.status}`);
  say(relevance(l1, { language: 'python', tool: 'edit_file', errorSignature: sigJs }) === 0, 'a javascript lesson does not apply to a python context');
  say(relevance(l1, { language: 'javascript', tool: 'edit_file', errorSignature: sigJs }) > relevance(l1, { language: 'javascript', tool: 'edit_file' }), 'a matching error signature raises relevance');
  say(relevance(l1, { language: 'javascript', tool: 'edit_file', errorSignature: 'ERROR: something else entirely' }) === 0, 'a DIFFERENT signature in the same language/tool does not apply');
  const r = retrieve(ws, { language: 'javascript', tool: 'edit_file', errorSignature: sigJs });
  say(r.length === 2 && r[0].id === l1.id && r[1].id === l3.id, `retrieval: the specific lesson first, the generic one after (${r.map((x) => x.id === l1.id ? 'L1' : x.id === l3.id ? 'L3' : '?').join(',')})`);
  const again = recordLesson(ws, { context: { language: 'javascript', tool: 'edit_file', errorSignature: sigJs }, mistake: 'FIND copied with changed whitespace', fix: 'copy the line verbatim from read_file' });
  say(again.id === l1.id && again.seen === 2 && currentLessons(ws).length === 3, 'recording the same lesson again dedupes into one record with seen 2');
  const op = lessonsForOpening(ws);
  say(op.length === 3, `opening lessons for a js+py project include js, py and generic (${op.length})`);
  rmSync(join(ws, 'b.py'));
  say(lessonsForOpening(ws).every((l) => l.context.language !== 'python'), 'without any python file, the python lesson is not offered at the opening');
  rmSync(ws, { recursive: true, force: true });
}

// ── the hub, two processes on one workspace ──
const APP_OK = 'function tick(dt) {\n  return dt * 2;\n}\n';
const PLAN = '1. WHAT IT DOES - app\n2. FILES - app.js\n3. BUILD ORDER - edit\n4. HOW TO VERIFY - run';
const edit = (path, find, replace) => `THOUGHT: Editing.\nACTION: edit_file\nPATH: ${path}\nFIND:\n${find}\nREPLACE:\n${replace}`;
const write = (path, body, lang) => `THOUGHT: Writing.\nACTION: write_file\nPATH: ${path}\n\`\`\`${lang}\n${body}\n\`\`\``;
const LESSON = 'THOUGHT: That failed because I changed the whitespace.\nACTION: lesson\nLANGUAGE: javascript\nTOOL: write_file\nERROR: \nMISTAKE: left a TODO_PLACEHOLDER token in generated JavaScript, which the page then shipped\nFIX: fill every placeholder before writing the file\nDETECT: TODO_PLACEHOLDER';
const FINISH = 'THOUGHT: Done.\nACTION: finish\nTEXT:\nok';

const dir = scratch('lessons-hub');
const ws = join(dir, 'workspace');
mkdirSync(ws, { recursive: true });
writeFileSync(join(ws, 'app.js'), APP_OK, 'utf8');
writeFileSync(join(ws, 'util.py'), 'def f(x):\n    return x\n', 'utf8');

async function runOnce(label, replies, promptLog) {
  const [hubPort, fakePort] = await freePorts(2);
  const cfgDir = scratch(`lessons-${label}`, { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' });
  const rf = join(cfgDir, 'replies.json'); writeFileSync(rf, JSON.stringify(replies), 'utf8');
  const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', rf], { stdio: 'ignore', env: { ...process.env, FAKE_PROMPT_LOG: promptLog } });
  let hub = null;
  try {
    const started = await startHub(cfgDir, { port: hubPort, env: { AGENT_APPROVAL_MODE: 'build', AGENT_WORKSPACE: ws } });
    hub = started.hub;
    const { runId } = await started.api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Keep app.js working.', budgetSec: 120 }) });
    let run = null;
    for (let i = 0; i < 120; i++) { run = await started.api(`/agent/${runId}`).catch(() => null); if (run && run.status && run.status !== 'running' && !run.busy) break; await sleep(1000); }
    return run;
  } finally { try { hub && hub.kill('SIGKILL'); } catch {} try { fake.kill('SIGKILL'); } catch {} try { rmSync(cfgDir, { recursive: true, force: true }); } catch {} }
}
const tools = (run, name) => (run.steps || []).filter((s) => s.type === 'tool' && s.tool === name);
const stepsOf = (run, type) => (run.steps || []).filter((s) => s.type === type);

try {
  console.log('\n=== B. run 1: a failure then a success records a lesson; the model records another ===');
  const run1 = await runOnce('r1', [PLAN, edit('app.js', 'return dt *  2;', 'return dt * 3;'), edit('app.js', 'return dt * 2;', 'return dt * 3;'), LESSON, FINISH], join(dir, 'p1.jsonl'));
  const e1 = tools(run1, 'edit_file');
  say(e1.length === 2 && /^ERROR: the FIND snippet was not found/.test(String(e1[0].result || '')) && !/^ERROR/.test(String(e1[1].result || '')), 'first edit failed (FIND not found), second succeeded');
  const rec1 = stepsOf(run1, 'lesson_recorded');
  say(rec1.length === 1 && /confirmed/.test(rec1[0].text), `a CONFIRMED lesson was recorded automatically: ${rec1[0]?.text?.slice(0, 90)}`);
  const lt = tools(run1, 'lesson')[0];
  say(lt && /^OK: lesson L-/.test(String(lt.result || '')) && /suspected/.test(String(lt.result)) && /detect \/TODO_PLACEHOLDER\//.test(String(lt.result)), `the lesson tool recorded a SUSPECTED lesson with DETECT: ${String(lt?.result).slice(0, 80)}`);
  const all = currentLessons(ws);
  say(all.length === 2 && existsSync(join(ws, 'LESSONS.jsonl')), 'LESSONS.jsonl holds both, in the workspace (it survives a restart)');
  say(readFileSync(join(ws, 'app.js'), 'utf8').includes('dt * 3'), 'and the fix landed');

  console.log('\n=== C. restart: a NEW hub on the same workspace ===');
  const p2 = join(dir, 'p2.jsonl');
  const run2 = await runOnce('r2', [
    PLAN,
    write('app.js', 'function tick(dt) {\n  // TODO_PLACEHOLDER\n  return dt * 3;\n}', 'javascript'),      // javascript + DETECT -> refused once
    write('util.py', 'def f(x):\n    # TODO_PLACEHOLDER\n    return x\n', 'python'),                     // python -> not refused
    edit('app.js', 'return dt *  9;', 'return dt * 4;'),                                                 // recurring failure in js -> lesson recalled
    edit('util.py', 'return  y', 'return x'),                                                            // failure in python -> nothing recalled
    FINISH,
  ], p2);
  const reqs = existsSync(p2) ? readFileSync(p2, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  const opening = reqs[0]?.messages?.find((m) => /^LESSONS FROM EARLIER WORK/.test(String(m.content || '')));
  say(!!opening && /javascript/.test(opening.content) && /TODO_PLACEHOLDER|FIND snippet/.test(opening.content), 'the opening context of the NEW process carries the javascript lessons');
  const guards = stepsOf(run2, 'lesson_guard');
  const w = tools(run2, 'write_file');
  say(guards.length === 1 && guards[0].path === 'app.js', `the javascript write matching DETECT was refused once by the guard (${guards.length} guard step, ${guards[0]?.path})`);
  say(w[0] && /^REFUSED ONCE by lesson/.test(String(w[0].result || '')) && !readFileSync(join(ws, 'app.js'), 'utf8').includes('TODO_PLACEHOLDER'), 'the refused content never reached app.js');
  say(w[1] && !/^REFUSED/.test(String(w[1].result || '')) && readFileSync(join(ws, 'util.py'), 'utf8').includes('TODO_PLACEHOLDER'), 'the same content in python was NOT refused (the lesson is scoped to javascript)');
  const recalled = stepsOf(run2, 'lesson_recalled');
  const e2 = tools(run2, 'edit_file');
  say(recalled.length === 1 && /^ERROR/.test(String(e2[0].result || '')), 'the recurring FIND failure on app.js recalled the lesson (one recall step)');
  const jsFeedback = reqs.flatMap((r) => r.messages).map((m) => String(m.content || '')).find((c) => /TOOL RESULT \(edit_file\)[\s\S]*not found in app\.js[\s\S]*LESSONS THAT APPLY/.test(c));
  say(!!jsFeedback, 'and the lesson rode with that failing result to the model');
  const pyFeedback = reqs.flatMap((r) => r.messages).map((m) => String(m.content || '')).filter((c) => /TOOL RESULT \(edit_file\)[\s\S]*not found in util\.py/.test(c));
  say(pyFeedback.length > 0 && pyFeedback.every((c) => !/LESSONS THAT APPLY/.test(c)), 'the python failure carried NO javascript lesson');
} finally {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}
console.log(`\n  lessons: ${passed} passed, ${failed} failed -> ${failed ? 'LESSONS ARE NOT ESTABLISHED' : 'scoped, recalled on recurrence, guarding before an edit, surviving a restart'}`);
process.exit(failed ? 1 : 0);
