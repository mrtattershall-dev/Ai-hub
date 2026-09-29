'use strict';
// =============================================================================
// THE AI-NATIVE EDITOR (spine goal, made drivable) — a human authors a typed
// object graph BY DIRECTING AN AI, and EVERY AI proposal passes the validator
// before it can touch the world. Separate from the games: this is the editor.
// =============================================================================
// The user's stated goal (STATE.md): "a standalone AI-native engine EDITOR,
// separate from the games — AI proposes changes as structured diffs against a
// typed object graph; a validator checks invariants before anything commits."
//
// Everything under it is already decided + measured; this wraps the wires into
// one interactive surface so the boundary is DEMONSTRABLE, not just asserted:
//   * DATA edits  -> RD-018 protocol IR  (core/protocol.js parseProposal)
//   * BEHAVIOR    -> RD-B1/B2 rule wire  (core/behavior.js installRule)
//   * pipeline    -> RD-002/003/005/017 submit(); RD-020 undo; RD-019 persist
//   * repair loop -> RD-018.1 localized errors re-prompt (core/live_loop.js)
//   * context     -> RD-007 legible columnar slice (engine.contextSlice)
//
// THE THESIS THIS SURFACE MAKES VISIBLE: every AI proposal is shown as
// PROPOSED -> GATE VERDICT (accepted / rejected with a localized reason) ->
// COMMITTED-or-not. A rejected proposal changes NOTHING (validate before
// execute; a partial edit is corruption, never applied). The human never sees
// the world corrupted — they see the boundary catch the bad proposal and, for
// a weak model, teach it to fix itself.
//
//   Programmatic (deterministic, testable): new Editor({...}).command(line)
//   REPL:   node core/editor.js --mock        (scripted model, no GPU)
//           OLLAMA_MODEL=qwen2.5-coder:7b node core/editor.js
//           OPENROUTER_API_KEY=... OPENROUTER_MODEL=... node core/editor.js
//   Demo:   node core/editor.js --demo         (canned session, prints the
//                                               boundary catching unsafe edits)
// Zero deps.
// =============================================================================
const path = require('node:path');
const { Engine, TYPE, TYPE_NAME } = require(path.join(__dirname, 'engine.js'));
const IR = require(path.join(__dirname, 'protocol.js'));
const { installRule, uninstallRule } = require(path.join(__dirname, 'behavior.js'));
const P = require(path.join(__dirname, 'persistence.js'));
const { IR_GRAMMAR, buildPrompt, runProposalLoop } = require(path.join(__dirname, 'live_loop.js'));

