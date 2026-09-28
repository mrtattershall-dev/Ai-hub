// THE TWO ARMS, sharing one evaluator.
//
//   v1  whole-file / content-oriented generation            + v1-style repair
//   v2  operation-specific FIM-first generation where safe  + dependency firewall + typed repair
//
// THE EVALUATOR IS NOT PART OF THE INTERVENTION. Both arms are scored by the same contract checker,
// the same execution isolation and the same behavioural oracles. Only GENERATION and REPAIR differ.
// Scoring v1 with its historical checker would confound the architecture comparison with two
// evaluator bugs that were since fixed (the runtime .name export asymmetry and the html class check
// that ignored referenced scripts) - both of which rejected correct work.
//
// v2 PRINCIPLE: v1 removed orchestration burden; v2 additionally removes unnecessary EDIT SURFACE
// wherever localization can be PROVEN safe. FIM utilisation is not maximised - a false-negative
// localization costs a fallback, a false-positive can surgically corrupt the wrong code while
// looking clean. When uncertain, fall back.
import { deriveContract, renderForPrompt } from './contract.mjs';
import { checkContract } from './contractCheck.mjs';
import { planOperation, editSurface } from './operation.mjs';
import { spanAddMethod, spanAddFunction } from './fimspan.mjs';
import { validateSpanShape, auditLocalizedEdit } from './spanSafety.mjs';
import { firewall, loadSideEffects } from './deps.mjs';
import { classifyFailure, repairMissingExport, repairMissingRequire } from './repairGates.mjs';
import { probeFor } from './probes.mjs';
import { runBrowserProbe } from './probeBrowser.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.GATE_BASE || 'http://127.0.0.1:11434';
const MODEL = process.env.GATE_MODEL || 'qwen2.5-coder:1.5b';
const F = String.fromCharCode(96, 96, 96);
const DECODE = { temperature: 0.7, top_p: 0.8, top_k: 20, repeat_penalty: 1.1, repeat_last_n: 64 };
const NPRED_FILE = 2500;
const NPRED_FIM = 600;
const TAG = { js: 'javascript', py: 'python', web: 'html', md: 'markdown' };

async function chat(prompt) {
  const r = await fetch(BASE + '/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, stream: false,
      options: Object.assign({}, DECODE, { num_predict: NPRED_FILE }),
      messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(900000),
  });
  const j = await r.json();
  return String((j && j.message && j.message.content) || '');
}

// FIM goes through /api/generate with prompt(prefix)+suffix - the model's native insert capability.
async function fim(prefix, suffix) {
  const r = await fetch(BASE + '/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: prefix, suffix, stream: false,
      options: Object.assign({}, DECODE, { num_predict: NPRED_FIM }) }),
    signal: AbortSignal.timeout(600000),
  });
  const j = await r.json();
  return String(j.response || '');
}

const extractBody = (reply) => {
  const m = reply.match(new RegExp(F + '[a-zA-Z]*\\n([\\s\\S]*?)' + F));
  return m ? m[1] : '';
};

const wholeFilePrompt = (goalText, c) => {
  const req = renderForPrompt(c);
  return goalText + '\n\nWrite the WHOLE file. It must load without errors.' + (req ? ' ' + req : '')
    + '\n\nThe file is ' + c.lead + '. It will be written for you.'
    + '\n\nReply with the file contents in one ' + TAG[c.lang] + ' code block and nothing else:\n\n'
    + F + (TAG[c.lang] || '') + '\n<the complete file>\n' + F;
};

