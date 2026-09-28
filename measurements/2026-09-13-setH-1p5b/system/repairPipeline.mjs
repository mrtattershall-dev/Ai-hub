// THE TYPED REPAIR PIPELINE. Built and frozen on the DEVELOPMENT set (goals 1-20).
//
//   FAILED ARTIFACT
//     -> contract validation      is the obligation itself valid?  (instrument failure => stop)
//     -> failure classification
//         deterministic class  -> mechanical patch          -> proof      NO MODEL CALL
//         missing artifact     -> generation gate for THAT file -> proof
//         localizable semantic -> native FIM insertion      -> proof
//         ambiguous / contaminated -> unresolved, never guessed
//     -> one typed retry ONLY if the proof supplied a NEW actionable failure kind
//
// A PASS IS TERMINAL. A passing specimen is never touched, never "improved". The success criterion
// fixed before any results were seen: typed repair succeeds if it recovers failures WITHOUT
// decreasing already-correct artifacts, through externally verified transformations rather than
// evaluator accommodation.
//
// CONTEXT DISCIPLINE: the model never receives more than the classifier can justify. A missing
// export costs zero tokens. A dead reference becomes a generation task for the missing file, not the
// broken caller plus the repository. A missing member becomes FIM prefix/suffix around one insertion
// point - never a prose instruction to reproduce the file, which is what made the old whole-file
// gate echo its input byte-identically on 8 of 10 goals.
import { classifyFailure, repairMissingExport, repairMissingRequire, fimSpanForMember } from './repairGates.mjs';
import { checkContract } from './contractCheck.mjs';
import { renderForPrompt } from './contract.mjs';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.GATE_BASE || 'http://127.0.0.1:11434';
const MODEL = process.env.GATE_MODEL || 'qwen2.5-coder:1.5b';
const F = String.fromCharCode(96, 96, 96);
const DECODE = { temperature: 0.7, top_p: 0.8, top_k: 20, repeat_penalty: 1.1, repeat_last_n: 64, num_predict: 600 };
const TAG = { js: 'javascript', py: 'python', web: 'html', md: 'markdown' };

// FIM goes through /api/generate with prompt+suffix - the model's native insert capability.
async function fim(prefix, suffix) {
  const r = await fetch(BASE + '/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: prefix, suffix, stream: false, options: DECODE }),
    signal: AbortSignal.timeout(600000),
  });
  const j = await r.json();
  return String(j.response || '');
}

async function chat(prompt) {
  const r = await fetch(BASE + '/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, stream: false,
      options: Object.assign({}, DECODE, { num_predict: 2500 }),
      messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(900000),
  });
  const j = await r.json();
  return String((j && j.message && j.message.content) || '');
}

const extractBody = (reply) => {
  const m = reply.match(new RegExp(F + '[a-zA-Z]*\\n([\\s\\S]*?)' + F));
  return m ? m[1] : '';
};

