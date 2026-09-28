// BEHAVIOUR-LOCALIZATION FEASIBILITY. Development goals only. NOT v4, and not v4 performance.
//
// The v3 behavioural lane was non-identifying: the goal text never reached the model, and goals 64
// and 74 sent a byte-identical prompt. Before building site-selection machinery, answer the cheaper
// question - when the model is actually TOLD what behaviour to add, and the working implementation
// stays visible, can it produce the required local deltas at all?
//
// THREE CONDITIONS, goals 64 and 74, one fixed seed panel.
//
//   R  reference_control          no model. The proven reference snippets are applied at the oracle
//                                sites, stepwise, through the same transactional harness. Establishes
//                                that the harness and the SITE ORDER are sound, and that every
//                                intermediate state loads. If R fails, nothing else can be read.
//
//   A  instruction_only           whole-function replacement exactly as v3 does it, PLUS the actual
//                                goal text. Isolates one defect: was instruction starvation by itself
//                                enough to explain the nonsense renderer?
//
//   B  oracle_localized_insertion existing to_html stays byte-identical and visible, the goal text is
//                                supplied, the insertion sites come from the proven reference patch,
//                                and the model generates only the inserted snippets.
//
// WHAT B IS AND IS NOT. Labelled ORACLE_LOCALIZATION_FEASIBILITY. The oracle supplies the anchor, the
// indentation, and one line of intent per site. It never supplies the code. This deliberately hands
// the architecture problem away in order to isolate model capability, and says NOTHING about whether
// a system could derive those sites. That is the question v4 would exist to answer, and only if B
// shows life.
//
// TRANSACTIONAL, exactly like multiInsert: every site is re-anchored against source_{n-1}, never
// against the original; each intermediate must load; any failure rolls the whole goal back to
// source_0 byte-exactly.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdtempSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SITES, locate } from './oraclesites.mjs';
import { spanReplaceFunction } from './safeReplace.mjs';
import { regressionFor } from './regression.mjs';
import { probe60For } from './probes60.mjs';
import { checkContract } from './contractCheck.mjs';
import { deriveContract } from './contract.mjs';
import { scopeFacts } from './scope.mjs';
import { gateSnippet } from './refusalgate.mjs';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const BASE = process.env.GATE_BASE || 'http://127.0.0.1:11434';
const MODEL = process.env.GATE_MODEL || 'qwen2.5-coder:1.5b';
const CASES = (process.env.CASES || '64,74').split(',').map(Number);
const SEEDS = (process.env.SEEDS || '1,2,3,4,5,6,7,8').split(',').map(Number);
const CONDS = (process.env.CONDS || 'R,A,B').split(',');
const NPRED_A = Number(process.env.NPRED_A || 1800);
const NPRED_B = Number(process.env.NPRED_B || 600);
// ROUTE: 'zero_width' is B0's formulation, frozen as apparatus-invalid. 'indent_primer' is the route
// the three-way probe selected under its preregistered criterion - the prefix ends with the site's
// indentation, so stopping is not a valid continuation, and no semantic content is added beyond the
// indentation the site already implies.
const ROUTE = process.env.ROUTE || 'zero_width';
// INTENT: 'b0' is the original per-site intent; 'b1' is the disambiguated set, which names the
// identifier to create and the neighbouring identifier NOT to touch. See the B1 amendment.
const INTENT = process.env.INTENT || 'b0';
// BOUND: 'none' accepts whatever the generator emits. 'd2' bounds the snippet to the site, which B1
// showed is the binding constraint - the model writes the correct first statement and then runs on into
// invented helpers, re-declarations of existing code, and more lines in the instruction's own comment
// format. Uses NO oracle information. The instruction text is deliberately left unchanged so that B2
// isolates this one variable.
const BOUND = process.env.BOUND || 'none';
// STRICT: abort the transaction on a preservation break, not only on a load failure.
const STRICT = process.env.STRICT === '1';
// GATE: 'off' | 'shadow'. SHADOW records the FROZEN refusal gate's verdict at every step WITHOUT acting
// on it, so one run yields both the ungated outcome and the counterfactual "what would gating have
// done", paired on identical trajectories. Enforcement is then simulated by killing a chain at its
// first REFUSE - exactly what an enforcing gate would do. In shadow mode the gate may not change what
// the model sees or what gets committed, or the two arms stop being paired.
const GATE = process.env.GATE || 'off';

