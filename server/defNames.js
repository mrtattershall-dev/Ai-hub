/**
 * defNames.js - the names a source file DEFINES, so a write that silently drops them can be caught.
 *
 * Measured in set D (2026-09-11): Qwen3-Coder rewrote whole files while fixing something and lost functions it had
 * written correctly - r6_days.py lost add_days, is_weekend and add_business_days in one rewrite; r3_tasks.js lost
 * earliestStart during the very goal that added it, and later ready() the same way. Nothing told the model, and the
 * hidden checks found the holes only at the end. Comparing the names before and after a write turns that silent
 * loss into a sentence the model sees at the moment it happens.
 *
 * Deliberately a NAME comparison, not a parse: it must never throw on the broken code a model writes mid-fix, and a
 * missed name costs nothing (no warning) while a false one only costs a sentence.
 */
const JS_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'with', 'else', 'do', 'try', 'typeof', 'new', 'await', 'yield', 'super', 'constructor']);

/**
 * Every definition name the file declares, in file order, WITH its duplicates - the raw stream behind both
 * defNames() and defCounts().
 *
 * It exists because a Set structurally cannot see the set G bug. `defNames` answers "is this name here?", so a file
 * that gains a SECOND `__init__` looks identical to one that has always had one, and the destructive-write refusal
 * (built on lostDefs) sees nothing to complain about. Counting is the same scan with the Set taken off the end.
 */
function defNameList(src, path = '') {
  const text = String(src || '');
  const out = [];
  const add = (n) => { if (n && !JS_KEYWORDS.has(n)) out.push(n); };
  if (/\.py$/i.test(path)) {
    for (const m of text.matchAll(/^[ \t]*(?:async[ \t]+)?def[ \t]+([A-Za-z_]\w*)|^[ \t]*class[ \t]+([A-Za-z_]\w*)/gm)) add(m[1] || m[2]);
    return out;
  }
  if (!/\.(c?js|mjs)$/i.test(path)) return out;
  // function declarations and classes
  for (const m of text.matchAll(/^[ \t]*(?:export[ \t]+)?(?:default[ \t]+)?(?:async[ \t]+)?function[ \t]*\*?[ \t]*([A-Za-z_$][\w$]*)/gm)) add(m[1]);
  for (const m of text.matchAll(/^[ \t]*(?:export[ \t]+)?(?:default[ \t]+)?class[ \t]+([A-Za-z_$][\w$]*)/gm)) add(m[1]);
  // const/let/var name = (args) => ... | name = function
  for (const m of text.matchAll(/^[ \t]*(?:export[ \t]+)?(?:const|let|var)[ \t]+([A-Za-z_$][\w$]*)[ \t]*=[ \t]*(?:async[ \t]*)?(?:function\b|\([^)\n]*\)[ \t]*=>|[A-Za-z_$][\w$]*[ \t]*=>)/gm)) add(m[1]);
  // class methods: an indented `name(args) {` line (optionally static/async/get/set)
  //
  // A QUOTED ARGUMENT MEANS THIS IS A CALL, NOT A DEFINITION. `it('adds', function () {` and
  // `describe('Library', function() {` have exactly the shape of a method, so every test callback in a mocha file
  // was being recorded as a definition - and then `lostDefs` refused the model's rewrite of its own test file for
  // "removing" them. Set J: two of ten destructive refusals were this, both on test_s7_cache.js.
  // Measured before narrowing: across 42 JS files from sets I and J, 40 indented `name(args) {` lines carry a quote
  // in the argument list, and every one is either an `if (...)` (already dropped by JS_KEYWORDS) or a
  // describe/it/test callback. No real method in the corpus takes a quoted argument, so this costs nothing.
  //
  // KNOWN LIMIT, deliberately not fixed: `assert(x) {` inside a function body is lexically identical to a method in
  // a class body - same shape, plain identifier argument - and only the ENCLOSING BLOCK distinguishes them. This is
  // a line scanner with no block context, so separating those needs scope tracking. That is a rewrite of a function
  // four call sites depend on, for a rarer case that cost wasted calls rather than goals. Left as it is, on purpose.
  for (const m of text.matchAll(/^[ \t]+(?:static[ \t]+)?(?:async[ \t]+)?(?:get[ \t]+|set[ \t]+)?\*?([A-Za-z_$][\w$]*)[ \t]*\(([^)\n]*)\)[ \t]*\{/gm)) {
    if (/["'`]/.test(m[2])) continue;
    add(m[1]);
  }
  return out;
}

export function defNames(src, path = '') {
  return new Set(defNameList(src, path));
}

/**
 * name -> how many times this file defines it.
 *
 * Set G (2026-09-11): s6_graph.py finished at 1987 lines with 28 `def __init__` and 33 `def nodes` inside ONE class,
 * and nothing in the hub said a word. Duplicate methods are LEGAL, so no syntax check fires; `duplicateDecls.js`
 * only looks at column 0 and deliberately exempts class methods; and `lostDefs` compares Sets, so a second copy of
 * a name is invisible to it. A count is the one comparison that can see an ADDED duplicate, which is the mirror
 * image of the removal the destructive-write refusal was built for.
 */
export function defCounts(src, path = '') {
  const counts = new Map();
  for (const n of defNameList(src, path)) counts.set(n, (counts.get(n) || 0) + 1);
  return counts;
}

/** Names defined in `before` that are gone from `after` (sorted). */
export function lostDefs(before, after, path) {
  const a = defNames(before, path), b = defNames(after, path);
  return [...a].filter((n) => !b.has(n)).sort();
}

/**
 * The names a JS file EXPORTS - CommonJS (module.exports = { a, b: c }, module.exports = name, module.exports.x =,
 * exports.x =) and ESM (export function/class/const, export { a, b as c }).
 *
 * Measured in set E (2026-09-11): Qwen3-Coder's goal 54 could not match an edit twice, rewrote q4_template.js whole,
 * and the rewrite dropped `module.exports = { render };`. render() itself was still defined, so defNames saw no
 * loss and the hub said only "OK: wrote 10932 bytes". From then on every require('./q4_template') got undefined:
 * the rest of q4's steps and all of q10 (built on q4) failed at the end. A name comparison, like defNames: it never
 * throws on half-written code, and a missed form costs only a missing warning.
 */
export function exportNames(src, path = '') {
  const out = new Set();
  if (!/\.(c?js|mjs)$/i.test(path)) return out;
  const text = String(src || '');
  for (const m of text.matchAll(/(?:module\.)?exports\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) out.add(m[1]);
  for (const m of text.matchAll(/module\.exports\s*=\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const k = part.trim().match(/^(?:async\s+)?\*?\s*([A-Za-z_$][\w$]*)/);
      if (k) out.add(k[1]);
    }
  }
  for (const m of text.matchAll(/module\.exports\s*=\s*([A-Za-z_$][\w$]*)\s*;?\s*$/gm)) out.add(m[1]);
  for (const m of text.matchAll(/^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) out.add(m[1]);
  for (const m of text.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(',')) {
      const k = part.trim().split(/\s+as\s+/).pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(k)) out.add(k);
    }
  }
  return out;
}

/** Names `before` exported that `after` no longer does (sorted). */
export function lostExports(before, after, path) {
  const a = exportNames(before, path), b = exportNames(after, path);
  return [...a].filter((n) => !b.has(n)).sort();
}
