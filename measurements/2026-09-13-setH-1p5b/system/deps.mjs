// DEPENDENCY FIREWALL.
//
// THE INVARIANT, which is general rather than a patch for seven observed strings:
//
//   A localized edit to an existing artifact must not introduce a new UNRESOLVED dependency
//   unless the goal explicitly requires one.
//
// WHY. On setH goals 21-40 the dominant failure was not "cannot implement Graph.shortest_path" -
// the model rarely reached that question. Asked to add ONE method it reached for `networkx`,
// `markdown`, `eval`, `lib`, `./queue`, and the file stopped loading before any member could be
// evaluated. Nine of twelve genuine failures were load errors, seven of them invented dependencies.
//
// THE ROUTING RULE THAT MATTERS MOST: an unresolved LOCAL import is NOT evidence that the task
// needed that file. `./queue` is hallucination, not a missing artifact. So generate_artifact fires
// only when the typed contract establishes the artifact ought to exist. Otherwise the candidate must
// be rewritten WITHOUT the invented dependency. Routing hallucinations to a generation gate would
// institutionalize them.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Node builtins that resolve without installation.
const NODE_BUILTIN = new Set(['assert', 'buffer', 'child_process', 'crypto', 'events', 'fs', 'http',
  'https', 'net', 'os', 'path', 'process', 'querystring', 'readline', 'stream', 'string_decoder',
  'timers', 'tls', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib', 'assert/strict']);

// Python standard library modules these goals could legitimately reach for.
const PY_STDLIB = new Set(['abc', 'argparse', 'ast', 'base64', 'bisect', 'collections', 'copy', 'csv',
  'datetime', 'decimal', 'enum', 'functools', 'hashlib', 'heapq', 'html', 'io', 'itertools', 'json',
  'math', 'os', 'pathlib', 'pprint', 're', 'random', 'statistics', 'string', 'sys', 'textwrap',
  'time', 'types', 'typing', 'unittest', 'uuid', 'warnings', 'collections.abc', 'dataclasses']);

export function extractDeps(src, lang) {
  const out = [];
  const add = (name, kind, raw) => { if (!out.some((d) => d.name === name)) out.push({ name, kind, raw }); };
  if (lang === 'py') {
    for (const m of src.matchAll(/^\s*import\s+([A-Za-z_][\w.]*)/gm)) add(m[1].split('.')[0], 'module', m[0].trim());
    for (const m of src.matchAll(/^\s*from\s+([A-Za-z_.][\w.]*)\s+import\b/gm)) add(m[1].replace(/^\.+/, '').split('.')[0] || m[1], 'module', m[0].trim());
    // Files opened at module scope are resources the artifact depends on at import time.
    for (const m of src.matchAll(/open\(\s*['"]([^'"]+)['"]/g)) add(m[1], 'resource', m[0]);
  } else {
    for (const m of src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) add(m[1], 'module', m[0]);
    for (const m of src.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)) add(m[1], 'module', m[0].trim());
    for (const m of src.matchAll(/readFileSync\(\s*['"]([^'"]+)['"]/g)) add(m[1], 'resource', m[0]);
  }
  return out;
}

const isLocal = (n) => n.startsWith('.') || n.startsWith('/');

// Classify every dependency the candidate introduces that the ORIGINAL did not have.
export function firewall({ candidate, original, lang, ws, goalText, contract }) {
  const before = new Set(extractDeps(original || '', lang).map((d) => d.name));
  const now = extractDeps(candidate, lang);
  const declared = (() => {
    try {
      const p = join(ws, 'package.json');
      const j = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
      return new Set(Object.keys(j.dependencies || {}).concat(Object.keys(j.devDependencies || {})));
    } catch (e) { return new Set(); }
  })();
  // A dependency the GOAL names is authorised - "require them" in goal 10 is explicit permission.
  const goalAuthorised = (n) => new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/^\.\//, '') + '\\b').test(goalText || '');

  const findings = [];
  for (const d of now) {
    if (before.has(d.name)) continue;                       // not new - inherited, not introduced
    const bare = d.name.replace(/^\.\//, '').replace(/\.(js|py|json|css)$/i, '');

    if (d.kind === 'resource') {
      const resolved = existsSync(join(ws, d.name));
      findings.push({ ...d, cls: resolved ? 'NEW_DEP_OK' : 'NEW_RESOURCE_UNRESOLVED' });
      continue;
    }
    const builtin = lang === 'py' ? PY_STDLIB.has(d.name) : NODE_BUILTIN.has(d.name);
    if (builtin) { findings.push({ ...d, cls: 'NEW_DEP_OK', why: 'runtime builtin' }); continue; }
    if (declared.has(d.name)) { findings.push({ ...d, cls: 'NEW_DEP_OK', why: 'declared project dependency' }); continue; }

    if (isLocal(d.name) || lang === 'js') {
      // A local artifact that exists is fine; one that does not is unresolved-LOCAL, and is NOT
      // automatically a missing artifact - see the routing rule at the top of this file.
      const candidates = [d.name, d.name + '.js', d.name + '.py', bare + '.js', bare + '.py'];
      if (candidates.some((f) => existsSync(join(ws, f.replace(/^\.\//, ''))))) {
        findings.push({ ...d, cls: 'NEW_DEP_OK', why: 'existing local artifact' });
        continue;
      }
      if (isLocal(d.name)) {
        findings.push({ ...d, cls: 'NEW_DEP_UNRESOLVED_LOCAL',
          contractRequires: !!(contract && contract.files && contract.files.includes(bare + '.js')) });
        continue;
      }
    }
    findings.push({ ...d, cls: goalAuthorised(bare) ? 'NEW_DEP_OK' : 'NEW_DEP_UNRESOLVED_EXTERNAL',
      why: goalAuthorised(bare) ? 'named by the goal' : undefined });
  }
  const bad = findings.filter((f) => f.cls !== 'NEW_DEP_OK');
  return { ok: bad.length === 0, findings, violations: bad };
}

// Statements that run at IMPORT time and are not part of defining the module's API. These are what
// turn a correct implementation into an unloadable artifact, and what let a file rewrite itself.
export function loadSideEffects(src, lang) {
  const hits = [];
  const push = (kind, line) => hits.push({ kind, line: line.trim().slice(0, 90) });
  const lines = src.split('\n');
  for (const l of lines) {
    if (/^\s/.test(l) || !l.trim()) continue;               // top level only
    if (lang === 'py') {
      if (/^\s*(?:if\s+__name__|import|from|def|class|#|@|"""|')/.test(l)) continue;
      if (/\bopen\(/.test(l)) push('reads_a_file_at_import', l);
      else if (/^\w[\w.]*\(/.test(l)) push('calls_at_import', l);
    } else {
      if (/^\s*(?:const|let|var|function|class|module\.exports|exports\.|\/\/|\/\*|import|export)/.test(l)) continue;
      if (/writeFileSync|unlinkSync|rmSync|renameSync/.test(l)) push('writes_files_at_import', l);
      else if (/^(?:describe|it|test)\(/.test(l)) push('test_harness_at_import', l);
      else if (/^\w[\w.]*\(/.test(l)) push('calls_at_import', l);
    }
  }
  return hits;
}