// ---- the BEHAVIOR-rule grammar the model sees for `rule` (compact; RD-018.1
// verbosity-backfire discipline). Mirrors the wire in core/behavior.js. --------
// RD-029: the grammar description is DERIVED FROM THE WORLD'S SCHEMA. It was the
// last place the farm vocabulary was hardcoded — and the worst one, because a model
// cannot author what it is never told exists (pre-RD-029 it read
// `"type":"crop|enemy|zone"` and knew nothing of mul/near/subtree/signed ranges).
// Everything below is generated from engine.w.schema; nothing is farm-specific.
function ruleGrammar(engine) {
  const s = engine.w.schema;
  const types = s.TYPE_NAME;
  const fieldLines = s.defs
    .map((d) => {
      const fs = Object.entries(d.fields).filter(([, sp]) => sp.pool !== false);
      if (!fs.length) return null;
      return `  ${d.name}: ${fs.map(([f, sp]) => `${f} (${sp.range[0]}..${sp.range[1]})`).join(', ')}`
        + (d.spatial ? `   [has coordinates: ${d.spatial.x},${d.spatial.y} — usable with "of":{"near":R}]` : '');
    })
    .filter(Boolean);
  const anySpatial = Object.keys(s.spatial ?? {}).length > 0;
  const anySigned = s.defs.some((d) => Object.values(d.fields).some((sp) => sp.pool !== false && sp.range[0] < 0));
  const example = (() => {                       // an example built from THIS world's own fields
    for (const d of s.defs)
      for (const [f, sp] of Object.entries(d.fields)) {
        if (sp.pool === false) continue;
        return `example (+5 on ${d.name}.${f}, clamped so the range is PROVABLE): `
          + `{"name":"r","match":{"type":"${d.name}"},"effects":[{"set":"${f}","to":{"min":[{"add":[{"field":"${f}"},5]},${sp.range[1]}]}}]}`;
      }
    return '';
  })();
  return [
    'Author ONE behavior rule as a single JSON object, nothing else:',
    `{"name":"<short>","match":{"type":"${types.join('|')}","uuid":"<optional>","where":{"field":"<f>","cmp":"<|<=|==|>=|>|!=","value":<n>}},"every":<optional int>,"effects":[...]}`,
    'effects: {"set":"<field>","to":<expr>} | {"delete":true} | {"reparent":{"to":"<uuid>"}} | {"spawn":{"type":"<t>","props":{},"cap":<int>}}',
    '  expr: number | {"field":"<f>"} | {"add":[e,e]} | {"sub":[e,e]} | {"mul":[e,e]} | {"min":[e,e]} | {"max":[e,e]}',
    `        | {"count":{"type":"<t>","where":{...},"of":<scope>}} | {"sum"|"min"|"max":{"field":"<f>","type":"<t>","where":{...},"of":<scope>}}`,
    `  scope: "all" (default, global) | "children" | "subtree"${anySpatial ? ' | {"near":<int radius>} (entities within radius of the matched entity; needs coordinates)' : ''}`,
    '  an aggregation over an EMPTY set is 0.',
    'fields by type:',
    ...fieldLines,
    anySigned ? 'some ranges are NEGATIVE: a value can be signed; {"mul":[{"field":"vx"},-1]} negates.' : null,
    'A "set" must PROVABLY stay in its field range for EVERY possible input — clamp with min/max or it is rejected.',
    example,
  ].filter(Boolean).join('\n');
}
// back-compat: the farm's grammar text, for callers/tests importing the constant.
const RULE_GRAMMAR = ruleGrammar({ w: { schema: require('./engine.js').makeSchema(require('./engine.js').DEFAULT_SCHEMA_DEFS) } });

function buildRulePrompt(engine, { goal, rootUuid, radius = 1, priorErrors = null, priorRaw = null }) {
  let p = `WORLD (columnar slice):\n${engine.contextSlice(rootUuid, radius)}\n${ruleGrammar(engine)}\n\nGOAL: ${goal}\n`;
  if (priorErrors && priorErrors.length) {
    if (priorRaw) p += `\nYour previous attempt (REJECTED):\n${priorRaw}\n`;
    p += `\nIt was REJECTED. Fix exactly these and resend the FULL corrected rule:\n`;
    for (const e of priorErrors) p += `  - ${e.code}${e.detail ? ': ' + e.detail : ''}\n`;
  }
  return p + `\nRespond with ONLY the JSON object.`;
}

// One propose -> gate(installRule) -> repair loop for a BEHAVIOR rule (the
// behavior-layer analogue of live_loop.runProposalLoop). Returns the same shape.
async function runRuleLoop(engine, callModel, opts) {
  const { goal, rootUuid, radius = 1, maxAttempts = 4, feedback = true } = opts;
  const transcript = [];
  let priorErrors = null, priorRaw = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const prompt = buildRulePrompt(engine, { goal, rootUuid, radius,
      priorErrors: feedback ? priorErrors : null, priorRaw: feedback ? priorRaw : null });
    const raw = await callModel(prompt, attempt);
    if (feedback) priorRaw = raw;
    const res = installRule(engine, raw);        // parse + gate + register, atomic
    if (res.ok) {
      transcript.push({ attempt, phase: 'installed', name: res.name, raw });
      return { success: true, attempts: attempt, name: res.name, transcript };
    }
    priorErrors = res.errors;
    transcript.push({ attempt, phase: 'rejected', errors: res.errors, raw });
  }
  return { success: false, attempts: maxAttempts, transcript };
}

