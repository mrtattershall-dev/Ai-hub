/**
 * duplicateDecls.js - top-level functions declared more than once.
 *
 * Declaring the same top-level function twice is LEGAL JavaScript (and Python): no syntax
 * error, no warning, and the LAST declaration silently wins. `node --check` cannot see it,
 * so the post-write syntax verdict says "passed" while the file no longer does what it did.
 *
 * Found in the 14B-vs-32B head-to-head (2026-09-10): asked to add obstacles to an EXISTING
 * canvas game, both models appended new versions of functions that already existed. The 14B's
 * u8_game.js ended with update() declared 4 times - the winning one never called
 * requestAnimationFrame, so the game ran one frame and froze. The 32B's ended with update() x2,
 * checkCollisions() x3 and gameOver() x3 - the winning collision check used a radius the
 * obstacles did not have, so Game Over could never fire. Both also silently undid the previous
 * goal's working game. Scanning all 72 code files the two runs left behind flags exactly those
 * games, the 30-minute run's game (render x2) and one dead wrap() in a Python file - nothing else.
 *
 * TOP LEVEL ONLY: a declaration starting in column 0. Methods of different classes and nested
 * helpers are indented, so same-named ones there are never reported. Duplicate const/let are
 * already real SyntaxErrors, which the syntax check catches - function declarations are the
 * silent case.
 */

const JS_DECL = /^(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/;
const PY_DECL = /^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/;

/** [{ name, lines }] for every top-level function declared more than once. */
export function duplicateTopLevel(src, path = '') {
  const re = /\.py$/i.test(path) ? PY_DECL : JS_DECL;
  const seen = new Map();
  String(src || '').split(/\r?\n/).forEach((line, i) => {
    const m = line.match(re);
    if (!m) return;
    if (!seen.has(m[1])) seen.set(m[1], []);
    seen.get(m[1]).push(i + 1);
  });
  return [...seen].filter(([, lines]) => lines.length > 1).map(([name, lines]) => ({ name, lines }));
}

/** The model-facing warning, or '' when there is nothing to say. */
export function duplicateNote(src, path) {
  return duplicateTopLevel(src, path).map(({ name, lines }) =>
    `\n\n⚠️ ${path} declares ${name}() ${lines.length} times at the top level (lines ${lines.join(', ')}). `
    + `Only the LAST one runs - the others are dead code, and whatever they did is gone. `
    + `Merge them into ONE ${name}() (edit the existing one instead of appending another).`).join('');
}