// ---------------------------------------------------------------------------------------------
// GENERATION
// ---------------------------------------------------------------------------------------------
async function generate(arm, ws, c, goalText, rec) {
  const path = join(ws, c.lead);
  const before = existsSync(path) ? readFileSync(path, 'utf8') : '';
  rec.bytes_before = before.length;

  if (arm === 'v1') {
    rec.operation = 'whole_file';
    rec.stratum = 'WHOLE_FILE_FALLBACK';
    const reply = await chat(wholeFilePrompt(goalText, c));
    rec.model_calls++;
    const body = extractBody(reply);
    return { raw: reply, candidate: body, before, localized: false };
  }

  // --- v2: choose granularity from the typed contract plus the CURRENT artifact state.
  const plan = planOperation(c, ws, goalText);
  rec.operation = plan.op;
  rec.fallback_reason = plan.fallbackReason || null;
  const localizable = plan.op === 'add_method' || plan.op === 'add_function';
  rec.stratum = localizable ? 'FIM_ELIGIBLE' : 'WHOLE_FILE_FALLBACK';

  if (!localizable) {
    const reply = await chat(wholeFilePrompt(goalText, c));
    rec.model_calls++;
    return { raw: reply, candidate: extractBody(reply), before, localized: false };
  }

  // 1. SPAN VALIDITY, from source alone, before any generation.
  const target = plan.op === 'add_method'
    ? { op: 'add_method', owner: plan.owner, member: plan.members[0].name, lang: c.lang }
    : { op: 'add_function', fn: plan.fn, lang: c.lang };
  const shape = validateSpanShape(before, target);
  if (!shape.ok) {
    rec.stratum = 'WHOLE_FILE_FALLBACK';
    rec.fallback_reason = 'LOCALIZATION_FAILED';
    rec.note = 'span invalid: ' + shape.problems.join('; ');
    const reply = await chat(wholeFilePrompt(goalText, c));
    rec.model_calls++;
    return { raw: reply, candidate: extractBody(reply), before, localized: false };
  }

  const span = plan.op === 'add_method'
    ? spanAddMethod(before, c.lang, plan.owner, plan.members[0].name)
    : spanAddFunction(before, c.lang, plan.fn);
  if (!span.ok) {
    rec.stratum = 'WHOLE_FILE_FALLBACK';
    rec.fallback_reason = 'LOCALIZATION_FAILED';
    rec.note = 'span not locatable: ' + span.why;
    const reply = await chat(wholeFilePrompt(goalText, c));
    rec.model_calls++;
    return { raw: reply, candidate: extractBody(reply), before, localized: false };
  }

  rec.fim_prefix_bytes = span.prefix.length;
  rec.fim_suffix_bytes = span.suffix.length;
  rec.localization = plan.op + ':' + span.where;
  const mid = await fim(span.prefix, span.suffix);
  rec.model_calls++;
  rec.fim_output_bytes = mid.length;
  if (!mid.trim()) {
    rec.note = 'FIM returned nothing';
    return { raw: mid, candidate: '', before, localized: true, span };
  }
  const candidate = span.prefix + mid + span.suffix;

  // 2. PRESERVATION + STRUCTURAL SAFETY. A localized edit that damages anything outside its
  //    authorized span is discarded - NOT written and then repaired.
  const audit = auditLocalizedEdit({
    before, after: candidate, op: plan.op, lang: c.lang,
    span: { prefixOriginal: span.origPrefix, suffixOriginal: span.origSuffix },
  });
  rec.authorized_span_bytes = audit.metrics.authorized_span_bytes;
  rec.deleted_bytes = audit.metrics.deleted_bytes;
  rec.outside_span_changed = audit.metrics.outside_span_changed;
  rec.lost_symbols = audit.metrics.lost_symbols;
  if (!audit.ok) {
    rec.note = 'span safety REJECTED the localized edit: ' + audit.problems.join('; ');
    rec.span_safety_rejected = true;
    return { raw: mid, candidate: '', before, localized: true, span };
  }
  return { raw: mid, candidate, before, localized: true, span };
}