// world signature — proves "a rejected proposal changed NOTHING" (the thesis).
// It signs WORLD STATE ONLY. The logical clock `tick` is deliberately EXCLUDED:
// submit() advances tick once per call — on commit, defer, AND reject alike — so a
// rejected ENGINE-LAYER op (reparent cycle, claim conflict, contract assert) leaves
// entity/index/uuid/tombstone state byte-identical while tick moves by one. Signing
// the raw save flipped the thesis to a FALSE "CHECK" for that whole rejection class
// (RD-035 audit; the test only ever hit PROTOCOL-layer rejections, which short-circuit
// before submit() so tick never moved — the blind spot). tick is metadata about how
// many submit cycles ran, not world state, so "nothing changed" is measured without it.
function worldSig(engine) { const s = P.save(engine); delete s.tick; return JSON.stringify(s); }

// =============================================================================
// The Editor — a persistent world + a command surface. Every command returns a
// STRUCTURED result (so the REPL, the test, and the demo all drive the same
// code path); render() turns one into human text.
// =============================================================================
class Editor {
  constructor({ engine = null, callModel = null, root = null } = {}) {
    this.engine = engine ?? new Engine(256).enableHistory();
    if (!this.engine.history.on) this.engine.enableHistory();
    this.callModel = callModel;
    this.root = root;                            // focus uuid for show/prompts
    this.maxAttempts = 4;
    this.feedback = true;                        // localized-error repair on by default
  }

  // ensure there is a focus root for context slices / prompts.
  _root() {
    if (this.root && this.engine.w.liveEntity(this.root) >= 0) return this.root;
    // fall back to the first live zone, else the first live entity.
    const w = this.engine.w;
    for (let e = 0; e < w.count; e++) if (!w.destroyed[e] && w.type[e] === TYPE.ZONE) return (this.root = w.uuid[e]);
    for (let e = 0; e < w.count; e++) if (!w.destroyed[e]) return (this.root = w.uuid[e]);
    return null;
  }

  async command(line) {
    const s = String(line ?? '').trim();
    if (!s) return { ok: true, kind: 'noop' };
    const [cmd, ...rest] = s.split(/\s+/);
    const arg = rest.join(' ');
    switch (cmd.toLowerCase()) {
      case 'help':  return { ok: true, kind: 'help' };
      case 'quit': case 'exit': return { ok: true, kind: 'quit' };
      case 'spawn': return this._spawn(rest);
      case 'show':  return this._show(rest);
      case 'edit':  return this._edit(arg);
      case 'rule':  return this._rule(arg);
      case 'tick':  return this._tick(rest[0]);
      case 'undo':  { const r = this.engine.undo(); return { ok: r.ok, kind: 'undo', reason: r.reason, applied: r.applied }; }
      case 'redo':  { const r = this.engine.redo(); return { ok: r.ok, kind: 'redo', reason: r.reason, applied: r.applied }; }
      case 'rules': return this._rules();
      case 'uninstall': { const r = uninstallRule(this.engine, arg); return { ok: r.ok, kind: 'uninstall', name: arg, errors: r.errors }; }
      case 'focus': { if (this.engine.w.liveEntity(arg) < 0) return { ok: false, kind: 'focus', reason: `${arg} not live` }; this.root = arg; return { ok: true, kind: 'focus', root: arg }; }
      case 'save':  return this._save(arg);
      case 'load':  return this._load(arg);
      default: return { ok: false, kind: 'unknown', cmd };
    }
  }

