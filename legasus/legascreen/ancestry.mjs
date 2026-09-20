// LEGASCREEN — BACKWARD-1, the ancestry half.
//
// A sink fired. The question is what reached it, and whether that path is something PRODUCTION can
// take or only something a test can take.
//
//     TEST-ONLY ACCESSIBILITY CANNOT ESTABLISH PRODUCTION REACHABILITY.
//
// It establishes test behaviour and nothing more. So reachability is a coordinate with a value -
// PRODUCTION_REACHED, TEST_ONLY, UNREACHED - and never an absence.
//
// A TEST-ONLY EXPORT IS DISCOVERED, NOT NAMED. An export referenced only from test files is
// test-only, whatever it is called. Nothing here knows about any particular convention, so a subject
// that bolts aggregate handles onto a monolith to make it testable is recognised for what it is
// rather than walked through.
import { parse } from 'acorn';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { REACHABILITY, isTestFile } from './sink.mjs';

const walk = (node, fn) => {
  if (!node || typeof node.type !== 'string') return;
  fn(node);
  for (const k of Object.keys(node)) {
    if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && walk(c, fn));
    else if (v && typeof v.type === 'string') walk(v, fn);
  }
};
const FN = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const nm = (n) => (n && n.type === 'Identifier' ? n.name : null);

const sources = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.[cm]?js$/.test(p)) out.push(p);
  }
  return out;
};

