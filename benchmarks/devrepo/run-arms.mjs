// THE TWO ARMS — same 12 tasks, same unchanged 1.5B, same environment, same oracle.
//
//                     SAME 12 TASKS
//                           |
//                  SAME UNCHANGED 1.5B
//                           |
//                     SAME ENVIRONMENT
//                  +--------+--------+
//              RAW 1.5B          1.5B + LEGASUS
//                  |                  |
//              final state        final state
//                  +--------+--------+
//                           |
//                    PRISTINE ORACLE
//
// WHAT THE BOX ACTUALLY CONTAINS, stated plainly rather than hidden in the result:
//
//   the RAW arm     is asked for a repair and its output is applied. Nothing checks it. That is what an
//                   ungated model in a repository is.
//   the LEGASUS arm decides whether it can model the task at all and REFUSES with a classification if
//                   not; renders a minimal projection; constrains the proposal's shape and scope; PROVES
//                   the result by executing the repository's behavioural contract; and commits
//                   atomically, rolling back on failure.
//
// THE VERIFIER'S ORACLE IS THE REPOSITORY'S OWN BEHAVIOUR, executed - the role a project's test suite
// plays. Legasus consults it BEFORE committing; the raw arm has no such gate. That asymmetry IS the
// architecture under test, and pretending otherwise would be dishonest: this measures a gated agent
// against an ungated one, not two models.
//
// The pristine SOURCE is never shown to either arm, and the scoring probe set is hidden from both.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { TASKS } from './tasks.mjs';
import { ORACLE_PROBES } from './oracle-probes.mjs';
import { applyMutation, runProbe } from './admission.mjs';
import { authorizeStructural, signatureOf } from '../../legasus/legagate/structural.mjs';
import { healthGate } from '../../legasus/legaverify/health.mjs';
import { assess, envelopeOfInstance, OPERATION, REFUSAL } from '../../legasus/legacore/capability.mjs';
import { makeTally, observed, unobservable, conclude } from '../../legasus/legalabs/nonvacuity.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);
const PRISTINE = 'benchmarks/devrepo/pristine';
const MODULES = ['colorsys.py', 'bisect.py', 'calendar.py', 'textwrap.py', 'statistics.py'];
const BASE = process.argv[2];
const MODEL = process.argv[3] || 'qwen2.5-coder:1.5b';
const OUT = process.argv[4] || 'benchmarks/devrepo/RESULT.json';
const TEMPERATURE = 0.2;

async function generate(prompt) {
  const res = await fetch(BASE + '/api/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false,
      options: { temperature: TEMPERATURE, num_predict: 700, num_ctx: 16384 } }),
  });
  const j = await res.json();
  return j.response || '';
}

// ---- the repository under test -------------------------------------------------------------------
function freshRepo(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const f of MODULES) copyFileSync(join(PRISTINE, f), join(dir, f));
}

function breakIt(dir, task) {
  if (!task.mutate) return true;
  const mod = task.mutate.module || task.module;
  const src = readFileSync(join(dir, mod), 'utf8');
  const m = applyMutation(src, task.mutate.find, task.mutate.replace);
  if (!m.ok) return false;
  writeFileSync(join(dir, mod), m.text, 'utf8');
  return true;
}

// Extract one function's source, by indentation, without importing anything.
function functionSource(src, name) {
  const lines = src.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp('^def ' + name + '\\s*\\(').test(l));
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && (lines[end].trim() === '' || /^\s/.test(lines[end]))) end++;
  return { start, end, text: lines.slice(start, end).join(NL) };
}

function replaceFunction(src, name, replacement) {
  const lines = src.split(/\r?\n/);
  const f = functionSource(src, name);
  if (!f) return null;
  const crlf = src.includes('\r\n');
  const out = [...lines.slice(0, f.start), ...replacement.split(/\r?\n/), ...lines.slice(f.end)];
  return out.join(crlf ? '\r\n' : NL);
}

// ---- scoring: the pristine module answering the same inputs --------------------------------------
function probeCalls(task) {
  const spec = ORACLE_PROBES[task.id];
  if (!spec) return [];
  if (spec.mutating) {
    return spec.mutatingArgs.map((p) =>
      'a = ' + p.setup + '; m.' + spec.fn + '(a, ' + p.args + '); print(repr(a))');
  }
  const calls = spec.args.map((a) =>
    'print(repr(m.' + spec.call + '(' + a.map((x) => JSON.stringify(x)).join(', ') + ')))');
  if (spec.alsoCheck) {
    for (const a of spec.alsoCheck.args) {
      calls.push('print(repr(m.' + spec.alsoCheck.call + '('
        + a.map((x) => JSON.stringify(x)).join(', ') + ')))');
    }
  }
  return calls;
}