  // -- direct authoring (trusted bootstrap; the human's own hands) -------------
  _spawn(rest) {
    const typeName = (rest[0] || '').toLowerCase();
    const type = TYPE[typeName.toUpperCase()];
    if (type === undefined) return { ok: false, kind: 'spawn', reason: `unknown type '${rest[0]}' (crop|enemy|zone|fish)` };
    const props = {};
    for (const kv of rest.slice(1)) { const [k, v] = kv.split('='); if (k) props[k] = /^\d+$/.test(v) ? +v : v; }
    if (props.parent == null && this.root) props.parent = this.root;
    let born;
    try { born = this.engine.spawn(type, props); } catch (e) { return { ok: false, kind: 'spawn', reason: e.message }; }
    if (type === TYPE.ZONE && !this.root) this.root = born.uuid;
    return { ok: true, kind: 'spawn', uuid: born.uuid, type: typeName };
  }

  _show(rest) {
    const uuid = rest.find(x => this.engine.w.liveEntity(x) >= 0) || this._root();
    const radius = Number(rest.find(x => /^\d+$/.test(x))) || 2;
    if (!uuid) return { ok: true, kind: 'show', slice: '# (empty world — spawn a zone to begin)\n' };
    return { ok: true, kind: 'show', slice: this.engine.contextSlice(uuid, radius), tick: this.engine.tick };
  }

  // -- AI-DIRECTED DATA EDIT: the validate-before-execute boundary, visible ----
  async _edit(goal) {
    if (!this.callModel) return { ok: false, kind: 'edit', reason: 'no model wired (run with --mock or set OLLAMA_MODEL/OPENROUTER_*)' };
    if (!goal) return { ok: false, kind: 'edit', reason: 'usage: edit <what you want changed>' };
    const before = worldSig(this.engine);
    const root = this._root();
    const r = await runProposalLoop(this.engine, this.callModel,
      { goal, rootUuid: root, radius: 2, maxAttempts: this.maxAttempts, feedback: this.feedback });
    // THESIS CHECK: if nothing committed, the world is byte-identical to before.
    const unchangedOnReject = r.success ? null : (worldSig(this.engine) === before);
    return { ok: r.success, kind: 'edit', goal, success: r.success, attempts: r.attempts,
      committed: r.committed, transcript: r.transcript, unchangedOnReject };
  }

  // -- AI-DIRECTED BEHAVIOR RULE: same boundary, one layer up ------------------
  async _rule(goal) {
    if (!this.callModel) return { ok: false, kind: 'rule', reason: 'no model wired (run with --mock or set OLLAMA_MODEL/OPENROUTER_*)' };
    if (!goal) return { ok: false, kind: 'rule', reason: 'usage: rule <behavior to author>' };
    const before = worldSig(this.engine);
    const root = this._root();
    const r = await runRuleLoop(this.engine, this.callModel,
      { goal, rootUuid: root, radius: 2, maxAttempts: this.maxAttempts, feedback: this.feedback });
    const unchangedOnReject = r.success ? null : (worldSig(this.engine) === before);
    return { ok: r.success, kind: 'rule', goal, success: r.success, attempts: r.attempts,
      name: r.name, transcript: r.transcript, unchangedOnReject };
  }

  _tick(nStr) {
    const n = Math.max(1, Number(nStr) || 1);
    const before = this.engine.contextSlice(this._root() ?? '', 3);
    for (let i = 0; i < n; i++) this.engine.stepTick();
    return { ok: true, kind: 'tick', n, tick: this.engine.tick,
      changed: this.engine.contextSlice(this._root() ?? '', 3) !== before,
      safe: this.engine.indexesConsistent() };
  }

  _rules() {
    const names = (this.engine.ruleSources ? [...this.engine.ruleSources.keys()] : []);
    return { ok: true, kind: 'rules', names, quarantine: (this.engine.ruleQuarantine ?? []).map(q => q.rule?.name) };
  }

