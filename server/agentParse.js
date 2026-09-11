/**
 * agentParse.js - turning one model reply into one action.
 *
 * Split out of agent.js. Measured before moving rather than assumed: 164 lines needing two
 * symbols from module scope, both of which were already imports. The block that LOOKED
 * like the obvious first extraction - the tool table - needs 44, including mutable run
 * state and a constant declared after it, which is why it is still in agent.js.
 *
 * The parser is deliberately plain text rather than JSON. File content arrives in a raw
 * fenced block, so quotes, backslashes and escape sequences survive intact; JSON-string
 * encoding is what broke smaller models. Every tool with a non-trivial argument shape needs
 * its own branch here - a tool that falls through to the generic PATH handler arrives with
 * its real argument undefined and is silently unusable, which has happened to download_file,
 * the ledger tools and the Google tools in turn.
 */
import { GOOGLE_TOOLS, parseGoogleArgs } from './googleTools.js';

/**
 * Strip line-number prefixes a model copied out of a tool result back into code.
 *
 * read_file shows every line as `${n}: ${line}`, and the FIND-miss hint shows
 * `      ${n}| ${line}`. Models copy those lines straight back into write_file and edit_file,
 * prefixes and all. Found by fuzzing the loop with recorded real output: q3_list.js was left
 * on disk as
 *
 *     19:   function zip(a, b) {
 *     20:     return a.map((val, i) => [val, b[i]]);
 *
 * which no module system will parse, and its only version in git history was already
 * broken, so the syntax rollback had nothing to restore. The prompt has told the model not to
 * do this for months; that is advice, and advice does not hold. This does.
 *
 * DELIBERATELY NARROW, because legitimate code can start a line with digits - object keys
 * such as `  1: 'one',`. It fires only when EVERY non-empty line carries the prefix, the
 * numbers ASCEND, and (for the `N: ` form) the number sits at column 0, where read_file puts
 * it and where an indented object key never is. Anything ambiguous is returned untouched.
 */
export function stripLineNumberPrefixes(text) {
  if (typeof text !== 'string' || !text) return text;
  const lines = text.split('\n');
  const body = lines.filter((l) => l.trim() !== '');
  if (!body.length) return text;
  const READ = /^(\d+):(?: |$)/;     // read_file:       "19: code"
  const HINT = /^\s*(\d+)\| ?/;      // FIND-miss hint:  "      19| code"
  for (const re of [READ, HINT]) {
    if (!body.every((l) => re.test(l))) continue;
    const nums = body.map((l) => parseInt(l.match(re)[1], 10));
    if (!nums.every((n, i) => i === 0 || n > nums[i - 1])) continue;
    return lines.map((l) => l.replace(re, '')).join('\n');
  }
  return text;
}

/**
 * Every action in one reply, not just the first.
 *
 * `parseAction` matches ACTION: without /g, so it returns the first and the rest are
 * discarded in silence. Measured over 1,759 recorded real responses: 102 carry more than one
 * action and 49 contain a `finish` that is not first - every one of those thrown away, with
 * nothing telling the model. It then re-sends the identical reply until the repetition guard
 * kills the run.
 *
 * Splitting at ACTION: boundaries keeps each action's PATH and fenced block with it, because
 * both follow their ACTION line. The reply's leading THOUGHT stays with the first segment;
 * a trailing THOUGHT belonging to the NEXT action lands harmlessly at the end of the
 * previous segment, since parseAction reads the FIRST THOUGHT it finds.
 *
 * Returns [] for an unparseable reply and a single-element array for the ordinary case, so
 * callers can treat both the same way.
 */