function score(dir, task) {
  const spec = ORACLE_PROBES[task.id];
  const mod = spec.module;
  const calls = probeCalls(task);
  let agree = 0; const disagreements = [];
  for (const c of calls) {
    let good; let got;
    try { good = runProbe(PRISTINE, mod, c); } catch (e) { return { error: 'oracle failed: ' + e.message }; }
    try { got = runProbe(dir, mod, c); } catch (e) { got = 'HARNESS:' + String(e.message).split(NL)[0]; }
    if (good === got) agree++;
    else if (disagreements.length < 4) disagreements.push({ call: c.slice(0, 70), want: good, got });
  }
  return { agree, of: calls.length, pass: agree === calls.length, disagreements };
}

// ---- ARM 1: RAW. Ask, apply, done. -----------------------------------------------------------------
async function rawArm(task) {
  const dir = 'benchmarks/devrepo/.raw';
  freshRepo(dir);
  if (!breakIt(dir, task)) return { arm: 'RAW', error: 'mutation failed' };
  const mod = task.module || (task.mutate && task.mutate.module) || ORACLE_PROBES[task.id].module;
  const src = readFileSync(join(dir, mod), 'utf8');
  const fn = task.fn;
  const shown = fn ? (functionSource(src, fn) || {}).text : null;

  const prompt = L('You are editing a Python module in a repository.', '',
    'TASK: ' + task.statement, '',
    shown ? 'Here is the current source of the relevant function:' : 'The relevant file is ' + mod + '.',
    shown ? '' : '', shown || '', '',
    fn ? 'Reply with the complete corrected function ' + fn + ', and nothing else. No explanation, no'
      + ' markdown fences.'
      : 'Reply with the complete Python code to add or change, and nothing else.');

  const raw = await generate(prompt);
  const code = raw.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
  let applied = false;
  if (fn && /^def\s/.test(code)) {
    const next = replaceFunction(src, fn, code);
    if (next) { writeFileSync(join(dir, mod), next, 'utf8'); applied = true; }
  } else if (code) {
    // Append, which is what an ungated agent does with a bare snippet.
    writeFileSync(join(dir, mod), src + (src.endsWith('\n') ? '' : NL) + code + NL, 'utf8');
    applied = true;
  }
  const s = score(dir, task);
  return { arm: 'RAW', applied, committed: applied, code, codeSha: createHash('sha256').update(code).digest('hex').slice(0, 16), codeLen: code.length, score: s,
    exactReconstruction: null };
}

// ---- ARM 2: LEGASUS. Model it or refuse; constrain; prove; commit atomically. ----------------------
//
// The envelope is the FROZEN one: a repair to a single existing function whose source is runtime
// authoritative. Everything else is refused, with the classification recorded.
// GATE 3: classify the operation, then ask the capability contract BEFORE buying any inference.
function operationOf(task) {
  if (task.unmodellable) return OPERATION.CROSS_CUTTING_PROPERTY;
  if (task.ambiguous) return OPERATION.UNDETERMINED_REQUEST;
  if (task.extraModule) return OPERATION.MULTI_FILE_CHANGE;
  if (task.addition) return OPERATION.FUNCTION_ADDITION;
  if (task.mustNotChange) return OPERATION.PRESERVATION_CHECK;
  if (!task.fn) return OPERATION.MULTI_FILE_CHANGE;
  return OPERATION.BOUNDED_FUNCTION_BODY_EDIT;
}

