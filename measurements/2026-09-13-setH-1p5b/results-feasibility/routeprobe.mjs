// APPARATUS DEVELOPMENT, NOT THE EXPERIMENT. How do you ask a FIM model to INSERT at a point where
// the surrounding code is already complete?
//
// Condition B returned an empty snippet on every seed at site 1. The bytes show why, and it is not a
// model finding: the prompt was well-formed, the instruction and goal text were present, the body was
// visible - but prefix+suffix already formed a COMPLETE, VALID program. FIM is a continuation
// objective, so a zero-width hole between two finished statements carries no pressure to emit
// anything, and the model correctly stops. One seed echoed the instruction comment back instead.
//
// This is the same class of defect as the two already found: the route was wrong for the task. v2's
// insertion route worked precisely because its prefix ended MID-CONSTRUCT - "def between(" - which
// cannot be continued by stopping.
//
// Three candidate routes, on two sites of different character, with the same fixed seeds:
//
//   V1_comment_only   what B does now: instruction comment, then the hole.
//   V2_indent_primer  identical, plus the insertion indentation as a partial line. The prefix now
//                     ends mid-line, so stopping is not a valid continuation. Leaks no content -
//                     the indentation is already implied by the site.
//   V3_chat           /api/chat instead of infill: the file with an explicit marker at the insertion
//                     point, the goal text, the site intent, and "reply with only the lines to
//                     insert". Instruction-following rather than continuation.
//
// The route is chosen on evidence and the choice is recorded, rather than silently swapped.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SITES, locate } from './oraclesites.mjs';
import { regressionFor } from './regression.mjs';
import { probe60For } from './probes60.mjs';
import { checkContract } from './contractCheck.mjs';
import { deriveContract } from './contract.mjs';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const BASE = process.env.GATE_BASE || 'http://127.0.0.1:11434';
const MODEL = process.env.GATE_MODEL || 'qwen2.5-coder:1.5b';
const GOAL = Number(process.env.GOAL || 64);
const SITEIDX = (process.env.SITES_TO_TRY || '1,5').split(',').map(Number);
const SEEDS = (process.env.SEEDS || '1,2,3,4').split(',').map(Number);
const ROUTES = (process.env.ROUTES || 'V1_comment_only,V2_indent_primer,V3_chat').split(',');
const DECODE = { temperature: 0.7, top_p: 0.8, top_k: 20, repeat_penalty: 1.1, repeat_last_n: 64 };
const NPRED = Number(process.env.NPRED || 600);
const FENCE = String.fromCharCode(96, 96, 96);

const OUT = mkdtempSync(join(tmpdir(), 'routeprobe-'));
mkdirSync(join(OUT, 'replies'), { recursive: true });

const world = new Map();
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) world.set(f, readFileSync(p));
  }
}
const names = [...world.keys()].sort();
const freshWs = () => {
  const ws = mkdtempSync(join(tmpdir(), 'rpws-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  for (const f of names) writeFileSync(join(ws, f), world.get(f));
  return ws;
};

let seq = 0;
async function post(path, body, tag) {
  const id = String(++seq).padStart(3, '0') + '.' + tag;
  let j = {};
  let err = null;
  try {
    const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(900000) });
    j = await r.json();
  } catch (e) { err = String(e.message).slice(0, 100); }
  const text = path === '/api/chat' ? String((j.message && j.message.content) || '') : String(j.response || '');
  writeFileSync(join(OUT, 'replies', id + '.txt'), text, 'utf8');
  return { text, done_reason: j.done_reason || null, eval_count: j.eval_count === undefined ? null : j.eval_count, err, id };
}

const instr = (goalText, purpose, ind) =>
  ind + '# The code above and below is EXISTING and AUTHORITATIVE - do not repeat or rewrite it.\n'
  + ind + '# REQUESTED CHANGE: ' + goalText + '\n'
  + ind + '# AT THIS POINT WRITE ONLY THIS: ' + purpose + '\n';

// V3 extraction. Raw bytes are always preserved; a fenced block, if present, is unwrapped. Recorded
// separately so the effect of unwrapping is visible rather than hidden inside a pass rate.
function unfence(s) {
  const m = s.match(new RegExp(FENCE + '[a-zA-Z]*\\n([\\s\\S]*?)' + FENCE));
  return m ? { text: m[1], unfenced: true } : { text: s, unfenced: false };
}

console.log('  ROUTE PROBE (apparatus development, not the experiment)');
console.log('  goal ' + GOAL + '  sites [' + SITEIDX + ']  seeds [' + SEEDS + ']  routes [' + ROUTES + ']\n');