  _save(file) {
    if (!file) return { ok: false, kind: 'save', reason: 'usage: save <file>' };
    try { require('node:fs').writeFileSync(file, JSON.stringify(P.save(this.engine))); }
    catch (e) { return { ok: false, kind: 'save', reason: e.message }; }
    return { ok: true, kind: 'save', file };
  }
  _load(file) {
    if (!file) return { ok: false, kind: 'load', reason: 'usage: load <file>' };
    let blob;
    try { blob = JSON.parse(require('node:fs').readFileSync(file, 'utf8')); }
    catch (e) { return { ok: false, kind: 'load', reason: e.message }; }
    this.engine = P.load(blob);
    if (!this.engine.history.on) this.engine.enableHistory();
    this.root = null; this._root();
    return { ok: true, kind: 'load', file, tick: this.engine.tick,
      rules: this.engine.ruleSources ? this.engine.ruleSources.size : 0 };
  }

  // ---- render a command result as human text for the REPL --------------------
  render(r) {
    switch (r.kind) {
      case 'noop': return '';
      case 'help': return HELP;
      case 'quit': return 'bye.';
      case 'unknown': return `? unknown command '${r.cmd}' — type 'help'`;
      case 'spawn': return r.ok ? `+ spawned ${r.type} ${r.uuid}` : `✗ spawn: ${r.reason}`;
      case 'show': return r.slice + (r.tick != null ? `# tick=${r.tick}\n` : '');
      case 'focus': return r.ok ? `focus → ${r.root}` : `✗ focus: ${r.reason}`;
      case 'undo': return r.ok ? `↶ undid ${r.applied} change(s)` : `✗ undo: ${r.reason}`;
      case 'redo': return r.ok ? `↷ redid ${r.applied} change(s)` : `✗ redo: ${r.reason}`;
      case 'rules': return r.names.length ? `installed rules: ${r.names.join(', ')}` + (r.quarantine.length ? `\nquarantined: ${r.quarantine.join(', ')}` : '') : '(no rules installed)';
      case 'uninstall': return r.ok ? `− uninstalled rule '${r.name}'` : `✗ uninstall: ${r.errors?.[0]?.detail ?? r.name}`;
      case 'tick': return `⏱ ticked ${r.n} → tick=${r.tick}${r.changed ? ' (world changed)' : ''}${r.safe ? '' : '  ⚠ UNSAFE'}`;
      case 'save': return r.ok ? `💾 saved → ${r.file}` : `✗ save: ${r.reason}`;
      case 'load': return r.ok ? `📂 loaded ${r.file} (tick=${r.tick}, ${r.rules} rule(s))` : `✗ load: ${r.reason}`;
      case 'edit': case 'rule': return this._renderProposal(r);
      default: return JSON.stringify(r);
    }
  }
  _renderProposal(r) {
    if (r.reason) return `✗ ${r.kind}: ${r.reason}`;
    const lines = [`▸ ${r.kind}: "${r.goal}"`];
    for (const t of r.transcript) {
      const raw = String(t.raw).replace(/\s+/g, ' ').slice(0, 100);
      if (t.phase === 'committed' || t.phase === 'installed') {
        lines.push(`  attempt ${t.attempt}: PROPOSED ${raw}`);
        lines.push(`  attempt ${t.attempt}: ✓ GATE ACCEPTED → ${t.phase === 'installed' ? `rule '${t.name}' installed` : `committed`}`);
      } else {
        lines.push(`  attempt ${t.attempt}: PROPOSED ${raw}`);
        const why = (t.errors || []).map(e => e.detail || e.code).join('; ');
        lines.push(`  attempt ${t.attempt}: ✗ GATE REJECTED — ${why}`);
      }
    }
    if (r.success) lines.push(`  ⇒ done in ${r.attempts} attempt(s)${r.kind === 'edit' ? `, ${r.committed} tx committed` : ''}`);
    else lines.push(`  ⇒ NOT applied after ${r.attempts} attempts — world unchanged: ${r.unchangedOnReject === true ? 'CONFIRMED (validate-before-execute)' : 'CHECK'}`);
    return lines.join('\n');
  }
}