// ---------------------------------------------------------------------------------------------
// ONE GOAL, END TO END
// ---------------------------------------------------------------------------------------------
export async function runGoal({ arm, ws, goalIndex, goals }) {
  const goalText = goals[goalIndex];
  const c = deriveContract(goalText);
  const rec = {
    goal: goalIndex + 1, arm, lead: c.lead, operation: null, stratum: null, fallback_reason: null,
    body_present: false, parser_accepted: false, load_success: null,
    contract_pass: false, behavioral_probe: null, behavioral_pass: null,
    failure_kind: null, firewall_violations: [], side_effects: [],
    files_touched: 0, bytes_before: 0, bytes_after: 0, lines_added: 0, lines_removed: 0,
    rewrote_whole_file: false, localization: null,
    fim_prefix_bytes: 0, fim_suffix_bytes: 0, fim_output_bytes: 0,
    authorized_span_bytes: 0, deleted_bytes: 0, outside_span_changed: false, lost_symbols: [],
    span_safety_rejected: false,
    repair_attempted: false, repair_route: null, repair_success: false,
    model_calls: 0, regression: false, verified_goal_pass: false, note: '',
    raw_reply: '', candidate_bytes: '',
  };

  let g;
  try {
    g = await generate(arm, ws, c, goalText, rec);
  } catch (e) {
    rec.note = 'generation threw: ' + String(e.message).slice(0, 90);
    return rec;
  }
  rec.raw_reply = g.raw;
  rec.candidate_bytes = g.candidate;
  rec.body_present = String(g.candidate || '').trim().length >= 20;
  rec.parser_accepted = rec.body_present;
  if (!rec.body_present) {
    rec.failure_kind = rec.span_safety_rejected ? 'span_safety_rejected' : 'no_body';
    return rec;
  }

  // --- DEPENDENCY FIREWALL (v2 only). A newly invented unresolved import does NOT justify
  //     generating that dependency - it is removed by rejecting the candidate, never institutionalised.
  if (arm === 'v2') {
    const fw = firewall({ candidate: g.candidate, original: g.before, lang: c.lang, ws, goalText, contract: c });
    rec.firewall_violations = fw.violations.map((v) => v.cls + ':' + v.name);
    rec.side_effects = loadSideEffects(g.candidate, c.lang).map((s) => s.kind);
    if (!fw.ok) {
      rec.failure_kind = 'dependency_firewall';
      rec.note = 'rejected before writing: ' + rec.firewall_violations.join(', ');
      return rec;
    }
  }

  writeFileSync(join(ws, c.lead), g.candidate.replace(/^﻿/, ''), 'utf8');
  rec.files_touched = 1;
  const surface = editSurface(g.before, g.candidate);
  rec.bytes_after = surface.bytes_after;
  rec.lines_added = surface.lines_added;
  rec.lines_removed = surface.lines_removed;
  rec.rewrote_whole_file = surface.rewrote_whole_file;

  // --- ISOLATED EXECUTION + STRUCTURAL CONTRACT
  let chk = checkContract(ws, c.lead, c);
  rec.load_success = chk.loads;
  rec.contract_pass = chk.ok;
  rec.failure_kind = chk.ok ? null : chk.reasons.map((x) => x.kind).join(',');

  // --- TYPED REPAIR
  if (!chk.ok) {
    const cls = classifyFailure(chk, c, g.candidate);
    rec.repair_attempted = true;
    rec.repair_route = cls.route;
    if (cls.route === 'deterministic') {
      const src = readFileSync(join(ws, c.lead), 'utf8');
      const r = cls.kind === 'missing_export'
        ? repairMissingExport(src, c, cls.items)
        : repairMissingRequire(src, c, cls.items);
      if (r.ok) {
        writeFileSync(join(ws, c.lead), r.src, 'utf8');
        const after = checkContract(ws, c.lead, c);
        if (after.ok) { rec.repair_success = true; rec.contract_pass = true; rec.failure_kind = null; chk = after; }
        else { writeFileSync(join(ws, c.lead), src, 'utf8'); rec.note += ' | repair did not resolve it, rolled back'; }
      } else rec.note += ' | repair refused: ' + r.why;
    } else {
      rec.note += ' | no repair route for ' + cls.kind;
    }
  }

  // --- BEHAVIOURAL ORACLE, where one exists. A behavioural goal must NOT pass on loadability.
  const probe = probeFor(goalIndex + 1);
  if (probe) {
    rec.behavioral_probe = probe.id;
    try {
      const pr = probe.browser ? await runBrowserProbe(probe, ws) : probe.run(ws);
      rec.behavioral_pass = pr.pass;
      if (!pr.pass) rec.note += ' | probe: ' + String(pr.why).slice(0, 90);
    } catch (e) {
      rec.behavioral_pass = false;
      rec.note += ' | probe threw: ' + String(e.message).slice(0, 70);
    }
  }

  // VERIFIED_GOAL_PASS = structural obligations AND the behavioural oracle when the goal has one.
  rec.verified_goal_pass = rec.contract_pass && (rec.behavioral_pass === null || rec.behavioral_pass === true);
  return rec;
}
