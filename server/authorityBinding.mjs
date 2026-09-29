// ══════════════════════════════════════════════════════════════════════════════════════════════════
// authorityBinding.mjs — bind to an authority stack EXPLICITLY, and record exactly what was loaded.
//
// WHY NOT A RELATIVE SIBLING IMPORT. `../ai-coding-hub-consolidation/legasus/...` silently binds the
// experiment to whichever mutable checkout happens to sit next to it, and nothing in the resulting
// record says which one that was, at which commit, with which contents. That is the provenance problem
// this project keeps finding in other systems, reproduced at home.
//
// ══ WHY A FILE LISTING UNDER THE ROOT IS NOT ENOUGH ══════════════════════════════════════════════
// Digesting "the files found under --authority-root" answers a different question from "what did Node
// actually load". Resolution can walk outside the root through a relative specifier, a symlink, or a
// package export; and the module cache is keyed by RESOLVED URL, so a name is not an identity.
//
// So the manifest is built by WALKING THE MODULE GRAPH FROM THE ENTRY POINTS: read each module's
// source, extract its static import specifiers, resolve each one the way Node will, and recurse. Every
// URL in the manifest is a URL that is actually imported, and each is digested from the bytes at that
// URL. A transitive dependency living outside the root APPEARS IN THE MANIFEST rather than being
// quietly excluded by it - which is the property `authorityBinding.test.mjs` pins directly.
//
// THE ONE LIMIT, AND IT IS ENFORCED RATHER THAN DECLARED. Only STATIC import specifiers can be
// followed: a dynamic `import(expr)` with a COMPUTED specifier cannot be resolved without running it,
// so it would be absent from the manifest and the record would silently understate what was loaded.
// Rather than write that down and hope, the walk REFUSES a module containing one. A limit nobody
// checks is a comment; a limit that fails the bind is a boundary. `import('literal')` is fine - it
// resolves like any other specifier and is followed.
//
// FAIL CLOSED. A missing root, a missing expected export, or a manifest digest that differs from the
// pin all throw. A binding that degrades to "run anyway and mention it" is not a binding.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve as resolvePath, join } from 'node:path';

const sha256 = (b) => createHash('sha256').update(b).digest('hex');

/** Static import/export-from specifiers. Deliberately simple: the walk is over source we control. */
function specifiersOf(src) {
  const out = new Set();
  const re = /(?:^|[\s;}])(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
  for (const m of src.matchAll(re)) out.add(m[1]);
  // bare `import 'x'` side-effect form
  for (const m of src.matchAll(/(?:^|[\s;}])import\s+['"]([^'"]+)['"]/g)) out.add(m[1]);
  // LITERAL dynamic form, `import('./x.mjs')`. Without this the refusal above would be the only thing
  // that ever noticed a dynamic import: a computed one failed the bind while a literal one was silently
  // passed over and left out of the manifest. Its own test caught that - "the refusal is narrow" was
  // false, because nothing was following the narrow case.
  for (const m of src.matchAll(/(?:^|[^.\w$])import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) out.add(m[1]);
  return [...out];
}

/**
 * A dynamic import whose specifier is NOT a plain string literal. A literal resolves statically and is
 * followed like any other specifier; a computed one cannot be resolved without executing it.
 */
