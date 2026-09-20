// LEGASCREEN — SURFACE-1. Discovering the authority surface instead of assuming a denominator.
//
// "1 of 251 exported functions" was a fraction over a surface nobody established. Some exports never
// touch authority; some authority transformations are private and are not exports at all. The
// denominator has to be DISCOVERED.
//
// THE SEED PROBLEM IS THE WHOLE DIFFICULTY. Any discovery needs a root set, and a hand-authored list
// of authority functions would be the driver problem wearing a new hat - deciding the answer and
// then measuring it. So the root set is taken from the repository's own SHAPE:
//
//     const BRAND = new WeakSet();        <- an identity brand: unforgeable, module-private
//     BRAND.add(t)                        <- this function MINTS
//     BRAND.has(t)                        <- this function TESTS
//
// Nothing here names a module, a function, or an authority-sounding word. From those roots the
// surface grows through the import and call graph to a fixpoint: a function that calls an authority
// function is itself a candidate, whether or not it is exported.
//
// PARSED, NOT MATCHED. acorn gives real binding structure; a regex over source would answer a
// different question and this project's ledger is explicit that the instrument must measure the
// thing itself.
//
// AND THE SURFACE IS NOT COMPLETE. The seed is a brand shape, so an authority-bearing transformation
// that never touches a branded value is invisible to this mechanism. That is a bound on the
// instrument, not a statement about the repository, and `CAVEAT` is exported so a report cannot omit
// it by forgetting.
import { parse } from 'acorn';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';

export const CAVEAT = 'Authority-bearing transformations outside this discovery mechanism may exist.'
  + ' The root set is the identity-brand SHAPE, so a transformation that never touches a branded'
  + ' value is invisible here. This is a bound on the instrument, not a claim about the repository.';

export const REASON = {
  PRIVATE: 'PRIVATE - not an export, so a module shim cannot wrap it',
  NOT_OBSERVED: 'never executed during the runs performed',
  NO_AUTHORITY: 'executed, but never produced or consumed a branded value',
  NOT_REPLAYABLE: 'witnessed, but the recorded construction could not reproduce itself',
  NO_EXPERIMENT: 'witnessed and replayable, but no perturbation reached OBSERVED',
};

const files = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) files(p, out);
    else if (p.endsWith('.mjs') && !p.endsWith('.test.mjs') && !p.endsWith('.eval.mjs')) out.push(p);
  }
  return out;
};

const name = (n) => (n && n.type === 'Identifier' ? n.name : null);

// Walk every node, calling fn(node, ancestors).
function walk(node, fn, anc = []) {
  if (!node || typeof node.type !== 'string') return;
  fn(node, anc);
  const next = [...anc, node];
  for (const k of Object.keys(node)) {
    if (k === 'type' || k === 'start' || k === 'end') continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && walk(c, fn, next));
    else if (v && typeof v.type === 'string') walk(v, fn, next);
  }
}

const FN = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

// One module: its functions, what each calls, what it imports, and any identity brands it defines.
function analyze(file, root) {
  const src = readFileSync(file, 'utf8');
  const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  const rel = relative(root, file).split(sep).join('/');

  const imports = new Map();          // local name -> { from (resolved path), imported }
  const funcs = new Map();            // function name -> { name, exported, calls:Set, brandOps:Set }
  const brands = new Set();           // local names bound to `new WeakSet()`

  for (const n of ast.body) {
    if (n.type === 'ImportDeclaration') {
      const spec = n.source.value;
      const from = spec.startsWith('.') ? resolve(dirname(file), spec) : spec;
      for (const s of n.specifiers) {
        imports.set(s.local.name, { from,
          imported: s.type === 'ImportSpecifier' ? s.imported.name : '*' });
      }
    }
  }

  // Brands, by shape: a binding initialised to `new WeakSet()`.
  walk(ast, (n) => {
    if (n.type === 'VariableDeclarator' && n.init && n.init.type === 'NewExpression'
        && name(n.init.callee) === 'WeakSet' && name(n.id)) brands.add(n.id.name);
  });

  // Named functions, exported or not, including `const f = (...) => {}`.
  const declare = (fname, node, exported) => {
    if (!fname || funcs.has(fname)) return;
    const rec = { name: fname, exported, calls: new Set(), brandOps: new Set(), node };
    funcs.set(fname, rec);
  };
  for (const n of ast.body) {
    if (n.type === 'FunctionDeclaration') declare(name(n.id), n, false);
    if (n.type === 'VariableDeclaration') {
      for (const d of n.declarations) if (d.init && FN.has(d.init.type)) declare(name(d.id), d.init, false);
    }
    if (n.type === 'ExportNamedDeclaration' && n.declaration) {
      const d = n.declaration;
      if (d.type === 'FunctionDeclaration') declare(name(d.id), d, true);
      if (d.type === 'VariableDeclaration') {
        for (const v of d.declarations) if (v.init && FN.has(v.init.type)) declare(name(v.id), v.init, true);
      }
    }
    if (n.type === 'ExportNamedDeclaration' && !n.declaration) {
      for (const s of n.specifiers) {
        const f = funcs.get(s.local.name);
        if (f) f.exported = true;
      }
    }
  }

  // Attribute every call site to the innermost NAMED function containing it.
  const owner = (anc) => {
    for (let i = anc.length - 1; i >= 0; i--) {
      for (const f of funcs.values()) if (f.node === anc[i]) return f;
    }
    return null;
  };
  walk(ast, (n, anc) => {
    if (n.type !== 'CallExpression') return;
    const f = owner(anc);
    if (!f) return;
    if (n.callee.type === 'Identifier') f.calls.add(n.callee.name);
    else if (n.callee.type === 'MemberExpression' && name(n.callee.object)
        && brands.has(n.callee.object.name)) {
      const m = name(n.callee.property);
      if (m === 'add') f.brandOps.add('MINTS');
      if (m === 'has') f.brandOps.add('TESTS');
    }
  });

  return { file, rel, imports, funcs, brands };
}

