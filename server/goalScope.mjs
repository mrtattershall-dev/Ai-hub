/**
 * goalScope.mjs - FG-2 SCOPE. Which files is a goal ABOUT?
 *
 * Contract: legasus/screen/FG-2-SCOPE_PREREG.md. PURE: no git, no shell, no network. Reads source text
 * only to follow static imports. The finish gate (verifyProject.verify) uses this to decide which
 * breakage may BLOCK a finish and which is merely a loud note about something the goal never named.
 *
 *   scope(workspace, { goal, entry, files }) -> {
 *     named:      true when the goal (or entry) names at least one existing file; false -> whole workspace
 *     inScope:    Set of workspace-relative paths: the named files + their forward dependency closure
 *     outOfScope: every other file in `files`
 *     tests:      python test files that belong to the scope (import a scoped module, are named
 *                 test_<m>.py / <m>_test.py for a scoped module m, or are named by the goal)
 *   }
 *
 * FORWARD graph only: what the goal's files require. d2.consumersOf is the REVERSE graph (who requires
 * X) and reads `git ls-files`; the served hub's gate must not depend on git, and it needs this direction.
 *
 * BLIND SPOTS, stated: `require(someVariable)` and computed import paths are not followed; package
 * imports (node_modules) are never in scope by construction; the closure is bounded at 80 files like
 * the sweeps. A dependency the resolver cannot see is judged as OUT of scope - so a goal's file that
 * breaks through such a dependency still blocks via its own load failure (the load sweep runs the file).
 */
import { readFileSync } from 'node:fs';
import { namedFiles } from './taskLedger.js';

export const SCOPE_CAP = 80;
const JS = /\.(c|m)?js$/i, PY = /\.py$/i;
const posix = (p) => p.split('\\').join('/');
const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
function normalize(parts) {
  const out = [];
  for (const seg of parts.split('/')) { if (!seg || seg === '.') continue; if (seg === '..') out.pop(); else out.push(seg); }
  return out.join('/');
}

/** Static import specifiers in a JS source: './x', '../x' only (package names are never workspace files). */
export function jsSpecifiers(src) {
  const out = new Set();
  const re = /(?:require\s*\(\s*|import\s*\(\s*|from\s+|import\s+)['"](\.{1,2}\/[^'"\n]+)['"]/g;
  let m; while ((m = re.exec(src))) out.add(m[1]);
  return [...out];
}
/** Local module names in a Python source: `import m`, `from m import`, dotted allowed. */
export function pySpecifiers(src) {
  const out = new Set();
  const re = /^\s*(?:from\s+([\w.]+)\s+import\b|import\s+([\w.]+(?:\s*,\s*[\w.]+)*))/gm;
  let m; while ((m = re.exec(src))) { if (m[1]) out.add(m[1]); else for (const n of m[2].split(',')) out.add(n.trim().split(/\s+as\s+/)[0]); }
  return [...out].filter((n) => !n.startsWith('.') || true);
}

function resolveJs(fromFile, spec, have) {
  const base = normalize(`${dirOf(fromFile)}/${spec}`);
  for (const c of [base, `${base}.js`, `${base}.mjs`, `${base}.cjs`, `${base}/index.js`, `${base}/index.mjs`, `${base}/index.cjs`]) if (have.has(c)) return c;
  return null;
}
function resolvePy(fromFile, mod, have) {
  const rel = mod.replace(/^\.+/, '').split('.').join('/');
  if (!rel) return null;
  for (const root of [dirOf(fromFile), '']) {
    const base = normalize(root ? `${root}/${rel}` : rel);
    for (const c of [`${base}.py`, `${base}/__init__.py`]) if (have.has(c)) return c;
  }
  return null;
}

export function scope(workspace, { goal = '', entry = null, files = [] } = {}) {
  const all = files.map(posix);
  const have = new Set(all);
  const lower = new Map(all.map((f) => [f.toLowerCase(), f]));
  // namedFiles() lower-cases; map back to the real path when one exists.
  // Only the GOAL narrows the scope (FG-2 Amendment 1). On the served path the entry is derived from the
  // goal, so nothing is lost; an entry-only caller (tests, harnesses) keeps the whole workspace - the
  // contract c8c3ff2f's load sweep froze for that case. `entry` is accepted and ignored for naming.
  void entry;
  const named = [];
  for (const n of namedFiles(goal)) { const real = lower.get(posix(n).toLowerCase()); if (real) named.push(real); }
  if (!named.length) return { named: false, inScope: new Set(all), outOfScope: [], tests: all.filter(isPyTest) };

  const inScope = new Set(); const queue = [...named];
  while (queue.length && inScope.size < SCOPE_CAP) {
    const f = queue.shift(); if (inScope.has(f)) continue; inScope.add(f);
    let src; try { src = readFileSync(`${workspace}/${f}`, 'utf8'); } catch { continue; }
    const deps = JS.test(f) ? jsSpecifiers(src).map((s) => resolveJs(f, s, have)) : PY.test(f) ? pySpecifiers(src).map((m) => resolvePy(f, m, have)) : [];
    for (const d of deps) if (d && !inScope.has(d)) queue.push(d);
  }
  const bases = new Set([...inScope].filter((f) => PY.test(f)).map((f) => f.split('/').pop().replace(/\.py$/i, '')));
  const goalNamed = new Set(named.map((n) => n.toLowerCase()));
  const tests = all.filter(isPyTest).filter((t) => {
    if (inScope.has(t) || goalNamed.has(t.toLowerCase())) return true;
    const b = t.split('/').pop().replace(/\.py$/i, '');
    for (const m of bases) if (b === `test_${m}` || b === `${m}_test`) return true;
    let src; try { src = readFileSync(`${workspace}/${t}`, 'utf8'); } catch { return false; }
    return pySpecifiers(src).some((m) => { const r = resolvePy(t, m, have); return r && inScope.has(r); });
  });
  return { named: true, inScope, outOfScope: all.filter((f) => !inScope.has(f)), tests };
}
export const isPyTest = (f) => /(^|\/)(test_[^/]*\.py|[^/]*_test\.py)$/i.test(f) || (/(^|\/)tests?\//i.test(f) && PY.test(f));
