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

export function defNames(src, path = '') {
  const text = String(src || '');
  const out = new Set();
  const add = (n) => { if (n && !JS_KEYWORDS.has(n)) out.add(n); };
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
  for (const m of text.matchAll(/^[ \t]+(?:static[ \t]+)?(?:async[ \t]+)?(?:get[ \t]+|set[ \t]+)?\*?([A-Za-z_$][\w$]*)[ \t]*\([^)\n]*\)[ \t]*\{/gm)) add(m[1]);
  return out;
}

/** Names defined in `before` that are gone from `after` (sorted). */
export function lostDefs(before, after, path) {
  const a = defNames(before, path), b = defNames(after, path);
  return [...a].filter((n) => !b.has(n)).sort();
}