const HELP = [
  'AI-native editor — you direct, the AI proposes, the validator gates before anything commits.',
  '  spawn <type> [k=v ...]   author an object directly (crop|enemy|zone), e.g. spawn zone name=field',
  '  show [uuid] [radius]     print the columnar world slice',
  '  focus <uuid>             set the slice/prompt focus',
  '  edit <intent>            ask the AI to change DATA; every proposal is gated (repairs on reject)',
  '  rule <intent>            ask the AI to author a BEHAVIOR rule; gated the same way',
  '  tick [n]                 advance the simulation n ticks (installed rules run)',
  '  rules | uninstall <name> list / remove installed rules',
  '  undo | redo              reverse / replay the last change (one tick = one step)',
  '  save <file> | load <file>  snapshot / restore the world (rules included)',
  '  help | quit',
].join('\n');

// =============================================================================
// MOCK MODEL — deterministic, so the surface + the boundary are provable with
// no GPU. It sees ONLY the prompt (like a real model) and, on the demo intents,
// emits a realistic NEAR-MISS first, then repairs when it sees the localized
// error — exactly the RD-018.1 measured failure class (right intent, wrong
// range/shape). CONTROL-style flailing is out of scope for a fixture.
// =============================================================================
function mockModel() {
  const cropOf = (prompt) => (prompt.match(/^(\w+)\tcrop\t/m) || [])[1] || 'u1';
  const goalOf = (prompt) => (prompt.match(/GOAL: (.*)/) || [])[1] || '';
  return async (prompt) => {
    const isRule = /"effects"/.test(prompt);            // RULE_GRAMMAR marker
    const sawError = /REJECTED/.test(prompt);
    const crop = cropOf(prompt), goal = goalOf(prompt).toLowerCase();
    if (isRule) {
      // "watered crops gain N growth each tick" — near-miss unclamped, then clamp.
      if (!sawError)
        return '{"name":"grow","match":{"type":"crop","where":{"field":"water","cmp":">","value":0}},"effects":[{"set":"growth","to":{"add":[{"field":"growth"},5]}}]}';
      return '{"name":"grow","match":{"type":"crop","where":{"field":"water","cmp":">","value":0}},"effects":[{"set":"growth","to":{"min":[{"add":[{"field":"growth"},5]},255]}}]}';
    }
    // DATA edit. Pull the target value out of the intent.
    const n = Number((goal.match(/\b(\d+)\b/) || [])[1] ?? 80);
    const field = /growth/.test(goal) ? 'growth' : 'water';
    const value = sawError ? Math.min(n, 255) : n;      // over-range first, clamp on repair
    return `{"actor":"ai","ops":[{"op":"setfield","target":"${crop}","field":"${field}","value":${value}}]}`;
  };
}

