/**
 * gateIndex.mjs - the PRECOMPUTED workspace index a gate is handed, so it never has to hunt.
 *
 *   import { gateIndex, renderIndex, actionsFor } from './gateIndex.mjs';
 *
 * WHY THIS EXISTS. In the gate design (see gateLoop.mjs) every decision is its own model call with no
 * conversation history. That works - its header records 154/170 on a ladder the monolith could not
 * finish - but a gate that needs to know what is in the workspace can only find out by SPENDING A CALL:
 * list_dir, then outline_file, then read_file. On this machine a monolith call prefills 4,848-6,992
 * tokens at 0.2-1.2 tok/s while a gate's own answer is 3-18 tokens, so discovery is nearly the entire
 * cost of a run. The worst recorded case called outline_file SIX TIMES on a three-line file and died on
 * the loop guard with promptTok 4,810 -> 8,590, never having added module.exports.
 *
 * Discovery is also the one thing that does not need a model. What exists, how big it is and what it
 * exports are facts on disk, so they are computed here once and rendered into the prompt as a few dozen
 * characters. The model is then only ever asked the part that requires judgement.
 *
 * THREE RULES THIS FOLLOWS, each from a measured failure in this repo:
 *
 *  1. NEVER THROW. A gate index is built mid-run, over files a 1.5B model is halfway through writing.
 *     defNames.js takes the same position for the same reason ("it must never throw on the broken code
 *     a model writes mid-fix"), and an index that throws takes down the run it was meant to cheapen.
 *     An entry that cannot be read is RECORDED in skipped[], not silently dropped - a lost file that
 *     reports nothing is the silent-failure shape that has cost this project the most.
 *
 *  2. DO NOT WRITE AN EXPORT PARSER. exportNames() in defNames.js already handles every named
 *     CommonJS and ESM shape and is pinned at 10/10 by exportNamesShapes.test.mjs (verified passing
 *     before this module was written). A second parser would be a second thing to be wrong, and it
 *     would be wrong differently, which is worse.
 *
 *  3. EXPORTED IS NOT DEFINED. This uses exportNames(), never defNames(). A file that defines add and
 *     never exports it is the exact level-1 failure in gateLoop.mjs, and the index has to be able to
 *     SHOW that ("exports: none") rather than hide it behind the function's presence.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { exportNames } from './defNames.js';

/** Export info is a JS-only claim - exportNames() returns an empty Set for anything else. */
const JS_FILE = /\.(c?js|mjs)$/i;

/**
 * Never shown to a gate. package.json is config the goal never asks for and a gate shown it may try to
 * edit it; the rest are noise that only costs tokens. Dotfiles are excluded separately, by prefix.
 */
const NOT_WORKSPACE_FILES = new Set(['package.json', 'package-lock.json', 'node_modules']);

/** How many export names one file may contribute to the prompt before the list is capped. */
const MAX_EXPORTS_PER_LINE = 3;

/**
 * Lines in the human sense: 'a;\nb;\nc;\n' is THREE lines, not four. A trailing newline ends the last
 * line rather than starting a new one, and split('\n').length gets that wrong on every file a model
 * writes (they all end in a newline). The count matters because it is how a gate tells a finished file
 * from a stub.
 */
function countLines(src) {
  if (src === '') return 0;
  let n = 1;
  for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) n++;
  if (src.charCodeAt(src.length - 1) === 10) n--;
  return n;
}

/**
 * What exists in the workspace, as data.
 *
 * { dir, files: [{ name, bytes, lines, exports? }], skipped: [name] }
 *
 * `exports` is PRESENT ONLY for .js/.cjs/.mjs. Its absence means "no export claim is made about this
 * file" (a .py, a .md), which is a different statement from `exports: []`, meaning "this JS file
 * exports nothing". Collapsing the two would tell a gate that a Python file is broken.
 */
export function gateIndex(workspaceDir) {
  const files = [];
  const skipped = [];
  let names;
  try {
    names = readdirSync(workspaceDir);
  } catch {
    // A workspace that does not exist yet is an EMPTY index, not an error. The first gate of a run asks
    // "what exists?" before anything has been created, and that question has a perfectly good answer.
    return { dir: workspaceDir, files, skipped };
  }
  // Sorted so the same workspace always produces the same prompt. Probed on this machine, readdirSync
  // returns NTFS order (case-insensitive), which differs from .sort() - and an index whose order drifts
  // changes the model's answer for reasons unrelated to the goal.
  for (const name of names.sort()) {
    if (name.startsWith('.')) continue;            // dotfiles, and .git with them
    if (NOT_WORKSPACE_FILES.has(name)) continue;
    let src;
    try {
      src = readFileSync(join(workspaceDir, name), 'utf8');
    } catch {
      // DIRECTORIES ARRIVE HERE TOO, via EISDIR, and that is deliberate rather than accidental. Filtering
      // them out by dirent first would mean the try/catch below could only ever be exercised by an OS
      // permission state that cannot be created reliably on Windows - a guard with no reachable test.
      // Letting the read fail is ONE guard covering both cases, and the EISDIR fixture in
      // gateIndex.test.mjs proves it actually runs instead of merely not throwing.
      skipped.push(name);
      continue;
    }
    const entry = { name, bytes: Buffer.byteLength(src, 'utf8'), lines: countLines(src) };
    if (JS_FILE.test(name)) entry.exports = [...exportNames(src, name)].sort();
    files.push(entry);
  }
  return { dir: workspaceDir, files, skipped };
}