// One index of the tree: every function with its line span and whether it is exported, plus the
// identifier references each file makes, so test-only exports can be computed.
export function indexTree(root) {
  const byFile = new Map();
  const refs = new Map();                      // identifier -> Set(files that mention it)
  for (const file of sources(root)) {
    const key = relative(root, file).split(sep).join('/');
    let ast;
    try { ast = parse(readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', locations: true }); }
    catch { try { ast = parse(readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'script', locations: true }); } catch { continue; } }

    const funcs = [];
    const exported = new Set();
    const declared = new Set();
    const aggregates = [];
    const add = (name, node, isExp) => {
      if (!node || !node.loc) return;
      funcs.push({ name: name || '<anonymous>', exported: !!isExp,
        from: node.loc.start.line, to: node.loc.end.line });
      if (isExp && name) exported.add(name);
    };
    for (const n of ast.body) {
      if (n.type === 'FunctionDeclaration') add(nm(n.id), n, false);
      if (n.type === 'VariableDeclaration') {
        for (const d of n.declarations) if (d.init && FN.has(d.init.type)) add(nm(d.id), d.init, false);
      }
      if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (nm(d.id)) declared.add(nm(d.id));
      if (n.type === 'FunctionDeclaration' && nm(n.id)) declared.add(nm(n.id));
      if (n.type === 'ExportNamedDeclaration' && n.declaration
          && n.declaration.type === 'VariableDeclaration') {
        for (const v of n.declaration.declarations) {
          if (v.init && v.init.type === 'ObjectExpression' && nm(v.id)) {
            aggregates.push({ name: nm(v.id),
              props: v.init.properties.filter((pr) => pr.value && pr.value.type === 'Identifier')
                .map((pr) => pr.value.name) });
          }
        }
      }
      if (n.type === 'ExportNamedDeclaration' && n.declaration) {
        const d = n.declaration;
        if (d.type === 'FunctionDeclaration') add(nm(d.id), d, true);
        if (d.type === 'VariableDeclaration') {
          for (const v of d.declarations) {
            if (v.init && FN.has(v.init.type)) add(nm(v.id), v.init, true);
            else if (nm(v.id)) exported.add(nm(v.id));
          }
        }
      }
      if (n.type === 'ExportNamedDeclaration' && !n.declaration) {
        for (const s of n.specifiers) {
          exported.add(s.exported.name);
          const f = funcs.find((x) => x.name === s.local.name);
          if (f) f.exported = true;
        }
      }
    }
    // Any nested function too, so a private helper inside another function is still locatable.
    walk(ast, (n) => { if (FN.has(n.type) && n.loc && !funcs.some((f) => f.from === n.loc.start.line)) {
      funcs.push({ name: nm(n.id) || '<anonymous>', exported: false,
        from: n.loc.start.line, to: n.loc.end.line });
    } });

    // OBSERVABILITY IS A COORDINATE. The loader technique substitutes ES MODULES; a CommonJS module
    // is not unmeasured, it is UNOBSERVABLE BY THIS INSTRUMENT, and a coverage number that hides
    // that region would repeat the unparsed-frame error at repository scale.
    const esm = ast.body.some((n) => /^(Import|Export)/.test(n.type));
    const cjs = !esm && /\brequire\s*\(|\bmodule\.exports\b/.test(readFileSync(file, 'utf8'));
    byFile.set(key, { funcs, exported: [...exported], declared: [...declared],
      aggregates, test: isTestFile(key),
      observability: esm ? 'OBSERVABLE' : cjs ? 'UNOBSERVABLE_BY_THIS_INSTRUMENT' : 'NO_MODULE_SYNTAX' });
    walk(ast, (n) => {
      if (n.type !== 'Identifier') return;
      if (!refs.has(n.name)) refs.set(n.name, new Set());
      refs.get(n.name).add(key);
    });
  }
  return { root, byFile, refs };
}

// A TEST BACKDOOR IS A STRUCTURE, NOT A CONSUMER COUNT.
//
// The first version called an export test-only when every file mentioning it outside its own module
// was a test. On this subject that flagged 192 exports, including a plain function and a constant,
// and drove PRODUCTION_REACHED to zero. The rule had conflated two different facts:
//
//     NO_PRODUCTION_CONSUMER   nobody but the tests happens to call it in THIS repository
//     TEST_BACKDOOR            it exists in order to reach module internals from outside
//
// The first is a property of the repository; the second is a property of the export. Letting who
// happens to reference something decide what it IS, is the same mistake this whole line of work
// exists to detect - an incidental property of the representation choosing the semantics.
//
// The structural signature instead: an exported OBJECT LITERAL whose properties are references to
// bindings the module does not otherwise export. That is what a handle bolted onto a monolith looks
// like, whatever it is called.
export function testBackdoors(index) {
  const out = new Set();
  for (const [file, info] of index.byFile) {
    if (info.test) continue;
    for (const agg of info.aggregates || []) {
      const priv = agg.props.filter((p) => !info.exported.includes(p) && info.declared.includes(p));
      if (agg.props.length && priv.length >= Math.ceil(agg.props.length / 2)) {
        out.add(file + '::' + agg.name);
      }
    }
  }
  return out;
}

// Reported SEPARATELY, and never used to decide reachability.
export function noProductionConsumer(index) {
  const out = new Set();
  for (const [file, info] of index.byFile) {
    if (info.test) continue;
    for (const name of info.exported) {
      const where = [...(index.refs.get(name) || [])].filter((f) => f !== file);
      if (where.length && where.every((f) => index.byFile.get(f) && index.byFile.get(f).test)) {
        out.add(file + '::' + name);
      }
    }
  }
  return out;
}

// EVERY function containing the line, not just the innermost. A nested arrow inside an exported
// function is not itself exported, and asking only the innermost would call the whole path private.
const enclosingAll = (info, line) => (info
  ? info.funcs.filter((f) => f.from <= line && line <= f.to)
    .sort((a, b) => (a.to - a.from) - (b.to - b.from))
  : []);

// Classify one witnessed effect: where it came from, and whether production can get there.
export function classifyEvent(event, index, backdoors) {
  const path = [];
  for (const f of event.stack) {
    const key = relative(index.root, f.file.split('/').join(sep)).split(sep).join('/');
    const info = index.byFile.get(key);
    if (!info) { path.push({ file: f.file, line: f.line, fn: f.fn, known: false }); continue; }
    const encs = enclosingAll(info, f.line);
    const enc = encs[0];
    path.push({ file: key, line: f.line, fn: (enc && enc.name) || f.fn, known: true,
      test: info.test, exported: encs.some((e) => e.exported),
      backdoor: encs.some((e) => backdoors.has(key + '::' + e.name)) });
  }
  // THE INSTRUMENT IS NOT THE SUBJECT. Its own frames are on every stack by construction, and
  // counting them would let the screen grow its own coverage by growing itself.
  const production = path.filter((p) => p.known && !p.test && !p.file.startsWith('legascreen/'));
  let reachability = REACHABILITY.PRODUCTION_REACHED;
  // POISONED BY A HOLE. An unparsed frame might have been the crossing point, so no reachability
  // claim survives one. The frames that DID parse remain valid as participation.
  if (event.ancestryComplete === false) reachability = REACHABILITY.ANCESTRY_INCOMPLETE;
  else
  if (!production.length) reachability = REACHABILITY.TEST_ONLY;
  else {
    // The frame where control CROSSED from test code into production code - the deepest production
    // frame in the stack, i.e. the last one before the test frames.
    // THE CROSSING FRAME decides. Production code cannot call a module-private binding from
    // outside that module, so if control entered production at a PRIVATE function, the path
    // required test-only accessibility - a backdoor, whatever shape it took.
    const entry = production[production.length - 1];
    if (entry.backdoor || !entry.exported) reachability = REACHABILITY.TEST_ONLY;
  }
  return { ...event, path, reachability,
    privateOnPath: production.filter((p) => !p.exported && p.fn !== '<anonymous>'),
    exportedOnPath: production.filter((p) => p.exported) };
}

// The denominator must state what the instrument cannot see.
export function observability(index) {
  const t = { OBSERVABLE: 0, UNOBSERVABLE_BY_THIS_INSTRUMENT: 0, NO_MODULE_SYNTAX: 0 };
  for (const [, info] of index.byFile) if (info.observability) t[info.observability]++;
  return t;
}
