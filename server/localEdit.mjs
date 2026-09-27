/**
 * localEdit.mjs - THE LOCALIZED EDIT PROTOCOL: extend an existing accepted file by asking for a
 * bounded edit, not a replacement file.
 *
 *   node server/localEdit.mjs --model-url http://127.0.0.1:11434 --model qwen2.5-coder:1.5b \
 *     --task farm-i2 --workspace <dir with the accepted index.html> \
 *     --protocol anchor|fim [--seed 1] [--deadline-sec 900] [--out result.json]
 *
 * WHY IT EXISTS. INC2-1: handed its own accepted increment-1 page and asked to return the
 * complete new version, the local 1.5B returned the SAME FILE on all five seeds - three
 * byte-identical, two differing by one trailing newline, 901 output tokens every time. Written
 * from scratch instead, with the same instruction, it produced new code 3 of 3 and reached
 * planting once. So the obstacle to "keeps building" sits at the generation interface for a
 * later increment, not obviously at the model's ability to write the feature.
 *
 * WHAT IS HELD IDENTICAL to INC2-1: the model, the machine, the task and its increments, the
 * starting file (the accepted increment-1 page), the declared play, the protected spec, the
 * independent evaluator and the acceptance policy - the last three through the SHARED
 * judgeCandidate, not a copy of it. The ONLY change is what the model is asked to emit.
 *
 * TWO PROTOCOLS, differing in ONE thing: who chooses where the edit goes.
 *
 *   anchor  the MODEL chooses. It emits FIND/REPLACE blocks; the harness applies them only on an
 *           exact, unique match. No fuzzy matching, ever - a near-match is a refusal, because a
 *           tolerant matcher that splices at the model's indentation is a known way to destroy
 *           working code.
 *   fim     the HARNESS chooses. A named region of the file is cut out and the model fills the
 *           hole (prefix/suffix infilling, which is native to this model family). The region and
 *           the instruction comment are recorded verbatim in the result: this cell measures the
 *           model PLUS that assistance, and must never be reported as autonomous decomposition.
 *
 * WHAT IS MEASURED, as separate boundaries:
 *
 *   E1 editProduced      the reply parses into at least one well-formed edit
 *   E1b editContractClean  nothing outside the edit blocks (the protocol's own rule)
 *   E2 editApplicable    every FIND matched the file exactly once (anchor); a non-empty
 *                        completion arrived (fim)
 *   E3 editApplied       the harness wrote the edited file
 *   E1c editInsertsNonComment  the edit inserts something other than comments and blank lines.
 *                        Four of five infills over a five-line hole filled the 4,000-token ceiling
 *                        with one self-contradictory comment repeated and no statement at all, so
 *                        "a non-empty completion arrived" is not enough to call an edit produced.
 *                        This does NOT establish that the insertion is JavaScript - see
 *                        nonCommentContent's own note.
 *   E2b editIsLocalized   no block claims the whole file (or even half of it). The first anchor
 *                        run obeyed the FORMAT and defeated its PURPOSE: every attempt copied the
 *                        entire file into FIND and replaced it with a few characters, so the
 *                        "edit" deleted the page. A protocol can be followed and still not be
 *                        used, and that has to be visible as its own boundary.
 *   E4 changedProgram    the result DIFFERS from the starting file - INC2-1's failure was here.
 *                        A deletion changes the program too: read E4 with E2b and E6.
 *   E5 reachedExecution  the page loaded and the play produced verdicts
 *   E6 passedProtected   movement and the existing behaviour still pass (steps 1-3)
 *   E7 passedDiagnostic  planting and growth work too (steps 1-5)
 *   E8 accepted          the acceptance policy said RETAIN
 *
 * E6 and E7 are deliberately apart: "did not break what worked" and "added what was asked" are
 * different claims, and an edit protocol can easily buy the first by doing nothing.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const exec = promisify(execFile);
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const flag = (n) => argv.includes('--' + n);

const MODEL_URL = opt('model-url', 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = opt('model', 'qwen2.5-coder:1.5b');
const TASK_ID = opt('task', 'farm-i2');
const SEED = opt('seed', null);
const DEADLINE_MS = Math.max(10_000, parseFloat(opt('deadline-sec', '900')) * 1000);
const MAX_TOKENS = parseInt(opt('max-tokens', '4000'), 10);
const TEMPERATURE = parseFloat(opt('temperature', '0.2'));
const OUT = opt('out', null);
const KEEP = flag('keep');
const WS_IN = opt('workspace', null);
const PROTOCOL = opt('protocol', 'anchor');
if (!['anchor', 'fim'].includes(PROTOCOL)) { console.error(`unknown protocol ${PROTOCOL} (anchor | fim)`); process.exit(2); }
// The fim region, as literal first/last lines of the hole. Recorded in the result, because the
// harness choosing them IS assistance and the reader must be able to see exactly how much.
const TRIM_TAIL = flag('trim-tail');      // deterministic: cut the infill at a closing </script>
const REGION_FROM = opt('region-from', '        function plantSeed() {');
const REGION_TO = opt('region-to', "        document.addEventListener('load', loadGame);");

const { farmTasks } = await import('./benchTasks.js');
const { evaluate } = await import('./evaluator.js');
const { applyAcceptance } = await import('./acceptance.js');
const { playCheck } = await import('./playCheck.js');
const { judgeCandidate } = await import('./judgeCandidate.mjs');

// PLUMBING, not a rule. This module resolved its task AT IMPORT TIME and exited the process when the
// id was unknown - so importing it purely for containToSlot, from a run whose task lives in another
// group, killed that run before it started. The resolution is unchanged; only the exit is now confined
// to the case where this file is the program being run. The containment functions above are untouched,
// and TRANSFER-1 records their source hash before and after to show it.
const DIRECT_ENTRY = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
const task = farmTasks().find((t) => t.id === TASK_ID);
if (!task && DIRECT_ENTRY) { console.error(`unknown task ${TASK_ID}; have ${farmTasks().map((t) => t.id).join(', ')}`); process.exit(2); }
const spec = task ? task.diagnostic.spec : null;
const ENTRY = (spec && spec.entry) || 'index.html';

// ── THE ANCHOR CONTRACT ───────────────────────────────────────────────────────────────────
const ANCHOR_SYSTEM = [
  'You reply with one or more edit blocks and nothing else.',
  'Each edit block has exactly this shape:',
  '',
  '<<<<<<< FIND',
  'lines copied from the current file, character for character',
  '=======',
  'the lines that replace them',
  '>>>>>>> END',
  '',
  'The FIND lines must appear in the file exactly once, copied exactly.',
  'Do not return the whole file. Do not explain. Do not use fenced code blocks.',
].join('\n');

// The instruction that goes at the top of the hole, DERIVED FROM THE TASK rather than hardcoded.
// A defect found by running INC4-1 cell A: this constant used to spell out increment 2 (planting
// AND growth), so pointing the harness at the narrower farm-plant task silently asked for the old
// feature. Whatever the task says is what the hole is labelled with, and the text is recorded
// verbatim in the result.
const FIM_INSTRUCTION_OVERRIDE = opt('fim-instruction', null);
const FIM_INSTRUCTION = FIM_INSTRUCTION_OVERRIDE !== null ? FIM_INSTRUCTION_OVERRIDE : (() => {
  const words = String((task && task.goal) || '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > 96) { lines.push(line.trim()); line = w; } else { line += ' ' + w; }
  }
  if (line.trim()) lines.push(line.trim());
  return lines.map((l) => '// ' + l).join('\n');
})();

function anchorUserMessage(currentFile) {
  return [
    task.goal.split('\n')[0],
    '',
    `This is the current ${ENTRY}:`,
    currentFile,
    '',
    'Change it with edit blocks. Emit only the blocks needed, each with FIND lines copied',
    `exactly from the file above. Nothing before the first block, nothing after the last.`,
  ].join('\n');
}

/** Stream a chat reply. */
async function chat(messages) {
  const t0 = Date.now();
  const body = {
    model: MODEL, messages, stream: true,
    options: { temperature: TEMPERATURE, num_predict: MAX_TOKENS, ...(SEED !== null ? { seed: parseInt(SEED, 10) } : {}) },
  };
  return await stream(`${MODEL_URL}/api/chat`, body, t0);
}