const indentOf = (l) => (l.match(/^[ \t]*/) || [''])[0].length;
function boundToSite(snippet, indent, src) {
  const structural = new Set(src.split('\n').map((l) => l.trim()).filter((l) => l.length > 3));
  const lines = snippet.split('\n');
  const keep = [];
  let stoppedBy = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const t = l.trim();
    if (i > 0) {
      if (t && indentOf(l) < indent) { stoppedBy = 'dedent_below_site'; break; }
      if (/^#/.test(t) && /WRITE ONLY|REQUESTED CHANGE|AUTHORITATIVE|MARKER/i.test(t)) { stoppedBy = 'instruction_echo'; break; }
      if (/^(def|for|while|class)\b/.test(t) && structural.has(t)) { stoppedBy = 'redeclares_existing'; break; }
    }
    keep.push(l);
  }
  while (keep.length && !keep[keep.length - 1].trim()) keep.pop();
  return { text: keep.join('\n') + '\n', stoppedBy, droppedLines: lines.length - keep.length };
}
const DECODE = { temperature: 0.7, top_p: 0.8, top_k: 20, repeat_penalty: 1.1, repeat_last_n: 64 };

const OUT = process.env.OUTDIR || mkdtempSync(join(tmpdir(), 'feas-'));
mkdirSync(join(OUT, 'wire'), { recursive: true });
mkdirSync(join(OUT, 'replies'), { recursive: true });
const sha = (s) => createHash('sha256').update(s).digest('hex');
const short = (s) => sha(s).slice(0, 16);

