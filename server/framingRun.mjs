#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// framingRun.mjs — SUPPRESSION-1 arms A, B and C. Same weights, same task, different ROLE.
//
//   node server/framingRun.mjs --dir <page dir> --arm chat|operator|contract --out <run.json>
//
// Frozen definition: ../SUPPRESSION-1_DEFINITION.md. Arm D is `managerRun.mjs`, unchanged.
//
//   A chat      a chat assistant: explain how to do this, or give the updated page
//   B operator  "you may make this change", with a declared edit_file(path, contents) tool contract
//   C contract  return only the lines to insert at this exact point - declared target, output shape
//               and success criterion, and NOTHING else: no observation selection, no extracted facts,
//               no renderer guidance, no gate feedback, no retries, no retention
//
// A -> B VARIES ROLE AND TOOL CONTRACT ONLY. Same page, same requirement words, same output shape, same
// extractor. C changes the output shape, which is why only A-vs-B and C-vs-D are clean contrasts and the
// cross-boundary comparison is descriptive.
//
// TWO OUTCOMES THIS EXPERIMENT EXISTS TO COUNT, and neither is a coding failure:
//   DECLINED_TO_ACT        it answered with advice where an artifact was asked for. This is the
//                          behaviour under study, not noise, so it is never folded into "empty".
//   NO_EXTRACTABLE_CHANGE  it produced something the DECLARED extractor cannot apply. An interface
//                          outcome, for the same reason OUTPUT_CAP_EXHAUSTED is a capacity outcome.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const git = (ws, args) => exec('git', ['-C', ws, ...args], { windowsHide: true });
const sha = (t) => createHash('sha256').update(t).digest('hex');
const NL = String.fromCharCode(10);

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const DIR = opt('dir', null);
const ARM = opt('arm', 'chat');
const NAME = opt('name', 'baseline-as-delivered.html');
const OUT = opt('out', null);
const MODEL = opt('model', 'qwen2.5-coder:1.5b');
const MODEL_URL = opt('model-url', 'http://127.0.0.1:11434').replace(/\/$/, '');
const TEMPERATURE = parseFloat(opt('temperature', '0.2'));
const SEED = parseInt(opt('seed', '1'), 10);
// DECLARED BEFORE THE RUN: one call per page per arm. Equal across arms, and the unit of the experiment
// is the page rather than the seed. A whole page from a 1.5B is ~150s, so three seeds across four arms
// and twelve pages is hours of wall clock for variance the design does not use.
const MAX_TOKENS = parseInt(opt('max-tokens', ARM === 'contract' ? '400' : '3000'), 10);
const CORPUS = opt('corpus', OUT ? OUT.replace(/\.json$/, '') + '.attempts' : null);
if (!DIR) { console.error('usage: node server/framingRun.mjs --dir <page dir> --arm chat|operator|contract'); process.exit(2); }

const T0 = Date.now();
const { evaluate } = await import('./evaluator.js');
const { applyAcceptance } = await import('./acceptance.js');
const { playCheck } = await import('./playCheck.js');
const { judgeCandidate } = await import('./judgeCandidate.mjs');
const { judgeAndDecide, shouldRetain } = await import('./retainPath.mjs');
const { classifyAttempt, preserveAttempt } = await import('./attemptRecord.mjs');
const { containToSlot, cutRegion } = await import('./localEdit.mjs');

const task = JSON.parse(readFileSync(join(DIR, 'task.json'), 'utf8'));
const spec = task.diagnostic.spec;
const ENTRY = spec.entry || 'index.html';
const startFile = readFileSync(join(DIR, NAME), 'utf8');

/** The requirement in ONE wording, identical across every arm. */
function requirementInWords(r) {
  const t = r.trigger || {};
  const lead = t.kind === 'click' ? `when ${t.selector} is clicked`
    : t.kind === 'type' ? `when text is typed into ${t.selector}`
      : `when the ${t.key} key is pressed`;
  let line = `${lead}: ${(r.effects || []).join('; ')}.`;
  const hard = (r.invariants || []).filter((i) => !/keeps working/i.test(i));
  if (hard.length) line += ` Ensure ${hard.join(', and ')}.`;
  return line;
}
const REQ = requirementInWords(task.requirement);

/** Where arm C's insertion goes: the end of the page's script. Declared, not planned. */
function endOfScript(file) {
  const ls = file.split(NL);
  for (let i = ls.length - 1; i >= 0; i--) if (/<\/script>/i.test(ls[i])) return i - 1;
  return ls.length - 1;
}