// ---- REAL backend (mirrors core/live_loop_real.js / 027 conventions) --------
function realModel() {
  const num = (v, d) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
  const TEMP = num(process.env.LOOP_TEMP, 0.2);
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL;
  const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
  const OPENAI_BASE = process.env.OPENAI_BASE || 'https://openrouter.ai/api/v1';
  const KEY = process.env.OPENROUTER_API_KEY || (process.env.OPENAI_BASE ? 'EMPTY' : '');
  const extract = (t) => { t = (t || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/gi, ''); const i = t.indexOf('{'); return i < 0 ? t : t.slice(i, t.lastIndexOf('}') + 1 || undefined); };
  if (OLLAMA_MODEL) return async (prompt) => {
    const r = await fetch(`${OLLAMA_URL}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: true, options: { temperature: TEMP, num_predict: 512 } }) });
    if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
    let out = '', buf = ''; const dec = new TextDecoder();
    for await (const chunk of r.body) { buf += dec.decode(chunk, { stream: true }); let nl;
      while ((nl = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (ln) { try { out += JSON.parse(ln).response || ''; } catch {} } } }
    return extract(out);
  };
  if (KEY) { const MODEL = process.env.OPENROUTER_MODEL; return async (prompt) => {
    const r = await fetch(`${OPENAI_BASE}/chat/completions`, { method: 'POST',
      headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 600, temperature: TEMP }) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return extract((await r.json()).choices?.[0]?.message?.content ?? '');
  }; }
  return null;
}

// ---- the scripted demo (a canned human session; prints the boundary at work)-
async function demo() {
  const ed = new Editor({ callModel: mockModel() });
  const script = [
    'spawn zone name=field',
    'spawn crop name=c1 water=20 growth=0',
    'show',
    'edit set the crop water to 80',            // clean edit — gate accepts
    'edit set the crop water to 999',           // unsafe — gate REJECTS, AI repairs to 255
    'rule watered crops gain 5 growth each tick',// unsafe rule — range proof REJECTS, AI clamps
    'tick 6',                                    // the authored rule runs
    'show',
    'undo',                                      // reverse the last tick
    'save editor_demo_world.json',
    'load editor_demo_world.json',
    'rules',
  ];
  console.log('=== AI-native editor — scripted demo (mock model, no GPU) ===\n');
  let unsafeCaught = 0, corruptions = 0;
  for (const line of script) {
    console.log(`\n> ${line}`);
    const r = await ed.command(line);
    console.log(ed.render(r));
    if ((r.kind === 'edit' || r.kind === 'rule')) {
      unsafeCaught += (r.transcript || []).filter(t => t.phase === 'rejected' || t.phase === 'engine_rejected' || t.phase === 'protocol').length;
      if (r.success === false && r.unchangedOnReject !== true) corruptions++;
    }
    if (r.kind === 'tick' && r.safe === false) corruptions++;
  }
  try { require('node:fs').unlinkSync('editor_demo_world.json'); } catch {}
  console.log(`\n=== the validator caught ${unsafeCaught} unsafe proposal(s); world corruptions: ${corruptions} (must be 0) ===`);
  return corruptions === 0;
}

// ---- the REPL ---------------------------------------------------------------
async function repl(callModel) {
  const readline = require('node:readline');
  const ed = new Editor({ callModel });
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'editor> ' });
  console.log('AI-native editor. Type "help". The validator gates every AI proposal before it commits.\n');
  rl.prompt();
  // SERIALIZE: 'line' fires per input line, but command() is async (model calls,
  // shared world state). Without a chain, piped/pasted multi-line input runs
  // commands CONCURRENTLY on one Editor — races + dropped output (caught by the
  // REPL smoke test). Chain each line after the previous completes.
  let chain = Promise.resolve();
  rl.on('line', (line) => {
    chain = chain.then(async () => {
      let r;
      try { r = await ed.command(line); } catch (e) { console.log(`✗ error: ${e.message}`); return rl.prompt(); }
      const text = ed.render(r);
      if (text) console.log(text);
      if (r.kind === 'quit') return rl.close();
      rl.prompt();
    });
  }).on('close', () => process.exit(0));
}

module.exports = { Editor, mockModel, realModel, runRuleLoop, buildRulePrompt, RULE_GRAMMAR, ruleGrammar, worldSig };

if (require.main === module) {
  (async () => {
    if (process.argv.includes('--demo')) { const ok = await demo(); process.exit(ok ? 0 : 1); }
    const callModel = process.argv.includes('--mock') ? mockModel() : realModel();
    if (!callModel) { console.error('no model: use --mock, or set OLLAMA_MODEL / OPENROUTER_API_KEY+OPENROUTER_MODEL'); process.exit(1); }
    await repl(callModel);
  })();
}