const world = new Map();
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) world.set(f, readFileSync(p));
  }
}
const names = [...world.keys()].sort();
const freshWs = () => {
  const ws = mkdtempSync(join(tmpdir(), 'feasws-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  for (const f of names) writeFileSync(join(ws, f), world.get(f));
  return ws;
};

// Every request is written to disk before it is sent, and the raw reply after. No summary without
// bytes - the rule this whole line of work exists because I broke once already.
let callSeq = 0;
async function callModel(tag, prefix, suffix, seed, npred) {
  const body = { model: MODEL, prompt: prefix, suffix, stream: false,
    options: Object.assign({}, DECODE, { num_predict: npred, seed }) };
  const id = String(++callSeq).padStart(4, '0') + '.' + tag;
  writeFileSync(join(OUT, 'wire', id + '.request.json'), JSON.stringify(body, null, 2), 'utf8');
  let j = {};
  let err = null;
  try {
    const r = await fetch(BASE + '/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(1800000),
    });
    j = await r.json();
  } catch (e) { err = String(e.message).slice(0, 120); }
  const text = String(j.response || '');
  writeFileSync(join(OUT, 'replies', id + '.reply.txt'), text, 'utf8');
  writeFileSync(join(OUT, 'wire', id + '.response.json'), JSON.stringify({ ...j, response: undefined }, null, 2), 'utf8');
  return { text, done_reason: j.done_reason || null, eval_count: j.eval_count === undefined ? null : j.eval_count,
    hit_cap: j.eval_count !== undefined && j.eval_count !== null && j.eval_count >= npred,
    transport_error: err, wire_id: id };
}

// The instruction channel. It must separate immutable existing context from the requested delta -
// the model is no longer expected to infer its job from an identifier such as `between(`.
function instructionB(goalText, purpose, indent, contrast) {
  const p = ' '.repeat(indent);
  return p + '# The code above and below is EXISTING and AUTHORITATIVE - do not repeat or rewrite it.\n'
    + p + '# REQUESTED CHANGE: ' + goalText + '\n'
    + p + '# AT THIS POINT WRITE ONLY THIS: ' + purpose + '\n'
    + (contrast || '');
}

// THE SEMANTIC CONTRAST BLOCK (intent set b2). B2's failures were not bad algorithms - they were the
// model filling in a locally plausible continuation by imitating neighbouring state, because the plan
// said what to ADD without saying what already OWNS that responsibility. Twice now: at the declaration
// level (items = [] copied instead of ol_items created) and at the body level (an added else that
// duplicates the existing accumulator, plus codes/links borrowed from _inline).
//
// The in/out-of-scope lists are DERIVED from the source, not written by me - see scope.mjs. That
// distinction is the point: a field a planner can compute is a field a real system could fill, whereas
// a field only I can write is an oracle in disguise. `owns` remains oracle prose, and is marked as such.
function contrastBlock(src, fn, site, indent, createdNames) {
  const p = ' '.repeat(indent);
  const f = scopeFacts(src, fn, createdNames);
  let out = '';
  if (site.owns) out += p + '# ALREADY HANDLED ELSEWHERE - do not add a second path for it: ' + site.owns + '\n';
  if (f && f.outOfScope.length) {
    out += p + '# NOT AVAILABLE HERE (they are locals of other functions, not of ' + fn + '): '
      + f.outOfScope.join(', ') + '\n';
  }
  if (site.soleFallthrough) {
    out += p + '# Any line this code does not handle must fall through to the EXISTING code unchanged.\n';
  }
  return out;
}
function instructionA(goalText) {
  return '# The functions above are EXISTING and must keep working exactly as they do now.\n'
    + '# REQUESTED CHANGE: ' + goalText + '\n'
    + '# Write the complete body of to_html: keep EVERY existing behaviour AND add the requested change.\n';
}

function evaluate(ws, file, contract, suite, probe) {
  const loadOnly = checkContract(ws, file, { ...contract, moduleExports: [], members: [] });
  const reg = loadOnly.loads ? suite(ws) : { pass: false, why: 'does not load' };
  const delta = loadOnly.loads ? probe.run(ws) : { pass: false, why: 'does not load' };
  return { loads: loadOnly.loads, loadMsg: loadOnly.loads ? '' : String(loadOnly.msg).slice(0, 110),
    regression: reg.pass, regressionWhy: reg.why || '', delta: delta.pass, deltaWhy: delta.why || '' };
}

// ---------------------------------------------------------------------------------------------
async function runB({ goal, seed, useReference }) {
  const spec = SITES[goal];
  const goalText = GOALS[goal - 1];
  const c = deriveContract(goalText);
  const suite = regressionFor(spec.file);
  const probe = probe60For(goal);
  const ws = freshWs();
  const path = join(ws, spec.file);
  const source0 = readFileSync(path, 'utf8');
  const rec = { goal, seed, condition: useReference ? 'R_reference_control' : 'B_oracle_localized_insertion',
    label: useReference ? 'NO MODEL' : 'ORACLE_LOCALIZATION_FEASIBILITY',
    // TYPED RECORDS. A naive grep for /VERIFIED$/ over the log counted the two REFERENCE CONTROL lines
    // as model successes, and I reported "2 verified" when the truth was 0. Control records and
    // experimental records must be distinguishable by FIELD, never by matching a string, and outcomes
    // must be read from rows.json rather than grepped from a log.
    record_kind: useReference ? 'control' : 'experimental',
    generator: useReference ? 'reference' : 'model',
    route: ROUTE, intent_set: INTENT,
    sites_total: spec.sites.length, source0_sha: sha(source0), steps: [], aborted_at: null, why: '' };

  let cur = source0;
  for (let i = 0; i < spec.sites.length; i++) {
    const site = spec.sites[i];
    const purpose = (INTENT === 'b1' && site.purpose_b1) ? site.purpose_b1 : site.purpose;
    const ind = ' '.repeat(site.indent);
    const step = { site_index: i + 1, purpose, intent_set: INTENT, route: ROUTE, indent: site.indent,
      source_sha_before: short(cur), anchor_found: false };
    const loc = locate(cur, site);
    if (!loc.ok) {
      step.why = loc.why;
      rec.steps.push(step);
      rec.aborted_at = i + 1; rec.why = 'site ' + (i + 1) + ': ' + loc.why;
      break;
    }
    step.anchor_found = true;

    let snippet;
    if (useReference) {
      snippet = site.reference;
      step.source = 'reference';
      // KNOWN-BAD WITNESS. A control that only ever passes proves nothing about the harness: an
      // apparatus that accepts everything would also report 7/7. MUTATE_SITE=n corrupts exactly that
      // site, and the run MUST abort there and roll back byte-exactly.
      if (Number(process.env.MUTATE_SITE || 0) === i + 1) {
        snippet = ind + 'if True(  # deliberately broken by MUTATE_SITE\n';
        step.source = 'MUTATED';
      }
      // A SEPARATE witness for STRICT. The syntax mutation above is caught by the LOAD check, which
      // runs first, so it can never exercise the preservation abort - a fixture stopped by a different
      // guard reports green forever. This one is valid Python that loads cleanly and corrupts the old
      // behaviour, which is the only input that reaches the STRICT branch.
      if (Number(process.env.MUTATE_PRESERVE || 0) === i + 1) {
        snippet = ind + 'current.append("ZZZ")  # valid code, breaks old behaviour, by MUTATE_PRESERVE\n';
        step.source = 'MUTATED';
      }
      // Under the indent-primer route the harness re-adds the site indentation to whatever comes back,
      // because the prompt consumed it. The control must exercise that SAME assembly path or it is not
      // a control for this apparatus: the reference snippet is de-indented and re-assembled, and the
      // result must equal the reference byte for byte.
      if (ROUTE === 'indent_primer' && step.source === 'reference') {
        const deIndented = snippet.startsWith(ind) ? snippet.slice(ind.length)
          : snippet.replace(new RegExp('^\\n' + ind), '\n');
        const reassembled = snippet.startsWith(ind) ? ind + deIndented : snippet;
        step.primer_assembly_lossless = reassembled === snippet;
        snippet = reassembled;
      }
      // The bound must be a NO-OP on a known-good snippet. A bound that also truncates correct code
      // would raise the pass rate by mutilating the reference, and the control is the only thing that
      // can tell those two apart.
      if (BOUND === 'd2' && step.source === 'reference') {
        const b = boundToSite(snippet, site.indent, cur);
        step.bound_is_noop_on_reference = b.text.replace(/\s+$/, '') === snippet.replace(/\s+$/, '');
        step.bound_stopped_by = b.stoppedBy;
      }
      step.generated_bytes = snippet.length;
    } else {
      const created = [].concat(spec.sites.map((x) => (x.purpose_b1 || '').match(/named `([A-Za-z_]\w*)`/))
        .filter(Boolean).map((m) => m[1]));
      const contrast = INTENT === 'b2' ? contrastBlock(cur, spec.fn, site, site.indent, created) : '';
      step.contrast_lines = contrast ? contrast.trimEnd().split(String.fromCharCode(10)).length : 0;
      const genPrefix = loc.before + instructionB(goalText, purpose, site.indent, contrast)
        + (ROUTE === 'indent_primer' ? ind : '');
      const out = await callModel('g' + goal + '.s' + seed + '.site' + (i + 1), genPrefix, loc.after, seed, NPRED_B);
      snippet = ROUTE === 'indent_primer' ? ind + out.text : out.text;
      step.echoed_instruction = /EXISTING and AUTHORITATIVE|REQUESTED CHANGE|AT THIS POINT WRITE ONLY/i.test(snippet);
      step.raw_snippet_bytes = snippet.length;
      if (BOUND === 'd2') {
        const b = boundToSite(snippet, site.indent, cur);
        step.bound_stopped_by = b.stoppedBy;
        step.bound_dropped_lines = b.droppedLines;
        step.bound_trimmed_bytes = snippet.length - b.text.length;
        // The bound is a FUNCTION OF PREDECESSOR STATE (redeclares_existing consults the current
        // source). A replay that re-derives it is therefore changing the treatment as well as the
        // context, which is not a counterfactual. Freeze all three so replay consumes the bound
        // snippet VERBATIM: no rebinding, no normalisation, no second interpretation.
        step.raw_model_reply = snippet;
        step.bound_snippet = b.text;
        step.bound_against_state_hash = short(cur);
        snippet = b.text;
      }
      Object.assign(step, { wire_id: out.wire_id, eval_count: out.eval_count, done_reason: out.done_reason,
        hit_cap: out.hit_cap, transport_error: out.transport_error, generated_bytes: snippet.length,
        ends_with_newline: /\n$/.test(snippet), snippet_head: snippet.slice(0, 140).replace(/\n/g, '\\n') });
      if (out.transport_error) {
        step.why = 'transport: ' + out.transport_error;
        rec.steps.push(step); rec.aborted_at = i + 1; rec.why = step.why; break;
      }
      if (!snippet.trim()) {
        step.why = 'empty snippet';
        rec.steps.push(step); rec.aborted_at = i + 1; rec.why = step.why; break;
      }
    }

    if (GATE !== 'off') {
      const createdG = spec.sites.map((x) => (x.purpose_b1 || '').match(/named `([A-Za-z_]\w*)`/))
        .filter(Boolean).map((m) => m[1]);
      const g = gateSnippet(cur, snippet, spec, site, createdG);
      step.gate_verdict = g.verdict;
      step.gate_reasons = g.reasons.map((x) => x.kind + (x.detail ? '(' + x.detail + ')' : ''));
    }
    const candidate = loc.before + snippet + loc.after;
    // Insertion-only holds by construction here: the surrounding bytes are spliced, never rewritten.
    step.insertion_only_by_construction = true;
    writeFileSync(path, candidate, 'utf8');
    let ev = evaluate(ws, spec.file, c, suite, probe);

    // Diagnostic only, never used for the verdict: would a single missing newline have saved it?
    if (!ev.loads && !/\n$/.test(snippet)) {
      writeFileSync(path, loc.before + snippet + '\n' + loc.after, 'utf8');
      step.newline_repair_would_load = evaluate(ws, spec.file, c, suite, probe).loads;
      writeFileSync(path, candidate, 'utf8');
    }
    Object.assign(step, { loads_after: ev.loads, load_error: ev.loadMsg,
      old_regression_after: ev.regression, new_delta_after: ev.delta, source_sha_after: short(candidate) });
    rec.steps.push(step);

    if (!ev.loads) { rec.aborted_at = i + 1; rec.why = 'site ' + (i + 1) + ' does not load: ' + ev.loadMsg; break; }
    // STRICT transactional semantics, matching multiInsert: a broken intermediate must never become the
    // predecessor state for the next edit. Without this the chain continues past a preservation break
    // and "sites completed" counts steps that merely LOADED - which inflated B2's depth figure until I
    // recomputed healthy depth by hand. With it, transaction depth IS healthy depth by construction.
    if (STRICT && ev.regression === false) {
      rec.aborted_at = i + 1;
      rec.why = 'site ' + (i + 1) + ' broke old behaviour: ' + String(ev.regressionWhy).slice(0, 80);
      break;
    }
    cur = candidate;
  }

  if (rec.aborted_at === null) {
    const ev = evaluate(ws, spec.file, c, suite, probe);
    Object.assign(rec, { final_loads: ev.loads, final_old_regression: ev.regression,
      final_old_regression_why: ev.regressionWhy, final_new_delta: ev.delta, final_delta_why: ev.deltaWhy,
      verified: !!(ev.loads && ev.regression && ev.delta), final_sha: sha(cur) });
    if (!rec.verified) rec.why = !ev.regression ? 'OLD BROKE: ' + ev.regressionWhy : 'DELTA: ' + ev.deltaWhy;
  } else {
    Object.assign(rec, { final_loads: null, final_old_regression: null, final_new_delta: null, verified: false });
  }
  if (!rec.verified) {
    writeFileSync(path, source0, 'utf8');
    rec.rollback = true;
    rec.restored_byte_exact = readFileSync(path, 'utf8') === source0;
    rec.final_sha = sha(readFileSync(path, 'utf8'));
  } else rec.rollback = false;
  rec.steps_completed = rec.steps.filter((s) => s.loads_after).length;
  return rec;
}

// ---------------------------------------------------------------------------------------------
async function runA({ goal, seed }) {
  const spec = SITES[goal];
  const goalText = GOALS[goal - 1];
  const c = deriveContract(goalText);
  const suite = regressionFor(spec.file);
  const probe = probe60For(goal);
  const ws = freshWs();
  const path = join(ws, spec.file);
  const source0 = readFileSync(path, 'utf8');
  const span = spanReplaceFunction(source0, c.lang, spec.fn);
  const rec = { goal, seed, condition: 'A_instruction_only', label: 'whole-function replacement + goal text',
    sites_total: 1, source0_sha: sha(source0), steps: [] };
  if (!span.ok) { rec.why = 'span refused: ' + span.why; rec.verified = false; return rec; }

  // The instruction lives ONLY in the generation prompt. The candidate is assembled from the
  // ORIGINAL prefix, so the file is shaped exactly as v3 would have shaped it.
  const genPrefix = span.origPrefix + instructionA(goalText) + 'def ' + spec.fn + '(';
  const out = await callModel('g' + goal + '.s' + seed + '.A', genPrefix, span.suffix, seed, NPRED_A);
  const candidate = span.prefix + out.text + span.suffix;
  const step = { site_index: 1, purpose: 'replace the whole body of ' + spec.fn, wire_id: out.wire_id,
    source_sha_before: short(source0), eval_count: out.eval_count, done_reason: out.done_reason,
    hit_cap: out.hit_cap, transport_error: out.transport_error, generated_bytes: out.text.length,
    ends_with_newline: /\n$/.test(out.text), snippet_head: out.text.slice(0, 140).replace(/\n/g, '\\n'),
    insertion_only_by_construction: false };
  writeFileSync(path, candidate, 'utf8');
  const ev = evaluate(ws, spec.file, c, suite, probe);
  Object.assign(step, { loads_after: ev.loads, load_error: ev.loadMsg,
    old_regression_after: ev.regression, new_delta_after: ev.delta, source_sha_after: short(candidate) });
  rec.steps.push(step);
  Object.assign(rec, { final_loads: ev.loads, final_old_regression: ev.regression,
    final_old_regression_why: ev.regressionWhy, final_new_delta: ev.delta, final_delta_why: ev.deltaWhy,
    verified: !!(ev.loads && ev.regression && ev.delta), final_sha: sha(candidate),
    steps_completed: ev.loads ? 1 : 0 });
  if (!rec.verified) {
    rec.why = !ev.loads ? 'LOAD: ' + ev.loadMsg : !ev.regression ? 'OLD BROKE: ' + ev.regressionWhy : 'DELTA: ' + ev.deltaWhy;
    writeFileSync(path, source0, 'utf8');
    rec.rollback = true;
    rec.restored_byte_exact = readFileSync(path, 'utf8') === source0;
  } else rec.rollback = false;
  return rec;
}

// ---------------------------------------------------------------------------------------------
console.log('  BEHAVIOUR-LOCALIZATION FEASIBILITY   (development goals only; NOT v4)');
console.log('  model ' + MODEL + '   goals [' + CASES + ']   seeds [' + SEEDS + ']   conditions [' + CONDS + ']');
console.log('  A num_predict ' + NPRED_A + '   B num_predict ' + NPRED_B + '   out ' + OUT + '\n');

const rows = [];
const save = () => writeFileSync(join(OUT, 'rows.json'), JSON.stringify(rows, null, 2), 'utf8');

if (CONDS.includes('R')) {
  console.log('--- R  reference control (no model): is the harness and the site ORDER sound? ---');
  for (const goal of CASES) {
    const r = await runB({ goal, seed: 0, useReference: true });
    rows.push(r); save();
    const inter = r.steps.map((s) => (s.loads_after ? 'L' : 'x') + (s.old_regression_after ? 'R' : '-')).join(' ');
    console.log('  goal ' + goal + '  steps ' + r.steps_completed + '/' + r.sites_total
      + '  intermediates [' + inter + ']  old=' + r.final_old_regression + '  delta=' + r.final_new_delta
      + '  ' + (r.verified ? 'REFERENCE_CONTROL_OK' : 'CONTROL BROKEN: ' + r.why));
  }
  console.log('');
}

for (const goal of CASES) {
  for (const cond of CONDS.filter((x) => x !== 'R')) {
    console.log('--- ' + cond + '  goal ' + goal + ' ---');
    for (const seed of SEEDS) {
      const r = cond === 'A' ? await runA({ goal, seed }) : await runB({ goal, seed, useReference: false });
      rows.push(r); save();
      const detail = cond === 'B'
        ? 'sites ' + r.steps_completed + '/' + r.sites_total
        : String(r.steps[0] && r.steps[0].eval_count) + 'tok/' + String(r.steps[0] && r.steps[0].done_reason);
      console.log('  [' + cond + ' g' + goal + ' s' + String(seed).padEnd(2) + '] ' + detail.padEnd(18)
        + ' loads=' + String(r.final_loads).padEnd(5) + ' old=' + String(r.final_old_regression).padEnd(5)
        + ' delta=' + String(r.final_new_delta).padEnd(5)
        + (r.verified ? ' VERIFIED' : ' ' + String(r.why).slice(0, 70)));
    }
    console.log('');
  }
}

console.log('===== FEASIBILITY SUMMARY =====');
for (const goal of CASES) {
  for (const cond of ['A_instruction_only', 'B_oracle_localized_insertion']) {
    const r = rows.filter((x) => x.goal === goal && x.condition === cond);
    if (!r.length) continue;
    console.log('  goal ' + goal + '  ' + cond.padEnd(30)
      + ' loads ' + r.filter((x) => x.final_loads).length + '/' + r.length
      + '   OLD KEPT ' + r.filter((x) => x.final_old_regression).length + '/' + r.length
      + '   NEW DELTA ' + r.filter((x) => x.final_new_delta).length + '/' + r.length
      + '   VERIFIED ' + r.filter((x) => x.verified).length + '/' + r.length);
  }
}
// The gating warning must only fire when R was actually REQUESTED. Running CONDS=A printed
// "reference control: 0/0 <-- READ NOTHING ELSE UNTIL FIXED", which looks like a failed control rather
// than an un-requested one - a scary message with no defect behind it is its own kind of wrong.
const ctl = rows.filter((x) => x.condition === 'R_reference_control');
if (!CONDS.includes('R')) {
  console.log('\n  reference control: not requested in this run (CONDS=' + CONDS.join(',') + ')');
} else {
  console.log('\n  reference control: ' + ctl.filter((x) => x.verified).length + '/' + ctl.length
    + (ctl.length && ctl.every((x) => x.verified) ? '  (harness and site order sound)' : '  <-- READ NOTHING ELSE UNTIL FIXED'));
}
const rb = rows.filter((x) => x.rollback);
console.log('  rollbacks byte-exact: ' + rb.filter((x) => x.restored_byte_exact).length + '/' + rb.length);
console.log('\n  RAW = ' + OUT);
