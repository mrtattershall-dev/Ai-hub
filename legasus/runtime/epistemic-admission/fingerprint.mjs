// SEMANTIC DEPENDENCY CLOSURE for a rule fingerprint.
//
// A rule's identity must cover what the rule MEANS, and a matcher means its own source PLUS the
// behaviour of what it calls. R-W4 showed the consequence of covering only the source: the world
// check changed from one tolerant comparison to two equality checks and an ordering, and the
// fingerprints were byte-identical.
//
// THE CLOSURE IS DERIVED, NOT DECLARED. A hand-maintained `dependencies: [...]` list would mean
// "the rule means whatever the author remembered", which is the same defect one level out.
//
// AND PARTIALITY IS AN OUTCOME. If a callee cannot be faithfully resolved the answer is
// FINGERPRINT_UNRESOLVED, never a hash over a closure known to be incomplete. A fingerprint that
// lies about what it covers is worse than no fingerprint.
import { createHash } from 'node:crypto';

export const UNRESOLVED = 'FINGERPRINT_UNRESOLVED';

const norm = (s) => s.replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();

// Function definitions a module declares, by name. Both statement and arrow-const forms.
export function definitionsIn(source) {
  const src = source.replace(/\r/g, '');
  const out = new Map();
  for (const m of src.matchAll(/^\s*(?:export\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
    out.set(m[1], extractBody(src, m.index));
  }
  for (const m of src.matchAll(/^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/gm)) {
    out.set(m[1], extractBody(src, m.index));
  }
  return out;
}

// From a declaration start, take the balanced region that follows. Deliberately simple: if the
// braces or parens do not balance, the definition is reported as unextractable and the closure
// becomes UNRESOLVED rather than silently truncated.
function extractBody(src, from) {
  const open = src.indexOf('{', src.indexOf('(', from));
  const arrow = src.indexOf('=>', from);
  const start = (arrow !== -1 && (open === -1 || arrow < open)) ? src.indexOf('{', arrow) : open;
  if (start === -1) {                       // a single-expression arrow: take to end of statement
    const semi = src.indexOf(';', from);
    return semi === -1 ? null : src.slice(from, semi + 1);
  }
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(from, i + 1); }
  }
  return null;                              // unbalanced -> unextractable
}

// Names a body calls. Lexical, and deliberately conservative: anything that looks like a call is a
// candidate, and anything that cannot be classified makes the closure UNRESOLVED.
const CALLS = /(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
const SYNTAX = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function',
  'async', 'await', 'new', 'do', 'else', 'of', 'in']);

// A DECLARATION IS NOT A CALL, AND TEXT INSIDE A STRING IS NOT CODE.
//
// Two ways this scanner read something that was not a call, both found by running it:
//   `function name(`   a function's own header looks exactly like a call to itself
//   'this derivation (' a PROSE FRAGMENT inside an error message looks like a call to `derivation`
//
// Headers are rewritten and quoted strings are emptied. A template literal is NOT stripped, because
// its `${}` segments can contain real calls and removing it would UNDER-count the closure - silent
// false stability, which is worse than refusing. A body containing one is reported unanalysable.
// THIRD way this scanner read something that was not a call, and the sixth of its kind in this
// sequence: a COMMENT. `// the root must establish COVERAGE(subject, object)` is prose, and the
// scanner called it a call to `COVERAGE`. Comments are removed, and `\r` FIRST, because a line
// comment pattern anchored to `$` cannot reach end-of-string on a CRLF file.
export const TEMPLATE_LITERAL = 'a template literal, whose ${} segments may contain calls this'
  + ' lexical scanner cannot separate from its literal text';
export const INTERLEAVED = 'comment syntax inside a string literal, which this lexical scanner'
  + ' cannot order safely - stripping comments first could delete real calls after it';

const stripComments = (s) => s.replace(/\r/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\/\/[^\n]*/g, ' ');
const stripStrings = (s) => s.replace(/'(?:[^'\\]|\\.)*'/g, "''")
  .replace(/"(?:[^"\\]|\\.)*"/g, '""');

