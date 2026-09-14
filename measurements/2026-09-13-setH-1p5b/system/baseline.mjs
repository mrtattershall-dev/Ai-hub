// CLEAN BASELINE: full protocol vs content-only, 20 goals, paired, under a contract system we trust.
//
// Everything upstream of this run was repaired first, and nothing else is being changed:
//   * typed ownership survives derivation (moduleExports vs members)
//   * the PROMPT rendering no longer teaches the wrong interface - the old one said
//     "it must export: Cache, delete, clear" and the model wrote `function delete(key)`, a
//     SyntaxError on a reserved word
//   * module exports and class members are checked as separate obligations, each with its own
//     rejection kind, so a repair gate can later be typed on the reason
//   * known-good AND known-bad fixtures exist and pass 15/15
//   * the contaminated historical conversion numbers are quarantined in the log, not rewritten
//
// WHY A FULL RERUN RATHER THAN A RESCORE: the corrected prompt is part of the TREATMENT, not just
// the scorer. The old apparatus changed what the model produced - three artifacts per run carry
// damage it induced, and two goals were scored PASS while being wrong, because the prompt and the
// checker agreed with each other and both disagreed with the goal. Fresh samples are the only clean
// answer.
//
// ORDER OF RECORDING, frozen per trial before any aggregate is computed:
//     raw reply -> body present -> parser accepts -> bytes written -> contract pass / rejection kind
//
// This run has ONE job: does removing orchestration increase REACH under a trusted contract, and
// what does correctness look like among artifacts actually produced. No repair. No extra cells.
import { deriveContract, renderForPrompt, renderContract } from './contract.mjs';
import { checkContract } from './contractCheck.mjs';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = 'C:/Users/tatte/Projects/ai-coding-hub-indent';
const BASE = process.env.GATE_BASE || 'http://127.0.0.1:11434';
const MODEL = process.env.GATE_MODEL || 'qwen2.5-coder:1.5b';
const NG = Number(process.env.NG || 20);
const F = String.fromCharCode(96, 96, 96);
const GOALS = JSON.parse(readFileSync(REPO + '/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const DECODE = { temperature: 0.7, top_p: 0.8, top_k: 20, repeat_penalty: 1.1, repeat_last_n: 64, num_predict: 2500 };
const TAG = { js: 'javascript', py: 'python', web: 'html', md: 'markdown' };
const REAL_TOOLS = new Set(['list_dir', 'read_file', 'search_file', 'outline_file', 'write_file',
  'append_file', 'edit_file', 'test_web', 'web_search', 'web_fetch', 'git_diff', 'git_log',
  'remember', 'recall', 'task_list', 'task_add', 'task_done', 'run_cmd', 'git_commit', 'finish']);

const RAW = mkdtempSync(join(tmpdir(), 'baseline-'));

const ask = async (prompt) => {
  const r = await fetch(BASE + '/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, stream: false, options: DECODE, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(900000),
  });
  const j = await r.json();
  return String((j && j.message && j.message.content) || '');
};

const extractBody = (reply) => {
  const m = reply.match(new RegExp(F + '[a-zA-Z]*\\n([\\s\\S]*?)' + F));
  return m ? m[1] : '';
};

// Both cells state the SAME contract in the SAME words. Only the orchestration differs.
const buildPrompt = (goal, c, cell) => {
  const req = renderForPrompt(c);
  const head = goal + '\n\nWrite the WHOLE file. It must load without errors.' + (req ? ' ' + req : '');
  if (cell === 'C') {
    return head
      + '\n\nThe file is ' + c.lead + '. It will be written for you.'
      + '\n\nReply with the file contents in one ' + TAG[c.lang] + ' code block and nothing else:\n\n'
      + F + (TAG[c.lang] || '') + '\n<the complete file>\n' + F;
  }
  return head
    + '\n\nReply with EXACTLY ONE action in this shape and nothing else:\n\n'
    + 'THOUGHT: <one line>\nACTION: write_file\nPATH: ' + c.lead + '\n'
    + F + (TAG[c.lang] || '') + '\n<the complete file>\n' + F;
};

const CELLS = (process.env.CELLS || 'A,C').split(',');
const out = {};

for (const cell of CELLS) {
  const ws = mkdtempSync(join(tmpdir(), 'base-' + cell + '-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  const dir = join(RAW, cell);
  mkdirSync(dir, { recursive: true });
  const rows = [];

  for (let i = 0; i < NG; i++) {
    const c = deriveContract(GOALS[i]);
    const prompt = buildPrompt(GOALS[i], c, cell);
    let reply = '';
    let err = '';
    try { reply = await ask(prompt); } catch (e) { err = String((e && e.message) || e); }

    // FREEZE THE RECORD BEFORE SCORING ANYTHING.
    writeFileSync(join(dir, 'g' + String(i + 1).padStart(2, '0') + '.txt'),
      '### CELL ' + cell + ' GOAL ' + (i + 1) + ' lead=' + c.lead
      + '\n### CONTRACT\n' + renderContract(c)
      + '\n### CONTRACT JSON\n' + JSON.stringify({ moduleExports: c.moduleExports, members: c.members, domIds: c.domIds, domClasses: c.domClasses })
      + (err ? '\n### ERROR ' + err : '')
      + '\n### PROMPT\n' + prompt + '\n### REPLY (' + reply.length + ' chars)\n' + reply, 'utf8');

    if (err) { rows.push({ goal: i + 1, lead: c.lead, body: false, parser: false, written: false, pass: false, kinds: ['timeout'], msg: err.slice(0, 60), len: 0 }); continue; }

    const body = extractBody(reply);
    const hasBody = body.trim().length >= 20;
    const tool = (reply.match(/ACTION:\s*([A-Za-z_$][\w$]*)/) || [])[1] || '';
    const named = (reply.match(/PATH:\s*(\S+)/) || [])[1] || '';
    const parser = cell === 'C' ? hasBody : (hasBody && REAL_TOOLS.has(tool) && named === c.lead);

    let written = false;
    let pass = false;
    let kinds = [];
    let msg = '';
    if (hasBody) {
      writeFileSync(join(ws, c.lead), body.replace(/^\uFEFF/, ''), 'utf8');
      written = existsSync(join(ws, c.lead));
      const r = checkContract(ws, c.lead, c);
      pass = r.ok;
      kinds = r.reasons.map((x) => x.kind);
      msg = r.msg || '';
      writeFileSync(join(dir, 'g' + String(i + 1).padStart(2, '0') + '.bytes'), body, 'utf8');
    } else {
      kinds = ['no_body'];
      msg = reply.length + ' char reply';
      if (cell !== 'C' && tool && !REAL_TOOLS.has(tool)) { kinds.push('tool_invented'); msg += ', tool "' + tool + '"'; }
    }
    rows.push({ goal: i + 1, lead: c.lead, body: hasBody, parser, written, pass, kinds, msg, len: reply.length });
  }

  out[cell] = rows;
  writeFileSync(join(RAW, cell + '.json'), JSON.stringify(rows, null, 2), 'utf8');
  const n = (k) => rows.filter((r) => r[k]).length;
  console.log('\n=== CELL ' + cell + ' (' + MODEL + ') ===');
  rows.forEach((r) => console.log('  [' + String(r.goal).padStart(2) + '] ' + r.lead.padEnd(16)
    + ' body ' + (r.body ? 'Y' : '.') + '  parser ' + (r.parser ? 'Y' : '.') + '  ' + (r.pass ? 'PASS' : 'fail')
    + '  ' + (r.pass ? '' : r.kinds.join(',') + ' ' + r.msg.slice(0, 78))));
  console.log('  REACH (body produced) ' + n('body') + '/' + NG
    + '   parser accepts ' + n('parser') + '/' + NG
    + '   CONTRACT PASS ' + n('pass') + '/' + NG);
  console.log('  workspace ' + ws);
}

// ---- REACH, reported on its own.
const nCr = (n, k) => { let r = 1; for (let j = 0; j < k; j++) r = (r * (n - j)) / (j + 1); return r; };
const mcnemar = (b, c) => { const d = b + c; if (!d) return NaN; const lo = Math.min(b, c); let t = 0; for (let j = 0; j <= lo; j++) t += nCr(d, j) * Math.pow(0.5, d); return Math.min(1, 2 * t); };
const pairOn = (key, label) => {
  if (!out.A || !out.C) return;
  let b = 0; let c = 0; let both = 0; let neither = 0; const r = []; const l = [];
  for (let i = 0; i < NG; i++) {
    const x = out.A[i][key]; const y = out.C[i][key];
    if (x && y) both++; else if (!x && !y) neither++; else if (y) { b++; r.push(i + 1); } else { c++; l.push(i + 1); }
  }
  console.log('\n  ' + label);
  console.log('    A ' + out.A.filter((z) => z[key]).length + '/' + NG + '   C ' + out.C.filter((z) => z[key]).length + '/' + NG);
  console.log('    both ' + both + '  neither ' + neither + '  discordant ' + (b + c)
    + '  (C rescued [' + (r.join(',') || 'none') + '], broke [' + (l.join(',') || 'none') + '])');
  const p = mcnemar(b, c);
  console.log('    exact McNemar p = ' + (Number.isNaN(p) ? 'n/a - no discordant pairs' : p.toFixed(4))
    + (!Number.isNaN(p) && p < 0.05 ? '   SIGNIFICANT' : ''));
};

console.log('\n===== REACH, measured independently of correctness =====');
pairOn('body', 'endpoint = a code body was produced at all');

console.log('\n===== CONVERSION, on the COMMON SUPPORT only =====');
console.log('  Restricted to goals where BOTH cells produced a body, so the two columns describe the');
console.log('  SAME goals. Comparing differently-selected denominators is what we are not doing.');
if (out.A && out.C) {
  const common = [];
  for (let i = 0; i < NG; i++) if (out.A[i].body && out.C[i].body) common.push(i);
  let b = 0; let c = 0; let both = 0; let neither = 0;
  console.log('\n  common support n=' + common.length + '  [' + common.map((i) => i + 1).join(',') + ']\n');
  for (const i of common) {
    const x = out.A[i].pass; const y = out.C[i].pass;
    if (x && y) both++; else if (!x && !y) neither++; else if (y) b++; else c++;
    console.log('    [' + String(i + 1).padStart(2) + '] A ' + (x ? 'pass' : 'FAIL') + '   C ' + (y ? 'pass' : 'FAIL')
      + '    ' + (y ? (x ? '' : out.A[i].kinds.join(',')) : out.C[i].kinds.join(',')));
  }
  console.log('\n    A ' + common.filter((i) => out.A[i].pass).length + '/' + common.length
    + '   C ' + common.filter((i) => out.C[i].pass).length + '/' + common.length);
  console.log('    both ' + both + '  neither ' + neither + '  discordant ' + (b + c) + ' (C rescued ' + b + ', broke ' + c + ')');
  const p = mcnemar(b, c);
  console.log('    exact McNemar p = ' + (Number.isNaN(p) ? 'n/a - no discordant pairs' : p.toFixed(4)));
  console.log('\n    A null here is NO DIFFERENCE DETECTED, never equivalence, at this N.');
}

// ---- Rejection kinds, so the residual has a shape rather than a count.
console.log('\n===== REJECTION KINDS (what the residual is made of) =====');
for (const cell of CELLS) {
  const tally = {};
  for (const r of out[cell]) if (!r.pass) for (const k of r.kinds) tally[k] = (tally[k] || 0) + 1;
  console.log('  ' + cell + '  ' + (Object.entries(tally).map(([k, v]) => k + ' ' + v).join('   ') || '(no failures)'));
}
console.log('\n  RAW = ' + RAW);
