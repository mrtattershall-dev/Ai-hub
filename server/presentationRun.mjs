#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// presentationRun.mjs — PRESENTATION-1. One page, one condition, one call.
//
//   node server/presentationRun.mjs --page <dir> --condition N|H|S --out <run.json>
//
// Frozen definition: ../PRESENTATION-1_DEFINITION.md (amended once, before any run).
//
// ALL THREE CONDITIONS ARE SENT WITH `raw: true`, carrying the exact wire bytes the audit serialized.
// Nothing is left to the host template to assemble, so "did this condition receive the frozen bytes"
// is answerable from the record rather than assumed: the sha of what was sent is stored.
//
// THE OUTCOME IS DECOMPOSED, because a pass/fail count erases the finding. The feasibility probe bound
// a handler to a control it never created - identical to "wrote nothing" under a binary rate, and a
// completely different fact about the model.
//
//   1 localLogic      referenced the page's OWN identifiers correctly
//   2 featureBuilt    CREATED the control and WIRED it
//   3 accepted        passed the full gate through the same acceptance path as every other experiment
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const git = (ws, args) => exec('git', ['-C', ws, ...args], { windowsHide: true });
const sha = (t) => createHash('sha256').update(t).digest('hex');
const sha16 = (t) => sha(t).slice(0, 16);
const NL = String.fromCharCode(10);

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const PAGE = opt('page', null);
const COND = opt('condition', 'N');
const NAME = opt('name', 'baseline-as-delivered.html');
const OUT = opt('out', null);
const MODEL = opt('model', 'qwen2.5-coder:1.5b');
const MODEL_URL = opt('model-url', 'http://127.0.0.1:11434').replace(/\/$/, '');
const SEED = parseInt(opt('seed', '1'), 10);
const CORPUS = opt('corpus', OUT ? OUT.replace(/\.json$/, '') + '.attempts' : null);
if (!PAGE) { console.error('usage: node server/presentationRun.mjs --page <dir> --condition N|H|S'); process.exit(2); }

const DECODING = Object.freeze({ temperature: 0.2, num_predict: 400, seed: SEED });

const T0 = Date.now();
const { evaluate } = await import('./evaluator.js');
const { applyAcceptance } = await import('./acceptance.js');
const { playCheck } = await import('./playCheck.js');
const { judgeCandidate } = await import('./judgeCandidate.mjs');
const { judgeAndDecide, shouldRetain } = await import('./retainPath.mjs');
const { classifyAttempt, preserveAttempt } = await import('./attemptRecord.mjs');
const { containToSlot } = await import('./localEdit.mjs');
const { topLevelFunctions } = await import('./editPlanner.mjs');

const page = readFileSync(join(PAGE, NAME), 'utf8');
const task = JSON.parse(readFileSync(join(PAGE, 'task.json'), 'utf8'));
const spec = task.diagnostic.spec;
const ENTRY = spec.entry || 'index.html';
const r = task.requirement;
const CONTROL = r.trigger.selector;
const CONTROL_ID = CONTROL.replace(/^#/, '');
const INTENT = `Add a control ${CONTROL}. Clicking it: ${r.effects.join('; ')}. ${(r.invariants || []).join('. ')}.`;

// ── THE THREE WIRES. Constructed here exactly as the audit serializes them; the shas are recorded so
// drift between the two files is detectable rather than silent.
const at = page.lastIndexOf('</script>');
const CODE_PREFIX = page.slice(0, at).replace(/\s+$/, '') + NL;
const SUFFIX = NL + page.slice(at);
const COMMENT_BLOCK = `        // ${INTENT}${NL}        // Continue here:${NL}`;
const FIM_PRE = '<|fim_prefix|>', FIM_SUF = '<|fim_suffix|>', FIM_MID = '<|fim_middle|>';
const IM_S = '<|im_start|>', IM_E = '<|im_end|>';

const WIRES = {
  N: FIM_PRE + CODE_PREFIX + COMMENT_BLOCK + FIM_SUF + SUFFIX + FIM_MID,
  H: IM_S + 'system' + NL + 'You are completing code.' + IM_E + NL
    + FIM_PRE + CODE_PREFIX + COMMENT_BLOCK + FIM_SUF + SUFFIX + FIM_MID,
  S: IM_S + 'system' + NL + INTENT + IM_E + NL
    + FIM_PRE + CODE_PREFIX + FIM_SUF + SUFFIX + FIM_MID,
};
const wire = WIRES[COND];
if (!wire) { console.error(`unknown condition ${COND}`); process.exit(2); }

/** Did it use the page's OWN names, rather than inventing its own world? */
function localLogic(text) {
  const fns = topLevelFunctions(page).map((f) => f.name);
  const vars = [...page.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1]);
  const own = [...new Set([...fns, ...vars])].filter((n) => n.length > 2);
  const used = own.filter((n) => new RegExp(`(?:^|[^.\\w$])${n}(?:[^\\w$]|$)`).test(text));
  return { own, used, ok: used.length > 0 };
}