const callsIn = (body) => stripStrings(stripComments(body))
  .replace(/function\s+[A-Za-z_$][\w$]*\s*\(/g, 'function (')
  .matchAll(CALLS);

const hasTemplate = (body) => /`/.test(stripStrings(stripComments(body)));

// If a string literal itself contains comment syntax, the two strippers cannot be safely ordered:
// comments-first would truncate the string and could delete real calls that follow on that line,
// which is an UNDER-count and therefore silent false stability. Refuse instead.
const hasInterleaved = (body) => {
  const noComments = stripComments(body);
  for (const m of noComments.matchAll(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g)) {
    if (m[0].includes('//') || m[0].includes('/*')) return true;
  }
  return false;
};

// Imported bindings, and where from. A node: builtin is admitted ground; anything else is a
// dependency this builder cannot see into.
export function importsIn(source) {
  const out = new Map();
  for (const m of source.replace(/\r/g, '')
    .matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/).pop().trim();
      if (name) out.set(name, m[2]);
    }
  }
  return out;
}

// THE CLOSURE. Returns { ok, closure: [{name, source}], grounds: [...] } or { ok:false, why }.
export function semanticClosure(entryName, entrySource, modules) {
  const defs = new Map();
  const imports = new Map();
  for (const m of modules) {
    for (const [n, b] of definitionsIn(m.source)) if (!defs.has(n)) defs.set(n, { body: b, from: m.path });
    for (const [n, f] of importsIn(m.source)) if (!imports.has(n)) imports.set(n, f);
  }

  const seen = new Map();
  const grounds = new Set();
  const queue = [[entryName, entrySource]];
  while (queue.length) {
    const [name, body] = queue.shift();
    if (body === null || body === undefined) {
      return { ok: false, why: UNRESOLVED + ': the body of "' + name + '" could not be extracted,'
        + ' so what it means cannot be covered' };
    }
    if (seen.has(name)) continue;
    if (hasTemplate(body)) {
      return { ok: false, why: UNRESOLVED + ': "' + name + '" contains ' + TEMPLATE_LITERAL };
    }
    if (hasInterleaved(body)) {
      return { ok: false, why: UNRESOLVED + ': "' + name + '" contains ' + INTERLEAVED };
    }
    // the HASHED form is comment-free, so a prose edit cannot move a fingerprint either
    seen.set(name, norm(stripComments(body)));
    for (const c of callsIn(body)) {
      const callee = c[1];
      if (SYNTAX.has(callee) || callee === name) continue;
      if (defs.has(callee)) { queue.push([callee, defs.get(callee).body]); continue; }
      if (imports.has(callee)) {
        const from = imports.get(callee);
        if (from.startsWith('node:')) { grounds.add(callee + ' <- ' + from); continue; }
        return { ok: false, why: UNRESOLVED + ': "' + callee + '" is imported from "' + from
          + '", which this builder cannot see into' };
      }
      if (typeof globalThis[callee] !== 'undefined') { grounds.add(callee + ' <- global'); continue; }
      return { ok: false, why: UNRESOLVED + ': "' + callee + '" called by "' + name
        + '" resolves to no definition, import or global. A closure with an unknown member is not a'
        + ' closure.' };
    }
  }
  return { ok: true,
    closure: [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, source]) => ({ name, source })),
    grounds: [...grounds].sort() };
}

// The fingerprint over a rule declaration PLUS the semantic closure of each matcher.
export function fingerprintOf(rule, modules) {
  const parts = [];
  for (const ob of [...rule.obligations].sort((a, b) => a.relation.localeCompare(b.relation))) {
    const entry = '__matcher_' + ob.relation;
    const cl = semanticClosure(entry, ob.satisfiedBy.toString(), modules);
    if (!cl.ok) return { ok: false, why: cl.why };
    parts.push({ relation: ob.relation, closure: cl.closure, grounds: cl.grounds });
  }
  const canonical = JSON.stringify({ name: rule.name, version: rule.version, obligations: parts });
  return { ok: true, digest: createHash('sha256').update(canonical).digest('hex'),
    covered: parts.flatMap((p) => p.closure.map((c) => c.name)) };
}
