// INSTRUMENT AUDIT: does every route actually TELL THE MODEL WHAT TO DO?
//
// The v3 behavioural route sent a prompt that was byte-identical for goals 64 and 74, because
// replaceBehaviour passes only (prefix, suffix) and both goals target the same function. That made
// passing both arithmetically impossible, and it was found only by dumping bytes after the fact.
//
// This audit makes the property checkable for EVERY route and EVERY goal, without spending a single
// model token, by recording the requests at the wire. A stub ollama is started on a free port, both
// arms are pointed at it with GATE_BASE, and every /api/chat and /api/generate body is captured
// verbatim. No harness logic is duplicated, so the audit cannot disagree with the real thing.
//
// The stub returns a syntactically harmless reply. Outcomes are therefore meaningless and are not
// recorded - ROUTE SELECTION happens before generation, so the prompt each route would send is
// captured faithfully regardless of what comes back.
//
// TWO INSTRUMENT FAILURES ARE ASSERTED:
//   COLLISION    two different goals produce a byte-identical prompt on the same route
//   NO SIGNAL    the prompt contains nothing that distinguishes this goal from its neighbours
//                (no goal text, and no goal-specific identifier such as the member being added)
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const FIRST = Number(process.env.FIRST || 61);
const LAST = Number(process.env.LAST || 80);
const ARMS = (process.env.ARMS || 'v2,v3').split(',');

// ---- the stub. Records everything, answers plausibly, never calls a model.
const captured = [];
const STUB_REPLY = 'pass\n';
const server = createServer((req, res) => {
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let j = {};
    try { j = JSON.parse(body); } catch (e) { j = {}; }
    captured.push({
      endpoint: req.url,
      prompt: typeof j.prompt === 'string' ? j.prompt : null,
      suffix: typeof j.suffix === 'string' ? j.suffix : null,
      chat: j.messages ? String(j.messages.map((m) => m.content).join('\n')) : null,
      num_predict: j.options ? j.options.num_predict : null,
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(req.url === '/api/chat'
      ? { message: { content: STUB_REPLY }, done_reason: 'stop', eval_count: 2 }
      : { response: STUB_REPLY, done_reason: 'stop', eval_count: 2 }));
  });
});
const port = await new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server.address().port)));
process.env.GATE_BASE = 'http://127.0.0.1:' + port;

// Imported AFTER GATE_BASE is set, because both arms read it at module scope.
const { runGoal: runGoalV2 } = await import('./arm.mjs');
const { runGoalV3 } = await import('./arm3.mjs');