const FILL = '        // INSERT HERE';

function buildPrompt() {
  if (ARM === 'chat') {
    return [
      'Here is a web page.', '', startFile, '',
      `A user wants this change: ${REQ}`,
      'Everything the page already does must keep working.', '',
      'Explain how to do it, or give the updated page.',
    ].join(NL);
  }
  if (ARM === 'operator') {
    return [
      'You are operating on a local file. You may make this change yourself.', '',
      'A tool is available to you:', '',
      '  edit_file(path, contents)   replaces the whole file at `path` with `contents`', '',
      `The file is index.html and its current contents are:`, '', startFile, '',
      `Make this change: ${REQ}`,
      'Everything the page already does must keep working.', '',
      'Call the tool. Reply with exactly one call, in this form and nothing else:', '',
      'edit_file("index.html", `<!DOCTYPE html>', '...the complete updated page...', '</html>`)',
    ].join(NL);
  }
  // contract: a bounded insertion at a declared point, with the success criterion stated.
  const lines = startFile.split(NL);
  const at = endOfScript(startFile);
  const scaffolded = [...lines.slice(0, at + 1), FILL, ...lines.slice(at + 1)].join(NL);
  const cut = cutRegion(scaffolded, FILL, FILL);
  return {
    prefix: cut.prefix
      + `        // JAVASCRIPT STATEMENTS ONLY. This point is inside the page's existing <script> block.${NL}`
      + `        // ${REQ}${NL}`
      + `        // This succeeds when that holds and everything the page already did still works.${NL}`
      + `        // Continue here:${NL}`,
    suffix: cut.suffix,
  };
}

async function generate(prompt, suffix) {
  const t0 = Date.now();
  const body = { model: MODEL, prompt, stream: false, options: { temperature: TEMPERATURE, num_predict: MAX_TOKENS, seed: SEED } };
  if (suffix !== undefined) body.suffix = suffix;
  const res = await fetch(`${MODEL_URL}/api/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}`, ms: Date.now() - t0 };
  const j = await res.json();
  return { ok: true, text: String(j.response || ''), ms: Date.now() - t0, outTok: j.eval_count ?? null, promptTok: j.prompt_eval_count ?? null, doneReason: j.done_reason };
}