/** Stream an infilling completion: the model sees a prefix and a suffix and writes the middle. */
async function infill(prefix, suffix) {
  const t0 = Date.now();
  const body = {
    model: MODEL, prompt: prefix, suffix, stream: true,
    options: { temperature: TEMPERATURE, num_predict: MAX_TOKENS, ...(SEED !== null ? { seed: parseInt(SEED, 10) } : {}) },
  };
  return await stream(`${MODEL_URL}/api/generate`, body, t0);
}

async function stream(url, body, t0) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DEADLINE_MS);
  let text = '', firstTokenMs = null, doneReason = null, outTok = null, promptTok = null, aborted = false;
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}`, text, ms: Date.now() - t0 };
    const dec = new TextDecoder();
    let buf = '';
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        let j; try { j = JSON.parse(line); } catch { continue; }
        const piece = j.message?.content ?? j.response ?? '';
        if (piece) { if (firstTokenMs === null) firstTokenMs = Date.now() - t0; text += piece; }
        if (j.done) { doneReason = j.done_reason || 'done'; outTok = j.eval_count ?? null; promptTok = j.prompt_eval_count ?? null; }
      }
    }
  } catch (e) {
    aborted = ctrl.signal.aborted;
    if (!aborted) return { ok: false, reason: String(e.message || e).slice(0, 200), text, ms: Date.now() - t0, firstTokenMs };
  } finally { clearTimeout(timer); }
  return { ok: true, text, ms: Date.now() - t0, firstTokenMs, doneReason: aborted ? 'harness_deadline' : doneReason, outTok, promptTok, aborted };
}

/**
 * DETERMINISTIC PARSE of the anchor protocol. Returns every block found plus whatever text sat
 * outside them. A block missing its closing marker is INCOMPLETE and is never applied.
 */
export function parseEditBlocks(reply) {
  const text = String(reply ?? '');
  const re = /^[ \t]*<<<<<<+[ \t]*FIND[ \t]*\r?\n([\s\S]*?)^[ \t]*=======[ \t]*\r?\n([\s\S]*?)^[ \t]*>>>>>>+[ \t]*END[ \t]*$/gm;
  const blocks = [];
  let outside = '', last = 0, m;
  while ((m = re.exec(text)) !== null) {
    outside += text.slice(last, m.index);
    last = m.index + m[0].length;
    blocks.push({ find: m[1], replace: m[2] });
  }
  outside += text.slice(last);
  // An opened block that never closed: the reply was cut off mid-edit. Report it, never apply it.
  const opens = (text.match(/^[ \t]*<<<<<<+[ \t]*FIND/gm) || []).length;
  return { blocks, outside: outside.trim(), opened: opens, incomplete: opens > blocks.length };
}

/**
 * STRUCTURAL CONTAINMENT. Does this completion fit the slot it was given - judged by its own shape,
 * not by whether the model happened to reproduce a line of the suffix?
 *
 * ASSIST-2 is why this exists. The slot was one line inside a listener the policy had just written. The
 * completion began correctly, then closed the listener and appended twenty more, doubling the file and
 * silently breaking a previously accepted behaviour. The trim did not catch it because it cut at the
 * first line of the suffix and the model wrote `draw();` where the suffix said
 * `try { draw(); } catch ...`. Relying on the model to reproduce a particular line is not containment.
 *
 * So the completion is REFUSED - not trimmed, not repaired - when it cannot be contained:
 *
 *   ESCAPES_ENCLOSING_BLOCK   it closes more blocks than it opens, so it reaches outside its slot
 *   UNBALANCED                it ends mid-block, so splicing it leaves broken syntax
 *   ADDS_A_LISTENER           it registers an event listener: the slot is a body, and the scaffold
 *                             already supplies whatever binding was wanted
 *   TOO_LARGE                 it exceeds the line budget for the slot
 *
 * Refusing is the point. A completion that cannot be contained is not evidence about the model's logic,
 * and quietly cutting it into shape hides the fact that it did not answer the question asked.
 */
export function containsSafely(middle, { maxLines = 20 } = {}) {
  const raw = String(middle ?? '');
  const lines = raw.split('\n');
  const code = lines.filter((l) => l.trim().length && !l.trim().startsWith('//'));
  if (!code.length) return { ok: false, reason: 'EMPTY', detail: 'no code in the completion' };
  if (code.length > maxLines) {
    return { ok: false, reason: 'TOO_LARGE', detail: `${code.length} code lines for a slot budgeted at ${maxLines}` };
  }
  if (/addEventListener\s*\(/.test(raw)) {
    return { ok: false, reason: 'ADDS_A_LISTENER', detail: 'the completion registers an event listener; the slot is a body and the scaffold already supplies the binding' };
  }
  // Depth over the whole completion, ignoring braces inside strings, template literals and comments.
  let depth = 0, min = 0;
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
  for (const ch of stripped) {
    if (ch === '{' || ch === '(' || ch === '[') depth++;
    else if (ch === '}' || ch === ')' || ch === ']') { depth--; if (depth < min) min = depth; }
  }
  if (min < 0) {
    return { ok: false, reason: 'ESCAPES_ENCLOSING_BLOCK', detail: `the completion closes ${-min} more block(s) than it opens, so it reaches outside its slot` };
  }
  if (depth !== 0) {
    return { ok: false, reason: 'UNBALANCED', detail: `the completion ends ${depth} block(s) deep, so splicing it would leave broken syntax` };
  }
  return { ok: true, codeLines: code.length, maxLines };
}

/**
 * CONTAIN THE COMPLETION TO ITS SLOT, structurally.
 *
 * Two findings forced this shape. ASSIST-2: a boundary that cut at the first line of the suffix failed
 * because the model wrote `draw();` where the suffix said `try { draw(); } catch ...`, and 4,000
 * characters of invented handlers were accepted. ASSIST-4: refusing every over-long completion outright
 * was safe and useless - all eight attempts were refused, because this model always writes past a small
 * slot even when its first few lines are exactly right.
 *
 * So the cut is made on STRUCTURE, never on a line the model has to reproduce: the completion is
 * truncated at the first point where it would close a block it did not open - the point where it leaves
 * its slot. What remains is then checked, and REFUSED rather than repaired if it still cannot sit there.
 *
 *   truncated   at the escape point, if any - reported, with how much was dropped
 *   refused     EMPTY, UNBALANCED, ADDS_A_LISTENER, or TOO_LARGE after truncation
 *
 * A completion whose FIRST statement already escapes is refused, not truncated to nothing.
 */
export function containToSlot(middle, { maxLines = 20 } = {}) {
  const raw = String(middle ?? '');
  const lines = raw.split('\n');
  // Depth per line, computed over text with strings, template literals and comments removed so a brace
  // inside a string cannot be mistaken for structure.
  const strip = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/g, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
  let depth = 0, escapeLine = -1;
  for (let i = 0; i < lines.length; i++) {
    for (const ch of strip(lines[i])) {
      if (ch === '{' || ch === '(' || ch === '[') depth++;
      else if (ch === '}' || ch === ')' || ch === ']') {
        depth--;
        if (depth < 0) { escapeLine = i; break; }
      }
    }
    if (escapeLine !== -1) break;
  }
  const kept = escapeLine === -1 ? raw : lines.slice(0, escapeLine).join('\n');
  const dropped = escapeLine === -1 ? 0 : lines.length - escapeLine;
  const verdict = containsSafely(kept, { maxLines });
  if (!verdict.ok) {
    return { ok: false, reason: verdict.reason, detail: verdict.detail, truncatedAtLine: escapeLine === -1 ? null : escapeLine + 1, droppedLines: dropped };
  }
  return {
    ok: true, text: kept, codeLines: verdict.codeLines,
    truncatedAtLine: escapeLine === -1 ? null : escapeLine + 1,
    droppedLines: dropped,
    how: escapeLine === -1 ? 'the completion stayed inside its slot' : `truncated at the point where it would have closed a block it did not open (line ${escapeLine + 1}), dropping ${dropped} line(s)`,
  };
}

/**
 * INDENTATION-TOLERANT, FILE-ANCHORED MATCHING. Opt-in, and the distinction matters.
 *
 * REPAIR-1: the 7B located the right region in 4 of 4 candidates and every edit was refused, because
 * its FIND reproduced the lines at column 0 while the file indents them by eight spaces (2 of 4), or
 * regrouped lines that are not adjacent in the file (2 of 4). Exact matching is correct about the
 * second case and needlessly strict about the first.
 *
 * The recorded danger is a "tolerant matcher" that splices at the MODEL's indentation and thereby
 * drops a method out of its class. This does the opposite: the span is located by comparing
 * line-by-line with whitespace ignored, and then the FILE's own lines are replaced, with the
 * replacement re-indented to the file's indentation. The model's whitespace is never authoritative.
 *
 * Still refused: zero matches, more than one match, and any FIND whose line sequence does not appear
 * contiguously in the file - reordering is a content disagreement, not a formatting one.
 */
export function findNormalizedSpan(original, find) {
  const keep = (arr) => arr.map((l, i) => ({ i, t: l.trim() })).filter((x) => x.t.length);
  const fileLines = String(original).split('\n');
  const fileKeep = keep(fileLines);
  const findKeep = keep(String(find).split('\n'));
  if (!findKeep.length) return { status: 'EMPTY_FIND', count: 0 };
  let count = 0, at = -1;
  for (let k = 0; k + findKeep.length <= fileKeep.length; k++) {
    let ok = true;
    for (let j = 0; j < findKeep.length; j++) {
      if (fileKeep[k + j].t !== findKeep[j].t) { ok = false; break; }
    }
    if (ok) { count++; if (at === -1) at = k; }
  }
  if (count === 0) return { status: 'NOT_FOUND', count: 0 };
  if (count > 1) return { status: 'AMBIGUOUS', count };
  const firstLine = fileKeep[at].i;
  const lastLine = fileKeep[at + findKeep.length - 1].i;
  const indentOf = (l) => (l.match(/^[ \t]*/) || [''])[0];
  return {
    status: 'MATCHED', count: 1, firstLine, lastLine,
    fileIndent: indentOf(fileLines[firstLine]),
    findIndent: indentOf(String(find).split('\n').find((l) => l.trim().length) || ''),
  };
}

/** Replace the matched FILE lines, re-indenting the replacement to the FILE's indentation. */
export function spliceNormalized(original, span, replace) {
  const fileLines = String(original).split('\n');
  const delta = span.fileIndent.length - span.findIndent.length;
  const reindented = String(replace).split('\n').map((l) => {
    if (!l.trim().length) return '';
    if (delta > 0) return ' '.repeat(delta) + l;
    if (delta < 0) return l.replace(new RegExp(`^[ \\t]{0,${-delta}}`), '');
    return l;
  });
  // A trailing blank line in the replacement would otherwise add one on every splice.
  while (reindented.length && !reindented[reindented.length - 1].length) reindented.pop();
  return [...fileLines.slice(0, span.firstLine), ...reindented, ...fileLines.slice(span.lastLine + 1)].join('\n');
}

/**
 * Apply blocks in order. A FIND must match the CURRENT text exactly once; zero matches or more
 * than one is a refusal for that block, recorded with which it was. Nothing is applied unless
 * every block is applicable, so a partial splice can never reach disk.
 */
export function applyEditBlocks(original, blocks, { match = 'exact' } = {}) {
  const results = [];
  let text = String(original);
  for (const b of blocks) {
    const find = b.find;
    if (!find.length) { results.push({ status: 'EMPTY_FIND', count: 0 }); continue; }
    // LINE-ALIGNED exact matching. A substring match can start in the middle of a line, and then a
    // multi-line replacement puts its later lines at column 0 - the same de-indentation hazard the
    // exact rule exists to avoid, arriving through the front door. Found by a test asserting that an
    // added line inherits the file's indentation: a FIND of `go();` matched inside `      go();` and
    // spliced `more();` against the left margin. So a match must begin at the start of a line; a
    // FIND that omits the indentation is not an exact match, and normalized mode handles it properly
    // by re-indenting to the file.
    let count = 0, from = 0, at = -1;
    for (;;) {
      const i = text.indexOf(find, from);
      if (i === -1) break;
      if (i === 0 || text[i - 1] === '\n') { count++; if (at === -1) at = i; }
      from = i + 1;
    }
    if (count === 1) { results.push({ status: 'APPLIED', count, at, matchedBy: 'exact' }); text = text.slice(0, at) + b.replace + text.slice(at + find.length); continue; }
    if (count > 1) { results.push({ status: 'AMBIGUOUS', count }); continue; }
    if (match !== 'normalized') { results.push({ status: 'NOT_FOUND', count }); continue; }
    // Exact matching found nothing: try again ignoring indentation, anchored on the FILE.
    const span = findNormalizedSpan(text, find);
    if (span.status !== 'MATCHED') { results.push({ status: span.status, count: span.count, triedNormalized: true }); continue; }
    results.push({ status: 'APPLIED', count: 1, at: span.firstLine, matchedBy: 'normalized', reindentedBy: span.fileIndent.length - span.findIndent.length });
    text = spliceNormalized(text, span, b.replace);
  }
  const applicable = results.length > 0 && results.every((r) => r.status === 'APPLIED');
  return { applicable, results, text: applicable ? text : String(original) };
}

/** Cut the named region out of the file. The hole's first and last lines are given literally. */
export function cutRegion(file, from, to) {
  const i = file.indexOf(from);
  if (i === -1) return { ok: false, reason: `region-from not found: ${JSON.stringify(from)}` };
  const j = file.indexOf(to, i);
  if (j === -1) return { ok: false, reason: `region-to not found after region-from: ${JSON.stringify(to)}` };
  const end = j + to.length;
  return { ok: true, prefix: file.slice(0, i), removed: file.slice(i, end), suffix: file.slice(end) };
}

/**
 * WHAT DOES THE EDIT ACTUALLY INSERT, once comments are set aside? Four of five infills over a
 * five-line hole filled the token ceiling with one self-contradictory comment repeated - 15,000
 * characters, no statement, no listener, no mention of the thing being changed. "A non-empty
 * completion arrived" is far too weak a boundary to call an edit produced.
 *
 * THE LIMIT OF THIS MEASURE, stated because it nearly misled me: it only separates comments and
 * blank lines from everything else. It does NOT check that what remains is JavaScript. Three
 * anchor attempts scored one "non-comment line" each, and those lines were a stray `=======`
 * separator twice and one paragraph of the instruction text - English, not code. Read this
 * alongside the recorded replacement text, never on its own.
 */
export function nonCommentContent(text) {
  const withoutBlocks = String(text ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
  const lines = withoutBlocks.split('\n');
  const codeLines = lines.filter((l) => {
    const t = l.trim();
    return t.length > 0 && !t.startsWith('//');
  });
  const commentLines = lines.filter((l) => l.trim().startsWith('//')).length;
  return {
    nonCommentLines: codeLines.length, commentLines,
    hasNonComment: codeLines.length > 0, nonCommentChars: codeLines.join('\n').length,
    sample: codeLines.join('\n').slice(0, 300),      // so prose posing as code is visible
  };
}

/**
 * THE INFILL RAN PAST THE HOLE. Given the site and a one-line instruction, this model wrote code in
 * 3 of 3 attempts and then closed the document inside the hole - `</script></body></html>` - even
 * though the suffix it was given already contains them. The model's ollama template does support
 * infilling (`{{ if .Suffix }}<|fim_prefix|>...<|fim_suffix|>...<|fim_middle|>`), so the suffix did
 * reach it; it simply did not respect the boundary. The result was a script closed early, a seam
 * orphaned after it, and a page that exposed no state at all.
 *
 * So the harness truncates the middle at the first line that closes the script or the document.
 * This is deterministic, it never adds anything, and it is ASSISTANCE - recorded per run as
 * fimTailTrimmed with what was dropped.
 */
export function trimInfillTail(middle, suffix = null) {
  const lines = String(middle ?? '').split('\n');
  const closes = /^\s*(<\/script>|<\/body>|<\/html>)/i;
  // THE SAME ERROR, ONE LEVEL IN. The model also runs past a SMALL hole by re-emitting the lines that
  // already follow it: given a hole inside a handler, it wrote 15 to 147 lines and re-closed the
  // handler, so the spliced file had the suffix twice and the page broke 4 times in 5. The first line
  // of the suffix is therefore a boundary too, and cutting there is the same deterministic rule as
  // cutting at a closing </script> - it removes what the harness already supplies and never adds.
  const suffixFirst = suffix === null ? null
    : (String(suffix).split('\n').map((l) => l.trim()).find((l) => l.length) ?? null);
  let at = -1;
  for (let i = 0; i < lines.length; i++) {
    if (closes.test(lines[i])) { at = i; break; }
    if (suffixFirst && i > 0 && lines[i].trim() === suffixFirst) { at = i; break; }
  }
  if (at === -1) return { text: String(middle ?? ''), trimmed: false, droppedLines: 0, dropped: '' };
  return {
    text: lines.slice(0, at).join('\n'),
    trimmed: true,
    droppedLines: lines.length - at,
    trimmedAt: closes.test(lines[at]) ? 'document close' : 'the first line of the suffix',
    dropped: lines.slice(at).join('\n').slice(0, 300),
  };
}

const git = (ws, args) => exec('git', ['-C', ws, ...args], { windowsHide: true });

async function main() {
  const T0 = Date.now();
  const ws = mkdtempSync(join(tmpdir(), `edit-${TASK_ID}-`));
  const rec = {
    at: new Date().toISOString(), task: TASK_ID, model: MODEL, modelUrl: MODEL_URL,
    seed: SEED === null ? null : parseInt(SEED, 10), protocol: `local-edit-${PROTOCOL}`,
    deadlineSec: DEADLINE_MS / 1000, maxTokens: MAX_TOKENS,
    requestedSteps: task.requested.play.steps, protectedSteps: task.protected?.play?.steps ?? null,
    // EVERY piece of help the harness supplied, named, so this can never be read as autonomy.
    assistance: {
      editFormatGivenByHarness: true,
      infillTailTrimmedByHarness: PROTOCOL === 'fim' ? TRIM_TAIL : false,
      editSiteChosenBy: PROTOCOL === 'fim' ? 'harness' : 'model',
      featureSplitIntoSteps: false,
      region: PROTOCOL === 'fim' ? { from: REGION_FROM, to: REGION_TO } : null,
      instructionComment: PROTOCOL === 'fim' ? FIM_INSTRUCTION : null,
    },
    boundaries: {}, timing: {}, tokens: {}, workspace: ws,
  };
  try {
    mkdirSync(ws, { recursive: true });
    if (!WS_IN || !existsSync(join(WS_IN, ENTRY))) {
      console.error(`--workspace must hold the starting ${ENTRY}: this protocol EDITS an existing file`);
      process.exit(2);
    }
    const startFile = readFileSync(join(WS_IN, ENTRY), 'utf8');
    writeFileSync(join(ws, ENTRY), startFile, 'utf8');
    for (const [f, body] of Object.entries(task.seed || {})) writeFileSync(join(ws, f), body, 'utf8');
    await git(ws, ['init', '-q']); await git(ws, ['config', 'core.autocrlf', 'false']);
    await git(ws, ['add', '-A']).catch(() => {});
    await git(ws, ['-c', 'user.email=b@b', '-c', 'user.name=b', 'commit', '-q', '--allow-empty', '-m', 'seed']);
    const startRef = (await git(ws, ['rev-parse', 'HEAD'])).stdout.trim();
    rec.startFileChars = startFile.length;

    // ── generate, and build the edited text ──
    let gen, edited = null;
    if (PROTOCOL === 'anchor') {
      gen = await chat([{ role: 'system', content: ANCHOR_SYSTEM }, { role: 'user', content: anchorUserMessage(startFile) }]);
    } else {
      const cut = cutRegion(startFile, REGION_FROM, REGION_TO);
      if (!cut.ok) { console.error(`the fim region does not match the starting file: ${cut.reason}`); process.exit(2); }
      rec.assistance.region.removedChars = cut.removed.length;
      rec.assistance.region.removedLines = cut.removed.split('\n').length;
      gen = await infill(cut.prefix + FIM_INSTRUCTION + '\n', cut.suffix);
      rec.fim = { prefixChars: cut.prefix.length, suffixChars: cut.suffix.length, removed: cut.removed };
    }
    rec.timing.generateMs = gen.ms;
    rec.timing.firstTokenMs = gen.firstTokenMs ?? null;
    rec.tokens = { output: gen.outTok ?? null, prompt: gen.promptTok ?? null, replyChars: (gen.text || '').length };
    rec.terminationReason = gen.ok ? gen.doneReason : `transport: ${gen.reason}`;
    rec.naturalStop = gen.doneReason === 'stop';
    // RAW, before any harness transformation. Every later field derives from this one, and the
    // assistance stays visible because both ends are on the record: rawReply is what the model
    // emitted, transformed is what the harness made of it, candidate is what the gate judged.
    rec.rawReply = String(gen.text || '').slice(0, 20000);
    rec.rawReplyChars = (gen.text || '').length;
    rec.reply = rec.rawReply;                      // kept for readers of the earlier records
    if (!gen.ok) { rec.boundaries = { editProduced: false, note: `generation failed: ${gen.reason}` }; return rec; }

    if (PROTOCOL === 'anchor') {
      const parsed = parseEditBlocks(gen.text);
      rec.edit = { blocks: parsed.blocks.length, opened: parsed.opened, incomplete: parsed.incomplete, outsideChars: parsed.outside.length, outsideSample: parsed.outside.slice(0, 300) };
      rec.boundaries.editProduced = parsed.blocks.length > 0;
      rec.boundaries.editContractClean = parsed.blocks.length > 0 && parsed.outside.length === 0 && !parsed.incomplete;
      if (!parsed.blocks.length) return rec;
      // HOW LOCALIZED WAS IT? The first anchor run answered the format and ignored its point:
      // every attempt copied the ENTIRE file into FIND and replaced it with a few characters,
      // deleting the page. "changed the program" must never be readable as "made a localized
      // change", so the size of what each block claims and leaves behind is recorded.
      rec.edit.localization = parsed.blocks.map((b) => ({
        findChars: b.find.length, findLines: b.find.split('\n').length,
        replaceChars: b.replace.length, replaceLines: b.replace.split('\n').length,
        findFractionOfFile: +(b.find.length / startFile.length).toFixed(3),
        findIsWholeFile: b.find.trim() === startFile.trim(),
        netChars: b.replace.length - b.find.length,
      }));
      rec.boundaries.editIsLocalized = parsed.blocks.length > 0
        && parsed.blocks.every((b) => b.find.trim() !== startFile.trim() && b.find.length < startFile.length * 0.5);
      const applied = applyEditBlocks(startFile, parsed.blocks);
      rec.edit.results = applied.results;
      rec.boundaries.editApplicable = applied.applicable;
      const code = nonCommentContent(parsed.blocks.map((b) => b.replace).join('\n'));
      rec.edit.code = code;
      rec.boundaries.editInsertsNonComment = code.hasNonComment;
      rec.transformed = {
        kind: 'anchor-blocks', tailTrimmed: false,
        blocks: parsed.blocks.map((b) => ({ find: b.find.slice(0, 2000), replace: b.replace.slice(0, 2000) })),
        identicalToRaw: false,                                  // a block list is never the raw text
      };
      if (!applied.applicable) return rec;                      // nothing partially spliced, ever
      edited = applied.text;
    } else {
      const cut = cutRegion(startFile, REGION_FROM, REGION_TO);
      let middle = String(gen.text || '');
      if (TRIM_TAIL) {
        const t = trimInfillTail(middle, cutRegion(startFile, REGION_FROM, REGION_TO).suffix);
        rec.fimTailTrimmed = { trimmed: t.trimmed, droppedLines: t.droppedLines, dropped: t.dropped };
        middle = t.text;
      }
      rec.transformed = {
        kind: 'fim-middle', tailTrimmed: TRIM_TAIL && !!(rec.fimTailTrimmed && rec.fimTailTrimmed.trimmed),
        middleUsed: middle.slice(0, 20000), middleUsedChars: middle.length,
        identicalToRaw: middle === String(gen.text || ''),
      };
      rec.boundaries.editProduced = middle.trim().length > 0;
      rec.boundaries.editContractClean = rec.boundaries.editProduced;   // no block format to violate
      rec.boundaries.editApplicable = rec.boundaries.editProduced;
      const code = nonCommentContent(middle);
      rec.edit = { code };
      rec.boundaries.editInsertsNonComment = code.hasNonComment;
      if (!rec.boundaries.editProduced) return rec;
      edited = cut.prefix + FIM_INSTRUCTION + '\n' + middle + cut.suffix;
    }

    // ── write it (the harness, not the model) ──
    const text = edited.endsWith('\n') ? edited : edited + '\n';
    rec.boundaries.editApplied = true;
    rec.boundaries.changedProgram = text.trim() !== startFile.trim();
    rec.editedChars = text.length;
    rec.candidate = {
      chars: text.length, sha256: createHash('sha256').update(text).digest('hex'),
      text: text.slice(0, 20000),
    };
    writeFileSync(join(ws, ENTRY), text, 'utf8');
    await git(ws, ['add', '-A']);
    await git(ws, ['-c', 'user.email=b@b', '-c', 'user.name=b', 'commit', '-q', '-m', 'candidate'])
      .catch((e) => { if (!/nothing to commit/i.test(String(e.stdout || '') + String(e.stderr || ''))) throw e; });
    rec.timing.writtenMs = Date.now() - T0;

    // ── the UNCHANGED play, evaluator and acceptance, shared with the whole-file harness ──
    await judgeCandidate(ws, task, spec, startRef, rec, T0, { playCheck, evaluate, applyAcceptance, join, readFileSync });
    return rec;
  } finally {
    if (!KEEP) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
  }
}

// Run ONLY when invoked directly. A test that imports this module for its parsers must
// not launch a generation run as a side effect of the import.
const DIRECT = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (DIRECT) {
const rec = await main();
const b = rec.boundaries || {};
const mark = (v) => (v === true ? 'YES' : v === false ? 'no ' : ' - ');
console.log(`${TASK_ID} ${MODEL} ${rec.protocol} seed=${rec.seed}  termination=${rec.terminationReason} natural=${rec.naturalStop ? 'yes' : 'NO'}`);
console.log(`  E1 edit produced       ${mark(b.editProduced)}   E1b contract clean ${mark(b.editContractClean)}   E2 applicable ${mark(b.editApplicable)}`);
console.log(`  E1c inserts non-comment ${mark(b.editInsertsNonComment)}${rec.edit && rec.edit.code ? `  (${rec.edit.code.nonCommentLines} non-comment / ${rec.edit.code.commentLines} comment lines)` : ''}`);
console.log(`  E3 applied             ${mark(b.editApplied)}   E4 changed the program ${mark(b.changedProgram)}`);
console.log(`  E5 reached execution   ${mark(b.reachedExecution)}   E6 protected ${mark(b.passedProtected)}   E7 requested ${mark(b.passedDiagnostic)}   E8 accepted ${mark(b.accepted)}`);
if (rec.edit) console.log(`  edit: ${rec.edit.blocks} block(s)${rec.edit.incomplete ? ' (one INCOMPLETE)' : ''}, outside=${rec.edit.outsideChars} chars${rec.edit.results ? ', ' + rec.edit.results.map((r) => r.status).join('/') : ''}${rec.edit.localization ? ', localized ' + mark(b.editIsLocalized) + ' [' + rec.edit.localization.map((l) => `${l.findChars}->${l.replaceChars}ch`).join(' ') + ']' : ''}`);
console.log(`  chars=${rec.tokens.replyChars} outTok=${rec.tokens.output} promptTok=${rec.tokens.prompt} gen=${rec.timing.generateMs}ms`);
if (rec.play) console.log(`  play: ${rec.play.status} passing [${rec.play.passing.join(',')}] failing [${rec.play.failing.join(',')}]`);
if (rec.acceptance) console.log(`  acceptance: ${rec.acceptance.disposition}`);
if (OUT) { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify(rec, null, 2), 'utf8'); console.log(`  written: ${OUT}`); }
process.exit(0);
}
