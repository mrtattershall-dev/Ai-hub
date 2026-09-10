/**
 * make_repair_pairs.mjs — "here's why this doesn't compile" training pairs.
 *
 * Manufactures the EXACT failure classes the fine-tune produces, from VERIFIED
 * self-contained code, pairing (broken + the real error) -> (working original):
 *
 *   1. self-ref-init   — reference a const inside its own object initializer
 *                        (the model's #1 bug: `maxTimer: G.TIMER_MAX` inside G)
 *   2. fake-api        — rename a real method to a plausible non-existent one
 *                        (its hallucinated-API bug: `.getClosest`, `.facing`)
 *   3. undefined-ref   — delete a declaration the rest of the file uses (`dt`)
 *
 * Outputs only pairs whose CORRECTED code passes the runnability gate, so the
 * model always learns toward code that actually executes.
 *
 *   node make_repair_pairs.mjs [srcDir ...]
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import * as acorn from 'acorn';

const SRC = process.argv.slice(2);
if (!SRC.length) SRC.push('examples', 'patch-memory-card/examples', 'correctness/clean');
const OUT = join(process.cwd(), 'correctness', 'repairs');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const G = new Set(['globalThis','undefined','NaN','Infinity','arguments','this','Object','Array','String','Number','Boolean','Math','JSON','Date','RegExp','Error','Map','Set','WeakMap','WeakSet','Promise','Symbol','parseInt','parseFloat','isNaN','isFinite','window','document','console','navigator','location','setTimeout','setInterval','clearTimeout','clearInterval','requestAnimationFrame','cancelAnimationFrame','localStorage','sessionStorage','fetch','Image','Audio','AudioContext','performance','alert','requestIdleCallback','structuredClone','Path2D','OffscreenCanvas','URL','Blob','crypto','Uint8Array','Uint8ClampedArray','Float32Array','Float64Array','Int32Array','Uint16Array','Int16Array','Uint32Array','Int8Array','ArrayBuffer','DataView','module','exports','require','process']);
const kids = (n, fn) => { for (const k in n) { if (['type','start','end','loc','range'].includes(k)) continue; const v = n[k]; if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && fn(c)); else if (v && typeof v.type === 'string') fn(v); } };
const parse = (code) => { for (const sourceType of ['module','script']) { try { return acorn.parse(code, { ecmaVersion: 'latest', sourceType, allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true, allowImportExportEverywhere: true }); } catch {} } return null; };
function selfContained(ast) {
  const decl = new Set(), ref = new Set(), skip = new WeakSet();
  const bind = (n) => { if (!n) return; if (n.type === 'Identifier') { decl.add(n.name); skip.add(n); } else if (n.type === 'ObjectPattern') n.properties.forEach(p => bind(p.type === 'RestElement' ? p.argument : p.value)); else if (n.type === 'ArrayPattern') n.elements.forEach(e => e && bind(e)); else if (n.type === 'AssignmentPattern') bind(n.left); else if (n.type === 'RestElement') bind(n.argument); };
  const dp = (n) => { switch (n.type) { case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': if (n.id) { decl.add(n.id.name); skip.add(n.id); } n.params.forEach(bind); break; case 'ClassDeclaration': case 'ClassExpression': if (n.id) { decl.add(n.id.name); skip.add(n.id); } break; case 'VariableDeclarator': bind(n.id); break; case 'ImportDefaultSpecifier': case 'ImportNamespaceSpecifier': case 'ImportSpecifier': decl.add(n.local.name); skip.add(n.local); break; case 'CatchClause': if (n.param) bind(n.param); break; case 'MemberExpression': if (!n.computed && n.property?.type === 'Identifier') skip.add(n.property); break; case 'Property': if (!n.computed && n.key?.type === 'Identifier') skip.add(n.key); break; case 'MethodDefinition': case 'PropertyDefinition': if (!n.computed && n.key?.type === 'Identifier') skip.add(n.key); break; } kids(n, dp); };
  const rp = (n) => { if (n.type === 'Identifier' && !skip.has(n)) ref.add(n.name); kids(n, rp); };
  dp(ast); rp(ast);
  return [...ref].every(n => decl.has(n) || G.has(n));
}

const FAKE = { push: 'append', pop: 'popLast', shift: 'dequeue', unshift: 'prepend', forEach: 'each', map: 'select', filter: 'where', slice: 'sub', splice: 'cut', indexOf: 'find', includes: 'has', join: 'concatAll', getContext: 'context', fillRect: 'drawRect', getElementById: 'getById', addEventListener: 'on' };

let id = 1, made = { 'self-ref-init': 0, 'fake-api': 0, 'undefined-ref': 0 };
const emit = (src, kls, name, errMsg, broken, fixed) => {
  if (!(brokenDiffers(broken, fixed))) return;
  const fa = parse(fixed); if (!fa || !selfContained(fa)) return;   // corrected code must run
  const slug = `${String(id).padStart(4, '0')}-repair-${kls}-${src.replace(/^\d+-/, '').slice(0, 22)}-${name}`.replace(/[^\w-]/g, '');
  const od = join(OUT, slug); mkdirSync(od, { recursive: true });
  writeFileSync(join(od, 'prompt.txt'), `The following JavaScript throws "${errMsg}" when run. Find the bug and return the complete corrected, runnable code.\n\n\`\`\`js\n${broken.trim()}\n\`\`\``, 'utf8');
  writeFileSync(join(od, 'output.js'), fixed, 'utf8');
  id++; made[kls]++;
};
const brokenDiffers = (a, b) => a.replace(/\s+/g, '') !== b.replace(/\s+/g, '');

for (const dir of SRC) {
  const root = join(process.cwd(), dir); if (!existsSync(root)) continue;
  for (const d of readdirSync(root)) {
    let files; try { files = readdirSync(join(root, d)); } catch { continue; }
    const f = files.find(x => x.startsWith('output') && x.endsWith('.js'));
    if (!f) continue;
    const code = readFileSync(join(root, d, f), 'utf8');
    const ast = parse(code); if (!ast || !selfContained(ast)) continue;

    // ---- class 1: self-referential object initializer ----
    let did1 = false;
    for (const node of ast.body) {
      if (did1) break;
      const dec = node.type === 'VariableDeclaration' && node.declarations[0];
      if (!dec || dec.id.type !== 'Identifier' || dec.init?.type !== 'ObjectExpression') continue;
      const obj = dec.init.name = dec.id.name, props = dec.init.properties.filter(p => p.type === 'Property' && !p.computed && p.value.type === 'Literal');
      if (props.length < 2) continue;
      const A = props[props.length - 1], B = props[0];
      const bKey = B.key.type === 'Identifier' ? B.key.name : String(B.key.value);
      const broken = code.slice(0, A.value.start) + `${dec.id.name}.${bKey}` + code.slice(A.value.end);
      emit(d, 'self-ref-init', dec.id.name, `ReferenceError: Cannot access '${dec.id.name}' before initialization`, broken, code);
      did1 = true;
    }
    // ---- class 2: hallucinated / fake method API ----
    let did2 = false;
    const findCall = (n) => {
      if (did2) return;
      if (n.type === 'CallExpression' && n.callee?.type === 'MemberExpression' && !n.callee.computed && n.callee.property?.type === 'Identifier' && FAKE[n.callee.property.name]) {
        const p = n.callee.property, fake = FAKE[p.name];
        const broken = code.slice(0, p.start) + fake + code.slice(p.end);
        emit(d, 'fake-api', p.name, `TypeError: ....${fake} is not a function`, broken, code);
        did2 = true; return;
      }
      kids(n, findCall);
    };
    findCall(ast);
    // ---- class 3: deleted declaration (undefined ref) ----
    const targets = [];
    for (const node of ast.body) {
      if (node.type === 'FunctionDeclaration' && node.id) targets.push({ name: node.id.name, start: node.start, end: node.end });
      else if (node.type === 'VariableDeclaration' && node.declarations.length === 1 && node.declarations[0].id.type === 'Identifier') targets.push({ name: node.declarations[0].id.name, start: node.start, end: node.end });
    }
    const countName = (nm) => { let c = 0; const w = (n) => { if (n.type === 'Identifier' && n.name === nm) c++; kids(n, w); }; w(ast); return c; };
    for (const t of targets) {
      if (countName(t.name) < 3) continue;
      const broken = (code.slice(0, t.start) + code.slice(t.end)).replace(/\n{3,}/g, '\n\n');
      emit(d, 'undefined-ref', t.name, `ReferenceError: ${t.name} is not defined`, broken, code);
      break; // one per file for this class
    }
  }
}
const total = Object.values(made).reduce((a, b) => a + b, 0);
console.log(`generated ${total} repair pairs -> correctness/repairs/`);
for (const [k, v] of Object.entries(made)) console.log(`  ${k.padEnd(14)} ${v}`);