/** A and B share ONE declared extractor. A generous one would credit them for my parser. */
function extractWholePage(text, { fromToolCall }) {
  let t = String(text || '');
  if (fromToolCall) {
    const call = t.match(/edit_file\s*\(\s*["'`][^"'`]*["'`]\s*,\s*([`"'])([\s\S]*?)\1\s*\)/);
    if (!call) {
      const looksLikeAdvice = /<!DOCTYPE|<html/i.test(t) === false;
      return { ok: false, reason: looksLikeAdvice ? 'DECLINED_TO_ACT' : 'NO_EXTRACTABLE_CHANGE', detail: 'no edit_file call could be parsed from the reply' };
    }
    t = call[2];
  }
  const fence = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1];
  const start = t.search(/<!DOCTYPE html|<html\b/i);
  const end = t.toLowerCase().lastIndexOf('</html>');
  if (start === -1 || end === -1 || end < start) {
    // Advice is a DIFFERENT outcome from an unusable artifact, and is the behaviour under study.
    const advice = t.trim().length > 40 && !/<\/?(div|script|button|ul|li)\b/i.test(t);
    return { ok: false, reason: advice ? 'DECLINED_TO_ACT' : 'NO_EXTRACTABLE_CHANGE', detail: 'no complete page from a doctype to </html>' };
  }
  const page = t.slice(start, end + '</html>'.length);
  if (page.trim() === startFile.trim()) return { ok: false, reason: 'ECHOED_THE_INPUT', detail: 'the page came back unchanged' };
  for (const m of page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!m[1].trim()) continue;
    try { new Script(m[1]); } catch (e) { return { ok: false, reason: 'SCRIPT_DOES_NOT_PARSE', detail: String(e.message).slice(0, 120) }; }
  }
  return { ok: true, page };
}

const out = {
  status: 'INTERRUPTED', at: new Date().toISOString(), experiment: 'SUPPRESSION-1', arm: ARM,
  task: task.id, model: MODEL, page: join(DIR, NAME), baselineSha: sha(startFile),
  budget: { callsPerPage: 1, seed: SEED, maxTokens: MAX_TOKENS },
  interventionsByAPerson: 0, attempts: [], accepted: false, calls: 0,
};

const built = buildPrompt();
const isSlot = ARM === 'contract';
const gen = await generate(isSlot ? built.prefix : built, isSlot ? built.suffix : undefined);
out.calls = 1;
out.promptSha = sha(isSlot ? built.prefix : built);

if (!gen.ok) {
  out.error = gen.reason;
} else {
  const rec = {
    round: 1, seed: SEED, generationMs: gen.ms, outputTokens: gen.outTok, promptTokens: gen.promptTok, doneReason: gen.doneReason,
    rawCompletion: { text: gen.text.slice(0, 6000), chars: gen.text.length, lines: gen.text.split(NL).length },
    boundaries: {}, timing: {},
  };
  let candidate = null;
  if (isSlot) {
    const contained = containToSlot(gen.text, { maxLines: 20, allowListener: true });
    rec.containment = contained;
    if (contained.ok) {
      rec.transformedCandidate = { text: contained.text, chars: contained.text.length, lines: contained.text.split(NL).length };
      candidate = built.prefix + contained.text + built.suffix;
    } else rec.outcome = `REFUSED_${contained.reason}`;
  } else {
    const ex = extractWholePage(gen.text, { fromToolCall: ARM === 'operator' });
    rec.extraction = ex;
    if (ex.ok) { rec.transformedCandidate = { text: ex.page, chars: ex.page.length, lines: ex.page.split(NL).length }; candidate = ex.page; }
    else rec.outcome = `REFUSED_${ex.reason}`;
  }

  if (candidate) {
    const ws = mkdtempSync(join(tmpdir(), 'sup-'));
    try {
      writeFileSync(join(ws, ENTRY), startFile, 'utf8');
      await git(ws, ['init', '-q']); await git(ws, ['config', 'core.autocrlf', 'false']);
      await git(ws, ['add', '-A']);
      await git(ws, ['-c', 'user.email=m@m', '-c', 'user.name=m', 'commit', '-q', '-m', 'start']);
      const startRef = (await git(ws, ['rev-parse', 'HEAD'])).stdout.trim();
      writeFileSync(join(ws, ENTRY), candidate.endsWith(NL) ? candidate : candidate + NL, 'utf8');
      await git(ws, ['add', '-A']);
      await git(ws, ['-c', 'user.email=m@m', '-c', 'user.name=m', 'commit', '-q', '-m', 'candidate']).catch((e) => {
        if (!/nothing to commit/i.test(String(e.stdout || '') + String(e.stderr || ''))) throw e;
      });
      // THE SAME RETAIN PATH every other arm uses. The arms differ in how a candidate is produced and
      // in nothing about how it is judged.
      const decision = await judgeAndDecide({ ws, task, spec, startRef, rec, T0, deps: { judgeCandidate, playCheck, evaluate, applyAcceptance } });
      rec.candidateSha = sha(candidate);
      if (shouldRetain(decision)) out.accepted = true;
    } finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
  }
  rec.classification = classifyAttempt(task, rec);
  if (CORPUS) rec.preserved = preserveAttempt(CORPUS, rec, { candidate, rawFull: gen.text, prompt: isSlot ? built.prefix : built, suffix: isSlot ? built.suffix : '', proposal: null, classification: rec.classification });
  out.attempts.push(rec);
  console.log(`  ${ARM.padEnd(9)} ${rec.outcome || (out.accepted ? 'ACCEPTED' : 'REJECTED')}  ${gen.outTok || '?'} tok  ${(gen.ms / 1000).toFixed(0)}s`);
}

out.status = 'COMPLETE';
const a = out.attempts[0] || {};
out.totals = {
  accepted: out.accepted ? 1 : 0,
  declinedToAct: a.outcome === 'REFUSED_DECLINED_TO_ACT' ? 1 : 0,
  noExtractableChange: a.outcome === 'REFUSED_NO_EXTRACTABLE_CHANGE' ? 1 : 0,
  echoed: a.outcome === 'REFUSED_ECHOED_THE_INPUT' ? 1 : 0,
  outcome: a.outcome || (out.accepted ? 'ACCEPTED' : 'REJECTED'),
  mismatch: a.classification ? { [a.classification.mismatch]: 1 } : {},
  outputTokens: a.outputTokens || 0,
  generationSeconds: +((a.generationMs || 0) / 1000).toFixed(1),
  wallClockSeconds: +((Date.now() - T0) / 1000).toFixed(1),
  corpus: CORPUS,
};
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