function computedDynamicImportIn(src) {
  const LF = String.fromCharCode(10);
  const lineComment = new RegExp('(^|[^:])//[^' + LF + ']*', 'g');
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(lineComment, '$1');
  for (const m of stripped.matchAll(/(?:^|[^.\w$])import\s*\(\s*([^)]*?)\s*\)/g)) {
    const arg = m[1].trim();
    if (/^'[^']*'$/.test(arg) || /^"[^"]*"$/.test(arg)) continue;   // a plain literal: resolvable
    if (/^`[^`$]*`$/.test(arg)) continue;                              // a template with no substitution
    return arg.slice(0, 60);
  }
  return null;
}

/**
 * Walk the module graph from `entryUrls`, following static imports, and digest every file actually
 * reachable. Node builtins (`node:fs`) and bare package specifiers are recorded as EXTERNAL rather
 * than digested - they are not part of the authority stack's own identity, and saying so is better
 * than silently dropping them.
 */
function walkModuleGraph(entryUrls) {
  const seen = new Map();
  const external = new Set();
  const stack = [...entryUrls];
  while (stack.length) {
    const url = stack.pop();
    if (seen.has(url)) continue;
    let src;
    try { src = readFileSync(fileURLToPath(url), 'utf8'); }
    catch (e) { throw new Error(`authorityBinding: cannot read ${url}: ${e.message}`); }
    seen.set(url, sha256(Buffer.from(src, 'utf8')));
    const dynamic = computedDynamicImportIn(src);
    if (dynamic) {
      throw new Error(`authorityBinding: ${url} contains a dynamic import with a computed specifier `
        + `(${dynamic}). It cannot be resolved without executing it, so the manifest would understate `
        + 'what this run loaded. Failing closed rather than recording a partial identity.');
    }
    for (const spec of specifiersOf(src)) {
      if (spec.startsWith('node:') || !(spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('file:'))) {
        external.add(spec);
        continue;
      }
      let resolved;
      try { resolved = new URL(spec, url).href; }
      catch { external.add(spec); continue; }
      if (!seen.has(resolved)) stack.push(resolved);
    }
  }
  return { modules: seen, external: [...external].sort() };
}

function gitCommitOf(root) {
  try {
    return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}
function gitDirtyIn(root) {
  try {
    return execFileSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().length > 0;
  } catch { return null; }
}

/** The modules and exports the governed runner depends on. Named here so a drift is loud. */
export const AUTHORITY_CONTRACT = Object.freeze({
  'legasus/runtime/epistemic-admission/governed-edit.mjs':
    ['governedEdit', 'editAction', 'revisionOf', 'OUTCOME', 'DISPOSITION', 'EDIT_FIXTURE', 'EDIT_FIXTURE_EVIDENCED'],
  'legasus/runtime/governedWorkspace/workspace.mjs':
    ['createWorkspace', 'fileScope', 'EVENT', 'PACKET', 'EFFECT_OUTCOME'],
  // The evidence half. A governed promotion mints an EPISTEMIC token about the target at the observed
  // revision, so these are as load-bearing as the executor and are named here for the same reason: a
  // drift in what they export should fail the bind rather than surface as a confusing refusal later.
  'legasus/legaknow/calculus.mjs': ['delegate', 'observe', 'isAuthority'],
  'legasus/legaknow/observation.mjs': ['observation', 'OBSERVABILITY'],
});

/**
 * Bind. Returns the loaded modules plus an identity fit to put in a run record.
 *
 *   const a = await bindAuthority({ root: '../ai-coding-hub-consolidation', pin: '<manifestDigest>' });
 *   a.identity   -> { root, commit, dirty, manifestDigest, moduleCount, external }
 *   a.modules    -> { 'governed-edit.mjs': <namespace>, ... }
 */
export async function bindAuthority({ root, pin = null, contract = AUTHORITY_CONTRACT }) {
  if (!root) throw new Error('authorityBinding: --authority-root is required. A governed run may not guess where its authority stack lives.');
  const abs = resolvePath(root);
  if (!existsSync(abs)) throw new Error(`authorityBinding: authority root ${abs} does not exist. Failing closed.`);

  const entries = Object.keys(contract);
  const entryUrls = entries.map((rel) => {
    const p = join(abs, rel);
    if (!existsSync(p)) throw new Error(`authorityBinding: ${rel} is not present under ${abs}. Failing closed.`);
    return pathToFileURL(p).href;
  });

  const { modules: graph, external } = walkModuleGraph(entryUrls);
  // The manifest digest covers every resolved URL AND its bytes, in a stable order. Two checkouts with
  // identical contents at different paths differ here - deliberately: the record names WHICH one ran.
  const manifest = [...graph.entries()].map(([url, sha]) => ({ url, sha })).sort((a, b) => (a.url < b.url ? -1 : 1));
  const manifestDigest = sha256(manifest.map((m) => `${m.url} ${m.sha}`).join('\n'));

  if (pin && pin !== manifestDigest) {
    throw new Error(`authorityBinding: manifest digest ${manifestDigest.slice(0, 16)} does not match the pin `
      + `${String(pin).slice(0, 16)}. The authority stack is not the one this run was pinned to. Failing closed.`);
  }

  const loaded = {};
  for (const [rel, expectedExports] of Object.entries(contract)) {
    const url = pathToFileURL(join(abs, rel)).href;
    const ns = await import(url);
    const missing = expectedExports.filter((e) => !(e in ns));
    if (missing.length) {
      throw new Error(`authorityBinding: ${rel} does not export ${missing.join(', ')}. `
        + 'The export contract has drifted; failing closed rather than binding to a different interface.');
    }
    loaded[rel] = ns;
  }

  return {
    modules: loaded,
    identity: Object.freeze({
      root: abs,
      commit: gitCommitOf(abs),
      dirty: gitDirtyIn(abs),
      manifestDigest,
      moduleCount: manifest.length,
      external,
      contract: Object.fromEntries(Object.entries(contract).map(([k, v]) => [k, [...v]])),
    }),
    manifest,
  };
}

export const _internal = { specifiersOf, walkModuleGraph, sha256 };