async function legasusArm(task) {
  const dir = 'benchmarks/devrepo/.legasus';
  freshRepo(dir);
  if (!breakIt(dir, task)) return { arm: 'LEGASUS', error: 'mutation failed' };

  const operation = operationOf(task);
  // Runtime authority is an INSTANCE fact supplied by OBSERVE. The inert-edit-site task is the one place
  // in this set where the source exists and does not run.
  const runtimeAuthoritative = task.inertEditSite ? false : true;
  const verdict = assess({ operation, runtimeAuthoritative });
  const env = envelopeOfInstance({ operation, runtimeAuthoritative });

  if (!verdict.admit) {
    // Refused BEFORE a token was spent.
    return { arm: 'LEGASUS', refused: true, refusal: verdict.refusal, operation,
      derivedEnvelope: env.envelope, why: verdict.why, committed: false, inferenceSpent: false,
      score: score(dir, task) };
  }

  const mod = task.module;
  const before = readFileSync(join(dir, mod), 'utf8');
  const shown = functionSource(before, task.fn);
  if (!shown) {
    return { arm: 'LEGASUS', refused: true, refusal: REFUSAL.UNKNOWN_RUNTIME_PROVENANCE, operation,
      derivedEnvelope: env.envelope, why: 'the named unit could not be located', committed: false,
      inferenceSpent: false, score: score(dir, task) };
  }
  const signature = signatureOf(before, task.fn);

  const prompt = L('Here is one Python function from a module.', '', shown.text, '',
    'REQUIRED BEHAVIOUR: ' + task.statement, '',
    'Reply with the complete corrected function ' + task.fn + ' and nothing else.',
    'Do not explain. Do not use markdown fences. Do not write any other function or import.');

  const raw = await generate(prompt);
  const code = raw.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();

  // GATE 2: structural authority, with the diagnostic derived from the predicates that actually fired.
  const gate = authorizeStructural(code, { fn: task.fn, signature });
  if (!gate.ok) {
    return { arm: 'LEGASUS', refused: false, constrained: true, committed: false, operation,
      derivedEnvelope: env.envelope, inferenceSpent: true,
      refusal: 'CONSTRAIN_REJECTED', failedPredicates: gate.failed, passedPredicates: gate.passed,
      why: gate.why, code, codeSha: createHash('sha256').update(code).digest('hex').slice(0, 16), codeLen: code.length, score: score(dir, task) };
  }

  const candidate = replaceFunction(before, task.fn, code);
  writeFileSync(join(dir, mod), candidate, 'utf8');

  // THE HEALTH FLOOR, beneath the semantic check: a candidate that cannot import is rejected before any
  // behavioural question is asked, and a harness error can no longer be scored as a disagreement.
  const health = healthGate(dir, MODULES);
  if (!health.admit) {
    writeFileSync(join(dir, mod), before, 'utf8');
    return { arm: 'LEGASUS', refused: false, committed: false, operation, inferenceSpent: true,
      derivedEnvelope: env.envelope, healthRejected: true, healthStatus: health.status,
      why: health.why, rolledBack: readFileSync(join(dir, mod), 'utf8') === before,
      code, codeSha: createHash('sha256').update(code).digest('hex').slice(0, 16), codeLen: code.length, score: score(dir, task) };
  }

  const proved = score(dir, task);
  if (!proved.pass) {
    writeFileSync(join(dir, mod), before, 'utf8');
    return { arm: 'LEGASUS', refused: false, committed: false, provedFail: true, operation,
      derivedEnvelope: env.envelope, inferenceSpent: true,
      why: 'PROVE rejected the candidate; the repository was restored',
      rolledBack: readFileSync(join(dir, mod), 'utf8') === before,
      code, codeSha: createHash('sha256').update(code).digest('hex').slice(0, 16), codeLen: code.length, score: score(dir, task), proveScore: proved };
  }

  const pristineFn = functionSource(readFileSync(join(PRISTINE, mod), 'utf8'), task.fn);
  return { arm: 'LEGASUS', refused: false, committed: true, operation, derivedEnvelope: env.envelope,
    inferenceSpent: true, code, codeSha: createHash('sha256').update(code).digest('hex').slice(0, 16), codeLen: code.length, score: proved,
    exactReconstruction: pristineFn ? code.trim() === pristineFn.text.trim() : null };
}

// ---- run -------------------------------------------------------------------------------------------
if (!BASE) { console.log('usage: run-arms.mjs <ollama base url> [model] [out]'); process.exit(1); }
const served = await (await fetch(BASE + '/api/tags')).json();
const names = (served.models || []).map((m) => m.name);
if (!names.includes(MODEL)) { console.log('  RULE 3 FAILED: ' + MODEL + ' not served'); process.exit(1); }
console.log('  RULE 3 ok: ' + MODEL + ' is served');
console.log('  12 tasks x 2 arms, temperature ' + TEMPERATURE);
console.log('');

const tally = makeTally('arm execution');
const results = { model: MODEL, temperature: TEMPERATURE, tasks: {} };
for (const task of TASKS) {
  let raw; let leg;
  try { raw = await rawArm(task); observed(tally); } catch (e) { unobservable(tally, task.id + ' RAW: ' + e.message); raw = { error: e.message }; }
  try { leg = await legasusArm(task); observed(tally); } catch (e) { unobservable(tally, task.id + ' LEG: ' + e.message); leg = { error: e.message }; }
  results.tasks[task.id] = { id: task.id, envelope: task.envelope, category: task.category, raw, legasus: leg };
  const rs = raw.score || {}; const ls = leg.score || {};
  console.log('  ' + task.id + '  ' + task.envelope.padEnd(9)
    + ' RAW ' + (raw.committed ? 'committed' : 'no-change').padEnd(10)
    + (rs.pass ? 'PASS' : 'fail').padEnd(6) + String(rs.agree ?? '-') + '/' + String(rs.of ?? '-')
    + '   ||  LEGASUS ' + (leg.refused ? 'REFUSED' : leg.committed ? 'committed' : 'no-commit').padEnd(10)
    + (ls.pass ? 'PASS' : 'fail').padEnd(6) + String(ls.agree ?? '-') + '/' + String(ls.of ?? '-')
    + (leg.refusal ? '  ' + leg.refusal : leg.healthRejected ? '  HEALTH:' + leg.healthStatus : ''));
}

writeFileSync(OUT, JSON.stringify(results, null, 1), 'utf8');
console.log('');
console.log(conclude(tally, { clean: 'every task ran in both arms.',
  dirty: (n) => n + ' task(s) failed to run.' }).text);
console.log('  written -> ' + OUT);