const spec = SITES[GOAL];
const goalText = GOALS[GOAL - 1];
const c = deriveContract(goalText);
const suite = regressionFor(spec.file);
const probe = probe60For(GOAL);
const rows = [];

for (const si of SITEIDX) {
  const site = spec.sites[si - 1];
  console.log('--- site ' + si + '  (indent ' + site.indent + ')  ' + site.purpose.slice(0, 74) + ' ---');
  for (const route of ROUTES) {
    for (const seed of SEEDS) {
      const ws = freshWs();
      const path = join(ws, spec.file);
      const src0 = readFileSync(path, 'utf8');
      const loc = locate(src0, site);
      const ind = ' '.repeat(site.indent);
      const tag = 'g' + GOAL + '.site' + si + '.' + route + '.s' + seed;

      let out;
      let raw;
      let unfenced = false;
      if (route === 'V3_chat') {
        const marked = loc.before + ind + '# >>> INSERT HERE <<<\n' + loc.after;
        const prompt = 'You are editing an existing Python file. The file below is AUTHORITATIVE and already works'
          + ' - do not rewrite it and do not repeat any of it.\n\n' + marked
          + '\n\nREQUESTED CHANGE: ' + goalText
          + '\nAT THE MARKER, WRITE ONLY THIS: ' + site.purpose
          + '\n\nReply with ONLY the lines to insert at the marker, indented to column ' + site.indent
          + '. No explanation.';
        out = await post('/api/chat', { model: MODEL, stream: false,
          options: Object.assign({}, DECODE, { num_predict: NPRED, seed }),
          messages: [{ role: 'user', content: prompt }] }, tag);
        raw = out.text;
        const u = unfence(raw);
        out.text = u.text;
        unfenced = u.unfenced;
      } else {
        const genPrefix = loc.before + instr(goalText, site.purpose, ind)
          + (route === 'V2_indent_primer' ? ind : '');
        out = await post('/api/generate', { model: MODEL, prompt: genPrefix, suffix: loc.after, stream: false,
          options: Object.assign({}, DECODE, { num_predict: NPRED, seed }) }, tag);
        raw = out.text;
        // V2 primed the line with the indentation, so the indentation belongs back on the snippet.
        if (route === 'V2_indent_primer') out.text = ind + out.text;
      }

      const snippet = out.text;
      const nonEmpty = !!snippet.trim();
      let loads = null;
      let reg = null;
      if (nonEmpty) {
        const cand = loc.before + snippet + (/\n$/.test(snippet) ? '' : '\n') + loc.after;
        writeFileSync(path, cand, 'utf8');
        const lo = checkContract(ws, spec.file, { ...c, moduleExports: [], members: [] });
        loads = lo.loads;
        reg = lo.loads ? suite(ws).pass : false;
      }
      const echoed = /EXISTING and AUTHORITATIVE|REQUESTED CHANGE|INSERT HERE/.test(snippet);
      rows.push({ goal: GOAL, site: si, route, seed, reply_id: out.id, raw_bytes: raw.length,
        snippet_bytes: snippet.length, eval_count: out.eval_count, done_reason: out.done_reason,
        unfenced, non_empty: nonEmpty, echoed_instruction: echoed, loads, old_regression: reg,
        head: snippet.slice(0, 96).replace(/\n/g, '\\n'), transport: out.err });
      writeFileSync(join(OUT, 'rows.json'), JSON.stringify(rows, null, 2), 'utf8');
      console.log('  [' + route.padEnd(17) + ' s' + seed + '] ' + String(snippet.length).padStart(4) + 'B'
        + '  nonempty=' + String(nonEmpty).padEnd(5) + ' echo=' + String(echoed).padEnd(5)
        + ' loads=' + String(loads).padEnd(5) + ' old=' + String(reg).padEnd(5)
        + '  ' + (nonEmpty ? snippet.slice(0, 58).replace(/\n/g, '\\n') : ''));
    }
  }
  console.log('');
}

console.log('===== WHICH ROUTE ACTUALLY PRODUCES A SNIPPET? =====');
for (const si of SITEIDX) {
  for (const route of ROUTES) {
    const r = rows.filter((x) => x.site === si && x.route === route);
    if (!r.length) continue;
    console.log('  site ' + si + '  ' + route.padEnd(18)
      + ' non-empty ' + r.filter((x) => x.non_empty).length + '/' + r.length
      + '   echoed instruction ' + r.filter((x) => x.echoed_instruction).length + '/' + r.length
      + '   loads ' + r.filter((x) => x.loads).length + '/' + r.length
      + '   old kept ' + r.filter((x) => x.old_regression).length + '/' + r.length);
  }
}
console.log('\n  RAW = ' + OUT);