export function parseActions(text, lastPath, max = 6) {
  if (!text) return [];
  const starts = [...text.matchAll(/^[ \t]*ACTION:[ \t]*[a-z_]+/gim)].map((m) => m.index);
  if (starts.length <= 1) { const one = parseAction(text, lastPath); return one && one.tool ? [one] : []; }
  // AN `ACTION:` LINE IS NOT ALWAYS A NEW ACTION.
  //
  // Real reply, from the corpus:
  //
  //     ACTION: edit_file
  //     PATH: vec.js
  //     FIND:
  //     module.exports = { add };
  //     ACTION: edit_file        <- spurious, written mid-action
  //     PATH: vec.js
  //     REPLACE:
  //     module.exports = { add, sub };
  //
  // That is ONE edit whose FIND and REPLACE are separated by a stray header. Splitting on
  // every ACTION: leaves a FIND with no REPLACE and a REPLACE with no FIND, breaking an edit
  // the whole-text parser gets RIGHT. Found by asserting the first action is byte-identical
  // to today's behaviour across 102 real multi-action replies - 5 of them are this shape.
  //
  // So a segment holding an unmatched FIND absorbs the next one until its REPLACE turns up.
  const out = [];
  let i = 0;
  while (i < starts.length && out.length < max) {
    const from = i === 0 ? 0 : starts[i];
    let j = i;
    let to = j + 1 < starts.length ? starts[j + 1] : text.length;
    while (/^[ \t]*FIND:/im.test(text.slice(from, to)) && !/^[ \t]*REPLACE:/im.test(text.slice(from, to))
           && j + 1 < starts.length) {
      j += 1;
      to = j + 1 < starts.length ? starts[j + 1] : text.length;
    }
    const parsed = parseAction(text.slice(from, to), lastPath);
    if (parsed && parsed.tool) out.push(parsed);
    i = j + 1;
  }
  return out;
}

/**
 * Was this reply CUT OFF inside a code block?
 *
 * The 14B's runaway reply in the head-to-head (2026-09-10, set A goal 19) opened a
 * ```javascript block for t12_bits.js and then wrote console.asserts until it hit the token
 * limit - 31,046 characters, no closing fence. parseAction's fence regex needs a closing
 * fence, so it matched nothing, the write branch fell back to `fenced ?? ''`, and the hub
 * wrote a 0-byte t12_bits.js.
 *
 * An odd fence count alone is NOT the signal: 387 of 1,949 recorded replies end with a stray
 * lone fence after a complete reply ("ACTION: task_list" then a bare fence). The signal is an
 * unmatched fence that OPENS a body - real content follows it and nothing closes it. Across
 * all 2,410 recorded replies this fires on exactly one: the runaway.
 */