const world = new Map();
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) world.set(f, readFileSync(p));
  }
}
const names = [...world.keys()].sort();
const freshWs = () => {
  const ws = mkdtempSync(join(tmpdir(), 'paudit-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  for (const f of names) writeFileSync(join(ws, f), world.get(f));
  return ws;
};

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const OUT = mkdtempSync(join(tmpdir(), 'promptaudit-'));
mkdirSync(OUT, { recursive: true });
console.log('  INSTRUMENT AUDIT - no model tokens spent; stub on port ' + port);
console.log('  goals ' + FIRST + '-' + LAST + '   arms ' + ARMS.join(' + ') + '\n');

const rows = [];
for (const arm of ARMS) {
  for (let g = FIRST; g <= LAST; g++) {
    const ws = freshWs();
    captured.length = 0;
    let rec = {};
    try {
      rec = arm === 'v3'
        ? await runGoalV3({ ws, goalIndex: g - 1, goals: GOALS })
        : await runGoalV2({ arm: 'v2', ws, goalIndex: g - 1, goals: GOALS });
    } catch (e) { rec = { note: 'threw: ' + String(e.message).slice(0, 60) }; }

    const route = rec.v3_route || rec.operation || 'unknown';
    const calls = captured.map((c, i) => {
      const text = c.chat !== null ? c.chat : String(c.prompt) + '\u0000SUFFIX\u0000' + String(c.suffix);
      return { i, endpoint: c.endpoint, kind: c.chat !== null ? 'chat' : 'fim',
        num_predict: c.num_predict, bytes: text.length, sha: sha(text), text };
    });
    for (const c of calls) {
      writeFileSync(join(OUT, arm + '.g' + g + '.call' + c.i + '.' + c.kind + '.txt'), c.text, 'utf8');
    }
    rows.push({ arm, goal: g, route, calls: calls.map((c) => ({ ...c, text: undefined })),
      prompt_shas: calls.map((c) => c.sha), n_calls: calls.length,
      texts: calls.map((c) => c.text) });
    console.log('  [' + arm + ' ' + String(g).padEnd(3) + '] ' + String(route).padEnd(30)
      + ' calls=' + calls.length + '  ' + calls.map((c) => c.kind + ':' + c.sha + '/' + c.num_predict).join(' '));
  }
  console.log('');
}
server.close();

// ---- FAILURE 1: two goals, same route, byte-identical prompt.
console.log('===== COLLISIONS: two goals whose prompts are byte-identical =====');
let collisions = 0;
for (const arm of ARMS) {
  const byKey = new Map();
  for (const r of rows.filter((x) => x.arm === arm)) {
    for (const s of r.prompt_shas) {
      const k = r.route + '|' + s;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(r.goal);
    }
  }
  for (const [k, gs] of byKey) {
    if (gs.length > 1) {
      collisions++;
      console.log('  INSTRUMENT FAILURE  ' + arm + '  route ' + k.split('|')[0]
        + '  prompt ' + k.split('|')[1] + '  shared by goals ' + gs.join(', '));
    }
  }
}
if (!collisions) console.log('  none');

// ---- FAILURE 2: the prompt carries nothing goal-specific.
//
// A first attempt - "a word from the goal text that does not appear in the canonical seed" - was
// WRONG, and a known-good witness caught it. Goal 62 adds between(entries, start, end); the harness
// puts `def between(` in the prefix, so the task IS conveyed. But the word "between" also occurs in
// the seed, so it was filtered out of the distinctive set and the goal was reported NO SIGNAL.
//
// The precise property is narrower. A FIM insertion route conveys the task through the NEW IDENTIFIER
// it writes into the prefix, so:
//
//   SIGNAL = the prompt contains the goal text, OR it contains a contract identifier that is NEW -
//            absent from the pre-edit source file. A name already present in the source (to_html) is
//            not signal: it was going to be there whatever the goal asked for.
//
// Two witnesses, both required to pass:
//   known-good  goal 62 - `between` is new and appears in the prefix  -> must report SIGNAL
//   known-bad   goals 64, 74 - to_html already exists, no goal text   -> must report NO SIGNAL
console.log('\n===== SIGNAL: does the prompt say what THIS goal wants? =====');
const { deriveContract: dc } = await import('./contract.mjs');
let nosignal = 0;
const signalOf = {};
for (const r of rows) {
  const goalText = GOALS[r.goal - 1];
  const c = dc(goalText);
  const src = world.has(c.lead) ? world.get(c.lead).toString('utf8') : '';
  const idents = [...new Set([...(c.members || []).map((m) => m.name), ...(c.moduleExports || [])])]
    .filter((n) => n && n.length > 2);
  const newIdents = idents.filter((n) => !new RegExp('\\b' + n + '\\b').test(src));
  const oldIdents = idents.filter((n) => !newIdents.includes(n));
  const anyGoal = r.texts.some((t) => t.includes(goalText.slice(0, 40)));
  const hit = [];
  for (const t of r.texts) for (const n of newIdents) if (t.includes(n) && !hit.includes(n)) hit.push(n);
  const ok = anyGoal || hit.length > 0;
  signalOf[r.arm + ':' + r.goal] = ok;
  if (!ok) {
    nosignal++;
    console.log('  NO SIGNAL  ' + r.arm + ' goal ' + r.goal + '  route ' + r.route);
    console.log('             goal text in prompt: no');
    console.log('             contract identifiers: ' + (idents.join(', ') || '(none)')
      + '  -- all already in ' + c.lead + ': ' + (oldIdents.join(', ') || 'n/a'));
    console.log('             so nothing in the prompt distinguishes this goal from any other goal'
      + ' targeting the same symbol');
  }
}
if (!nosignal) console.log('  every goal carried either its goal text or a NEW contract identifier');
console.log('\n  witnesses:  goal 62 (known-good, must be SIGNAL) = '
  + (signalOf['v2:62'] ? 'SIGNAL  OK' : 'NO SIGNAL  CHECKER BROKEN')
  + '   |  goals 64/74 (known-bad, must be NO SIGNAL) = '
  + ((signalOf['v3:64'] === false && signalOf['v3:74'] === false) ? 'NO SIGNAL  OK' : 'SIGNAL  CHECKER BLIND'));

writeFileSync(join(OUT, 'rows.json'), JSON.stringify(rows.map((r) => ({ ...r, texts: undefined })), null, 2), 'utf8');
console.log('\n===== SUMMARY =====');
console.log('  prompt collisions      ' + collisions + (collisions ? '   <-- INSTRUMENT FAILURE' : ''));
console.log('  goals with no signal   ' + nosignal + '/' + rows.length + (nosignal ? '   <-- INSTRUMENT FAILURE' : ''));
const byRoute = {};
for (const r of rows) byRoute[r.arm + ' ' + r.route] = (byRoute[r.arm + ' ' + r.route] || 0) + 1;
console.log('  routes exercised:');
for (const [k, v] of Object.entries(byRoute).sort()) console.log('    ' + k.padEnd(40) + v);
console.log('\n  RAW = ' + OUT);