/** One file, one line: `add.js  3 lines  exports: add`. */
function fileLine(f) {
  let s = `${f.name}  ${f.lines} lines`;
  if (!Array.isArray(f.exports)) return s;        // not a JS file: make no export claim
  if (f.exports.length === 0) return `${s}  exports: none`;
  const shown = f.exports.slice(0, MAX_EXPORTS_PER_LINE);
  s += `  exports: ${shown.join(', ')}`;
  // The cap has to announce itself. Showing 3 of 20 as though that were all of them is a false fact in
  // the prompt, and a gate cannot check it.
  if (f.exports.length > shown.length) s += ` (+${f.exports.length - shown.length} more)`;
  return s;
}

/**
 * The index as the few dozen characters that go INTO a gate prompt.
 *
 * This text is paid for on every single gate call, so it is deliberately ugly and short: no table, no
 * padding, no byte counts (they are on the index object for code, not for the model). Measured for a
 * 3-file workspace it costs 79 characters, against the 4,848-6,992 token prefill of one discovery call
 * it replaces. gateIndex.test.mjs holds it under 200 characters for 3 files and 80 per line, and - the
 * half that matters - also asserts it still names the file, the line count and the exports, because a
 * character budget on its own is passed most easily by rendering nothing.
 *
 * opts: { max } caps how many files are listed (and says how many were left out),
 *       { header } prefixes a label when the surrounding prompt needs one.
 */
export function renderIndex(index, opts = {}) {
  const { max = 0, header = '' } = opts;
  const lead = header ? `${header}\n` : '';
  const files = (index && Array.isArray(index.files)) ? index.files : [];
  // THE EMPTY WORKSPACE SAYS SO OUT LOUD. A gate handed an empty string cannot tell "nothing exists
  // yet" from "the index broke", and those call for opposite next steps.
  if (files.length === 0) return `${lead}(none)`;
  const shown = max > 0 ? files.slice(0, max) : files;
  const lines = shown.map(fileLine);
  if (shown.length < files.length) lines.push(`(+${files.length - shown.length} more)`);
  return lead + lines.join('\n');
}

/**
 * THE ACTIONS VALID AT ONE GATE - never the whole menu.
 *
 * This is the measured centre of the gate design. gateLoop.mjs records `finish` scoring 0/10 when it was
 * one option among four and 10/10 as its own yes/no question - same model, same state, same information,
 * only the framing differed. agentPrompt.js by contrast names 10 tools in one prompt (not the 24 the
 * brief suggests - counted today), and every one of them is an option the model can spend a call on.
 * So each list below is the SHORTEST set that gate can act on, and the cap is 4.
 *
 * Each list is justified by what the harness can actually do with the answer, not by what seems tidy:
 *
 *   route   write_file, read_file - EXACTLY what the route gate's own parser accepts today
 *                                  (gateLoop.mjs: /\b(write_file|read_file)\b/, defaulting to
 *                                  write_file). Offering a third action would invite an answer the
 *                                  harness silently discards, which is how a gate learns to be ignored.
 *   path    new_file, existing_file - the path gate answers with a FILENAME, so these are the two shapes
 *                                  that answer can take; the index is what tells it which applies.
 *   body    write_file             - one action, because the body gate's product is file CONTENT and the
 *                                  only thing done with it is a whole-file write. Partial edits are not
 *                                  offered on purpose: edit_file is the call that failed 65 times out of
 *                                  278 in set E, and a 1.5B model choosing between write and edit is a
 *                                  four-way menu in disguise.
 *   repair  write_file, edit_file  - PROSPECTIVE. There is no repair gate in gateLoop.mjs as of
 *                                  2026-09-13 (its four gates are finish, route, path and write), so
 *                                  unlike the others this list is a proposal pinned by a test, not a
 *                                  measurement. Kept to two so it cannot quietly become a menu.
 *   finish  yes, no                - the 10/10 shape. Not a tool name at all: the whole finding is that
 *                                  this is a JUDGEMENT asked alone, and the moment it sits beside
 *                                  write_file it measures 0/10.
 */
const GATE_ACTIONS = {
  route: ['write_file', 'read_file'],
  path: ['new_file', 'existing_file'],
  body: ['write_file'],
  repair: ['write_file', 'edit_file'],
  finish: ['yes', 'no'],
};

/** The actions for one gate, or [] for a gate name that does not exist. Always a fresh array. */
export function actionsFor(gate) {
  const a = GATE_ACTIONS[gate];
  // A COPY, not the table. A prompt builder that push()es onto the returned array would widen the menu
  // for every later call in the process - the kind of action-at-a-distance that would look like the
  // model getting worse over a long run, which is the thing this design is built to protect.
  return a ? [...a] : [];
}