// The surface: brand-touching functions, then everything that reaches them, to a fixpoint.
export function discover(root) {
  const mods = files(root).map((f) => analyze(f, root));
  const byFile = new Map(mods.map((m) => [m.file.replace(/\.mjs$/, ''), m]));
  const key = (m, f) => m.rel + '::' + f;
  const found = new Map();            // key -> { module, fn, exported, level, why }

  // LEVEL 0, discovered by shape alone.
  for (const m of mods) {
    for (const f of m.funcs.values()) {
      if (f.brandOps.size) {
        found.set(key(m, f.name), { module: m.rel, fn: f.name, exported: f.exported, level: 0,
          why: 'touches an identity brand (' + [...f.brandOps].join('+') + ')' });
      }
    }
  }
  // Within a brand module, a function that calls a brand-touching local is also authority.
  let grew = true;
  while (grew) {
    grew = false;
    for (const m of mods) {
      for (const f of m.funcs.values()) {
        if (found.has(key(m, f.name))) continue;
        for (const c of f.calls) {
          if (m.funcs.has(c) && found.has(key(m, c))) {
            found.set(key(m, f.name), { module: m.rel, fn: f.name, exported: f.exported, level: 0,
              why: 'calls ' + c + ', which touches the brand' });
            grew = true; break;
          }
        }
      }
    }
  }

  // LEVEL 1+, across modules, through the import graph.
  let level = 1;
  for (; level < 12; level++) {
    let added = false;
    for (const m of mods) {
      for (const f of m.funcs.values()) {
        if (found.has(key(m, f.name))) continue;
        for (const c of f.calls) {
          const imp = m.imports.get(c);
          if (!imp) continue;
          const target = byFile.get(String(imp.from).replace(/\.mjs$/, ''));
          if (!target) continue;
          const tk = target.rel + '::' + (imp.imported === '*' ? c : imp.imported);
          if (!found.has(tk)) continue;
          found.set(key(m, f.name), { module: m.rel, fn: f.name, exported: f.exported, level,
            why: 'calls ' + imp.imported + ' from ' + target.rel });
          added = true; break;
        }
      }
    }
    if (!added) break;
  }

  return { candidates: [...found.values()].sort((a, b) => a.level - b.level
    || a.module.localeCompare(b.module) || a.fn.localeCompare(b.fn)),
  modules: mods.length, brandSites: mods.filter((m) => m.brands.size).map((m) => m.rel), caveat: CAVEAT };
}

// The loader config that instruments exactly the EXPORTED candidates. Private ones cannot be wrapped
// by a module shim, and that gap is returned rather than quietly dropped.
export function instrumentationFor(surface) {
  const byModule = new Map();
  const unwrappable = [];
  for (const c of surface.candidates) {
    if (!c.exported) { unwrappable.push(c); continue; }
    if (!byModule.has(c.module)) byModule.set(c.module, new Set());
    byModule.get(c.module).add(c.fn);
  }
  const targets = [...byModule].map(([m, fns]) => ({ name: m.replace(/\.mjs$/, '').split('/').pop(),
    match: m, exports: [...fns],
    // THE BRAND PREDICATE IS DISCOVERED TOO. A level-0 export whose brand operation is TESTS is the
    // module's own `isAuthority`; handing the recorder anything else would be the screen deciding
    // what authority means in a module it is watching.
    brands: surface.candidates.filter((c) => c.module === m && c.exported
      && /TESTS/.test(c.why || '')).map((c) => c.fn) }));
  return { targets, unwrappable };
}

// The screen is not the subject. Counting LegaScreen's own modules inside the repository's authority
// surface would let the instrument inflate the number by growing itself.
export const isInstrument = (c) => c.module.startsWith('legascreen/');