export function replyWasTruncated(text) {
  const t = String(text || '');
  const n = (t.match(/```/g) || []).length;
  if (n % 2 === 0) return false;
  return /\n\s*\S/.test(t.slice(t.lastIndexOf('```') + 3));
}

export // Parse one plain-text action from a model response. File content lives in a raw
// fenced code block (never JSON), so quotes/backslashes/escape-sequences survive
// intact — the thing that broke JSON-string encoding on smaller models.
function parseAction(text, lastPath) {
  if (!text) return null;
  const thought = (text.match(/THOUGHT:\s*(.+)/i)?.[1] || '').trim();
  const fenceM = text.match(/```([^\n]*)\n([\s\S]*?)```/);
  const fenceLang = fenceM ? fenceM[1].trim().toLowerCase() : '';
  const fenced = fenceM ? fenceM[2].replace(/\n$/, '') : undefined;
  const pathM = text.match(/PATH:\s*(.+)/i);
  let path = pathM ? pathM[1].trim().replace(/[`"']/g, '') : undefined;
  // If no PATH was given, a filename mentioned in the text is a GUESS, not an instruction.
  //
  // This took the FIRST filename appearing anywhere - including inside the THOUGHT. So:
  //   "THOUGHT: q1_math.js already works, so now I will extend q2_str.js"
  //   ACTION: write_file   (no PATH)
  // wrote the new content to q1_math.js and destroyed a working file. Reproduced against
  // the real parser. Only the FILE THE MODEL IS ABOUT TO WRITE should win, and the model
  // does not say which one it means - so prefer lastPath (the file it was just working on)
  // and only fall back to a scavenged name when there is nothing better.
  //
  // Latent rather than active: 0 of 1,759 recorded real responses omitted PATH on a write.
  // Kept as a guess of last resort because a small model DOES omit it, and returning null
  // would throw away a step it can still salvage.
  // Guess ONLY when unambiguous. If the text names two different files there is no honest
  // way to pick: "q1_math.js already works, so extend q2_str.js" wants the last one,
  // "update q2_str.js using helpers from q1_math.js" wants the first. Taking either is a
  // coin flip that overwrites working code when it loses. One distinct name is evidence;
  // two is a question, and the run loop recovers from "I could not parse that" far better
  // than from a file silently destroyed.
  const mentioned = [...new Set((text.match(/\b[\w.\-/]+\.(?:html|css|js|mjs|py|json|md|txt)\b/gi) || []).map((s) => s.toLowerCase()))];
  const scavenged = mentioned.length === 1 ? mentioned[0] : undefined;

  const langFile = { html: 'index.html', css: 'style.css', js: 'script.js', javascript: 'script.js', python: 'main.py', py: 'main.py' };
  const am = text.match(/ACTION:\s*([a-z_]+)/i);
  let tool = am ? am[1].toLowerCase() : null;

  // Forgiving fallback: small models often "fix" a file by just pasting a code
  // block with no ACTION header — treat any lone code block as a write_file.
  if (!tool && fenced !== undefined) tool = 'write_file';
  if (!tool) return null;

  // append_file carries its payload exactly like write_file does - a fenced block. It was
  // missing here when the tool was added, so the block was parsed but never handed over,
  // and append_file dutifully reported "needs CONTENT" for content the model HAD sent.
  // Four wasted calls in its first live run. Adding a tool means touching five places
  // (tool, prompt, AUTO_TOOLS, MUTATING, parser) and the parser is the silent one.
  if (tool === 'write_file' || tool === 'append_file') {
    // PRECEDENCE, most trustworthy first. This used to be
    // `langFile[fenceLang] || lastPath || 'index.html'`, which put a GENERIC default from
    // the fence language ahead of the file the model was demonstrably just editing: a js
    // fence with lastPath=q3_list.js wrote to `script.js` instead. Backwards. lastPath is
    // evidence about this run; langFile is a guess about any run.
    //
    // 'index.html' as a final fallback also silently overwrote a working game page, so it
    // now only applies when the fence really is html and nothing better is known.
    //
    // A file cut off mid-fence is not an EMPTY file (see replyWasTruncated). Refuse, so the
    // loop re-asks and says why, instead of handing write_file '' and leaving a 0-byte file.
    // A reply whose FIRST block closed properly still writes that complete block.
    if (fenced === undefined && replyWasTruncated(text)) return null;
    if (!path) path = lastPath || scavenged || langFile[fenceLang] || (fenceLang === 'html' ? 'index.html' : undefined);
    if (!path) return null;   // refuse rather than invent a destination
    return { tool, thought, args: { path, content: stripLineNumberPrefixes(fenced ?? '') } };
  }
  if (tool === 'edit_file') {
    // ACCEPT FIND/REPLACE WITH OR WITHOUT CODE FENCES.
    //
    // This required fences. The model very reasonably writes:
    //
    //   FIND:
    //   function len(v) {
    //     return Math.sqrt(v.x * v.x + v.y * v.y);
    //   }
    //   REPLACE:
    //   function len(v) { ...validation... }
    //
    // which is a perfectly correct edit, and the parser returned find=undefined, so the
    // tool answered "needs a FIND snippet" for a snippet that was RIGHT THERE. Measured
    // 2026-09-10 across 6 real runs: 20 wasted model calls and two runs stopped dead on
    // "add input validation to EVERY function" - a goal append_file cannot help with, so
    // there was no escape route. The model was doing the right thing and the tool refused
    // it, which is the worst failure a tool can have: it punishes correct behaviour.
    //
    // Fenced first (unambiguous), then bare: FIND runs to the REPLACE: marker, REPLACE
    // runs to the next ALL-CAPS field or the end. A stray closing fence is trimmed.
    const clean = (v) => (v == null ? v : String(v).replace(/\n?```\s*$/, '').replace(/\n$/, ''));
    const findFenced = text.match(/FIND:\s*```[^\n]*\n([\s\S]*?)```/i);
    const replFenced = text.match(/REPLACE:\s*```[^\n]*\n([\s\S]*?)```/i);
    const findBare = text.match(/FIND:[ \t]*\n([\s\S]*?)(?=\n[ \t]*REPLACE:)/i);
    const replBare = text.match(/REPLACE:[ \t]*\n([\s\S]*?)(?=\n[ \t]*[A-Z][A-Z_]{2,}:|$)/i);
    const find = clean(findFenced ? findFenced[1] : findBare?.[1]);
    const replace = clean(replFenced ? replFenced[1] : replBare?.[1]) ?? '';

    // edit_file + a lone code block + NO FIND/REPLACE at all = a whole-file rewrite.
    //
    // The model says "let me fix this" and pastes the complete new file under
    // ACTION: edit_file. That is write_file's job and the intent is unambiguous - there is
    // no snippet to find because it is not replacing a part, it is replacing the lot. The
    // parser already forgives the same instinct when there is no ACTION header at all
    // ("treat any lone code block as a write_file"); this is the same instinct with a
    // slightly wrong label, and refusing it just burns a call to say so.
    //
    // Only when FIND: is ENTIRELY ABSENT. If FIND: is there but malformed, the error
    // stands and now explains the shape - guessing at a half-written edit is how you
    // replace the wrong thing.
    if (!find && fenced !== undefined && !/\bFIND:/i.test(text)) {
      return { tool: 'write_file', thought, args: { path: path || lastPath, content: stripLineNumberPrefixes(fenced) } };
    }

    return { tool, thought, args: { path: path || lastPath, find: stripLineNumberPrefixes(find), replace: stripLineNumberPrefixes(replace) } };
  }
  if (tool === 'run_command') {
    const cmd = (text.match(/COMMAND:\s*(.+)/i)?.[1]?.trim()) || (fenced ? fenced.trim().split('\n')[0] : undefined);
    return { tool, thought, args: { cmd } };
  }
  if (tool === 'run_python') {
    return { tool, thought, args: { code: fenced, path } };   // inline CODE block, or a .py PATH
  }
  if (tool === 'web_search') {
    const query = (text.match(/QUERY:\s*(.+)/i)?.[1] || '').trim().replace(/[`"']/g, '');
    return { tool, thought, args: { query } };
  }
  if (tool === 'web_fetch') {
    const url = (text.match(/URL:\s*(\S+)/i)?.[1] || '').trim().replace(/[`"'<>]/g, '');
    return { tool, thought, args: { url } };
  }
  // download_file needs BOTH a URL and a destination. Without its own branch it fell
  // through to the generic PATH handler, arrived with url undefined, and could never
  // run - enabled and documented but silently unusable.
  if (tool === 'remember') {
    const t = (text.match(/TEXT:\s*([\s\S]+)/i)?.[1] || '').split(/\n[A-Z]+:/)[0].trim();
    return { tool, thought, args: { text: t } };
  }
  if (tool === 'recall') return { tool, thought, args: {} };
  if (tool === 'git_diff')   return { tool, thought, args: { ref: (text.match(/REF:\s*(\S+)/i)?.[1] || '').trim() || undefined } };
  if (tool === 'git_log')    return { tool, thought, args: { n: (text.match(/N:\s*(\d+)/i)?.[1] || '').trim() || undefined } };
  if (tool === 'git_commit') return { tool, thought, args: { message: (text.match(/MESSAGE:\s*(.+)/i)?.[1] || '').trim() } };
  if (tool === 'git_undo')   return { tool, thought, args: { sha: (text.match(/SHA:\s*(\S+)/i)?.[1] || '').trim() || undefined, hard: /HARD:\s*true/i.test(text) } };
  if (tool === 'download_file') {
    const url = (text.match(/URL:\s*(\S+)/i)?.[1] || '').trim().replace(/[`"'<>]/g, '');
    const dest = (text.match(/PATH:\s*(.+)/i)?.[1] || '').trim().replace(/[`"'<>]/g, '');
    return { tool, thought, args: { url, path: dest } };
  }
  if (tool === 'finish') {
    const summary = (text.match(/SUMMARY:\s*([\s\S]+)/i)?.[1] || '').trim();
    return { tool, thought, args: { summary } };
  }
  // Ledger + verification + delegation. Each needs its own branch for the same reason
  // download_file did: without one they fall through to the generic PATH handler, arrive
  // with their real argument undefined, and are silently unusable.
  if (tool === 'task_list') return { tool, thought, args: {} };
  if (tool === 'task_add') {
    const t = (text.match(/TEXT:\s*([\s\S]+)/i)?.[1] || fenced || '').split(/\n[A-Z]{3,}:/)[0].trim();
    return { tool, thought, args: { text: t } };
  }
  if (tool === 'task_done') {
    // WHICH: 3, or a fragment of the title - the model produces both.
    const w = (text.match(/WHICH:\s*(.+)/i)?.[1] || text.match(/TASK:\s*(.+)/i)?.[1] || '').trim().replace(/[`"']/g, '');
    return { tool, thought, args: { which: w } };
  }
  if (tool === 'see_screen') return { tool, thought, args: { path: path || 'index.html' } };
  if (tool === 'verify_project') return { tool, thought, args: { entry: path || undefined } };
  // PATH on a verify_godot action names the entry scene/script, not a file to read.
  if (tool === 'verify_godot') return { tool, thought, args: { main: path || undefined } };
  if (tool === 'spawn_subtask') {
    const g = (text.match(/GOAL:\s*([\s\S]+)/i)?.[1] || '').split(/\n[A-Z]{3,}:/)[0].trim();
    return { tool, thought, args: { goal: g } };
  }
  if (tool === 'queue_task') {
    const g = (text.match(/GOAL:\s*([\s\S]+)/i)?.[1] || '').split(/\n[A-Z]{3,}:/)[0].trim();
    return { tool, thought, args: { goal: g } };
  }
  if (tool === 'list_assets') {
    const filter = (text.match(/FILTER:\s*(.+)/i)?.[1] || '').trim().replace(/[`"']/g, '');
    return { tool, thought, args: { filter } };
  }
  // Google tools parse their own fields (see googleTools.js) - each has a different shape
  // and gmail_send's BODY is multi-line, which the generic PATH handler would truncate to
  // its first line and send anyway.
  if (GOOGLE_TOOLS.includes(tool)) return { tool, thought, args: parseGoogleArgs(tool, text, fenced) };
  if (tool === 'test_web') return { tool, thought, args: { path: path || 'index.html' } };
  if (tool === 'search_file') {
    const query = (text.match(/QUERY:\s*(.+)/i)?.[1] || '').trim().replace(/[`"']/g, '');
    return { tool, thought, args: { path, query } };   // path optional — omit = search all files
  }
  if (tool === 'read_file') {
    let offset, limit;
    const lm = text.match(/LINES:\s*(\d+)\s*-\s*(\d+)/i);
    if (lm) { offset = +lm[1]; limit = (+lm[2] - +lm[1]) + 1; }
    else {
      const om = text.match(/OFFSET:\s*(\d+)/i); if (om) offset = +om[1];
      const li = text.match(/LIMIT:\s*(\d+)/i);  if (li) limit = +li[1];
    }
    return { tool, thought, args: { path: path || '.', offset, limit } };
  }
  if (tool === 'outline_file') return { tool, thought, args: { path: path || '.' } };
  if (tool === 'list_dir') return { tool, thought, args: { path: path || '.' } };
  return { tool, thought, args: {} };
}