/** Did it CREATE the control and WIRE it? Creating without wiring, or wiring without creating, is not it. */
function featureBuilt(text) {
  const creates = new RegExp(`createElement|insertAdjacentHTML|innerHTML`).test(text)
    && new RegExp(`['"\`]${CONTROL_ID}['"\`]|id\\s*=\\s*["'\`]?${CONTROL_ID}`).test(text);
  const wires = new RegExp(`addEventListener|onclick`, 'i').test(text);
  return { creates, wires, ok: creates && wires };
}

async function generate() {
  const t0 = Date.now();
  const res = await fetch(`${MODEL_URL}/api/generate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: wire, raw: true, stream: false, options: DECODING }),
  });
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}`, ms: Date.now() - t0 };
  const j = await res.json();
  return { ok: true, text: String(j.response || ''), ms: Date.now() - t0, outTok: j.eval_count ?? null, promptTok: j.prompt_eval_count ?? null, doneReason: j.done_reason };
}

const out = {
  status: 'INTERRUPTED', at: new Date().toISOString(), experiment: 'PRESENTATION-1',
  condition: COND, conditionName: { N: 'native-FIM / inline-comment intent', H: 'front-loaded hybrid wrapper / inline-comment intent', S: 'front-loaded hybrid wrapper / separated intent' }[COND],
  page: PAGE, task: task.id, model: MODEL, seed: SEED, decoding: DECODING,
  // Answers "did this condition receive the frozen bytes" from the record.
  wireSha: sha16(wire), wireBytes: wire.length, codePrefixSha: sha16(CODE_PREFIX), suffixSha: sha16(SUFFIX),
  attempts: [], accepted: false, calls: 0,
};

const gen = await generate();
out.calls = 1;
if (!gen.ok) { out.error = gen.reason; } else {
  const rec = {
    round: 1, seed: SEED, generationMs: gen.ms, outputTokens: gen.outTok, promptTokens: gen.promptTok, doneReason: gen.doneReason,
    rawCompletion: { text: gen.text.slice(0, 6000), chars: gen.text.length, lines: gen.text.split(NL).length },
    boundaries: {}, timing: {},
  };
  const ll = localLogic(gen.text);
  const fb = featureBuilt(gen.text);
  rec.outcomes = { localLogic: ll.ok, localNamesUsed: ll.used, featureBuilt: fb.ok, createsControl: fb.creates, wiresHandler: fb.wires };

  const contained = containToSlot(gen.text, { maxLines: 20, allowListener: true });
  rec.containment = contained;
  let candidate = null;
  if (contained.ok) {
    rec.transformedCandidate = { text: contained.text, chars: contained.text.length, lines: contained.text.split(NL).length };
    candidate = CODE_PREFIX + (COND === 'S' ? '' : COMMENT_BLOCK) + contained.text + SUFFIX;
  } else rec.outcome = `REFUSED_${contained.reason}`;

  if (candidate) {
    const ws = mkdtempSync(join(tmpdir(), 'pres-'));
    try {
      writeFileSync(join(ws, ENTRY), page, 'utf8');
      await git(ws, ['init', '-q']); await git(ws, ['config', 'core.autocrlf', 'false']);
      await git(ws, ['add', '-A']);
      await git(ws, ['-c', 'user.email=m@m', '-c', 'user.name=m', 'commit', '-q', '-m', 'start']);
      const startRef = (await git(ws, ['rev-parse', 'HEAD'])).stdout.trim();
      writeFileSync(join(ws, ENTRY), candidate.endsWith(NL) ? candidate : candidate + NL, 'utf8');
      await git(ws, ['add', '-A']);
      await git(ws, ['-c', 'user.email=m@m', '-c', 'user.name=m', 'commit', '-q', '-m', 'candidate']).catch((e) => {
        if (!/nothing to commit/i.test(String(e.stdout || '') + String(e.stderr || ''))) throw e;
      });
      const decision = await judgeAndDecide({ ws, task, spec, startRef, rec, T0, deps: { judgeCandidate, playCheck, evaluate, applyAcceptance } });
      rec.candidateSha = sha(candidate);
      if (shouldRetain(decision)) out.accepted = true;
    } finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
  }
  rec.outcomes.accepted = out.accepted;
  rec.classification = classifyAttempt(task, rec);
  if (CORPUS) rec.preserved = preserveAttempt(CORPUS, rec, { candidate, rawFull: gen.text, prompt: wire, suffix: '', proposal: null, classification: rec.classification });
  out.attempts.push(rec);
  const tag = out.accepted ? 'ACCEPTED' : (rec.outcome || 'REJECTED');
  console.log(`  ${COND}  ${tag.padEnd(28)} local:${ll.ok ? 'y' : 'n'} built:${fb.ok ? 'y' : 'n'}(create:${fb.creates ? 'y' : 'n'} wire:${fb.wires ? 'y' : 'n'})  ${gen.outTok || 0}tok`);
}

out.status = 'COMPLETE';
const a = out.attempts[0] || {};
out.totals = {
  accepted: out.accepted ? 1 : 0,
  outcome: a.outcome || (out.accepted ? 'ACCEPTED' : 'REJECTED'),
  outcomes: a.outcomes || null,
  outputTokens: a.outputTokens || 0,
  generationSeconds: +((a.generationMs || 0) / 1000).toFixed(1),
  wallClockSeconds: +((Date.now() - T0) / 1000).toFixed(1),
  corpus: CORPUS,
};
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