// One repair round. Returns a fully populated metric record - a repair that merely satisfies the
// structural checker must be distinguishable from one that actually fixed the code.
export async function repairOnce(ws, contract, goalText, opts = {}) {
  const file = contract.lead;
  const rec = {
    failure_kind_before: null, route: null, localization_method: null,
    prefix_chars: 0, suffix_chars: 0, fim_output_chars: 0,
    artifact_changed: false, loads_after: null, original_failure_removed: null,
    contract_pass: false, new_failure_kind: null, model_calls: 0, note: '',
  };
  const before = checkContract(ws, file, contract);
  if (before.ok) { rec.route = 'none'; rec.note = 'already passing - a pass is terminal'; rec.contract_pass = true; return rec; }

  const srcBefore = existsSync(join(ws, file)) ? readFileSync(join(ws, file), 'utf8') : '';
  const cls = classifyFailure(before, contract, srcBefore);
  rec.failure_kind_before = cls.kind;
  rec.route = cls.route;

  let patched = null;

  if (cls.route === 'deterministic') {
    rec.localization_method = 'mechanical';
    const r = cls.kind === 'missing_export'
      ? repairMissingExport(srcBefore, contract, cls.items)
      : repairMissingRequire(srcBefore, contract, cls.items);
    if (!r.ok) { rec.note = 'refused: ' + r.why; rec.route = 'refused'; return rec; }
    patched = r.src;
    rec.note = r.how;
  } else if (cls.route === 'fim_member') {
    // "Cache.delete" or "Cache.delete (owner not exported)" - only the plain form is localizable.
    const first = String(cls.items[0] || '');
    if (/\(owner not exported\)/.test(first)) {
      rec.note = 'owner is not exported - that is an export failure wearing a member mask';
      rec.route = 'unresolved';
      return rec;
    }
    const [owner, member] = first.split('.');
    const span = fimSpanForMember(srcBefore, contract, owner, member);
    if (!span.ok) { rec.note = 'could not localize: ' + span.why; rec.route = 'unresolved'; return rec; }
    rec.localization_method = 'fim:' + span.where;
    rec.prefix_chars = span.prefix.length;
    rec.suffix_chars = span.suffix.length;
    const mid = await fim(span.prefix, span.suffix);
    rec.model_calls = 1;
    rec.fim_output_chars = mid.length;
    if (!mid.trim()) { rec.note = 'FIM returned nothing'; rec.route = 'unresolved'; return rec; }
    patched = span.prefix + mid + span.suffix;
  } else if (cls.route === 'generate_artifact') {
    // The missing FILE is the task - not the caller that references it.
    const target = String(cls.items[0] || '').split(/[?#]/)[0];
    if (!target || !/^[\w.-]+\.(js|py|css|html)$/i.test(target)) {
      rec.note = 'unroutable reference: ' + target; rec.route = 'unresolved'; return rec;
    }
    rec.localization_method = 'generate:' + target;
    const lang = target.endsWith('.py') ? 'py' : (target.endsWith('.js') ? 'js' : 'web');
    const prompt = goalText
      + '\n\nWrite ONLY the file ' + target + ', which the page above references and which does not exist yet.'
      + '\n\nReply with the file contents in one ' + (TAG[lang] || '') + ' code block and nothing else:\n\n'
      + F + (TAG[lang] || '') + '\n<the complete file>\n' + F;
    const reply = await chat(prompt);
    rec.model_calls = 1;
    const body = extractBody(reply);
    rec.fim_output_chars = body.length;
    if (body.trim().length < 20) { rec.note = 'generation produced no body'; rec.route = 'unresolved'; return rec; }
    writeFileSync(join(ws, target), body, 'utf8');
    rec.artifact_changed = true;
    const after = checkContract(ws, file, contract);
    rec.loads_after = after.loads;
    rec.contract_pass = after.ok;
    rec.new_failure_kind = after.ok ? null : after.reasons.map((x) => x.kind).join(',');
    rec.original_failure_removed = !after.reasons.some((x) => x.kind === 'dead_ref');
    rec.note = 'generated the missing artifact ' + target;
    return rec;
  } else {
    rec.note = 'no repair route for ' + cls.kind + ' (' + cls.route + ')';
    return rec;
  }

  if (patched === null || patched === srcBefore) {
    rec.note = rec.note || 'patch produced no change';
    return rec;
  }
  writeFileSync(join(ws, file), patched, 'utf8');
  rec.artifact_changed = true;
  const after = checkContract(ws, file, contract);
  rec.loads_after = after.loads;
  rec.contract_pass = after.ok;
  const kindsAfter = after.reasons.map((x) => x.kind);
  rec.new_failure_kind = after.ok ? null : kindsAfter.join(',');
  rec.original_failure_removed = !kindsAfter.includes(
    cls.kind === 'missing_require' ? 'load_error' : cls.kind);
  // A repair that breaks the file is rolled back. Repair must never make an artifact worse.
  if (!after.ok && before.loads && !after.loads) {
    writeFileSync(join(ws, file), srcBefore, 'utf8');
    rec.note += ' | ROLLED BACK: the patch stopped the file loading';
    rec.artifact_changed = false;
    rec.contract_pass = false;
  }
  return rec;
}

// The full pipeline: at most one typed retry, and only when the first round produced a DIFFERENT
// actionable failure kind. Repeating a round that produced the same kind is the "try again" strategy
// this model is measurably bad at.
export async function repairPipeline(ws, contract, goalText) {
  const rounds = [];
  let r = await repairOnce(ws, contract, goalText);
  rounds.push(r);
  if (!r.contract_pass && r.artifact_changed && r.new_failure_kind && r.new_failure_kind !== r.failure_kind_before) {
    const r2 = await repairOnce(ws, contract, goalText);
    r2.note = 'typed retry on a new failure kind: ' + r.new_failure_kind + ' | ' + r2.note;
    rounds.push(r2);
  }
  const last = rounds[rounds.length - 1];
  return {
    rounds,
    contract_pass: last.contract_pass,
    model_calls: rounds.reduce((s, x) => s + x.model_calls, 0),
    routes: rounds.map((x) => x.route).join('->'),
  };
}
