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
  // if no PATH given, try a filename mentioned anywhere in the text
  if (!path) { const fm = text.match(/\b([\w.\-/]+\.(?:html|css|js|py|json|md|txt))\b/i); if (fm) path = fm[1]; }

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
    if (!path) path = langFile[fenceLang] || lastPath || 'index.html';
    return { tool, thought, args: { path, content: fenced ?? '' } };
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
      return { tool: 'write_file', thought, args: { path: path || lastPath, content: fenced } };
    }

    return { tool, thought, args: { path: path || lastPath, find, replace } };
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
