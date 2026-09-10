/**
 * build_correctness.mjs — assemble the correctness-first dataset.
 * Copies every gate-passing (self-contained) example into correctness/clean/,
 * then reports the combined set (clean + repairs). Only verified-runnable code
 * is admitted, so the model trains exclusively on code that resolves all its refs.
 *
 *   node build_correctness.mjs [srcDir ...]   (default: examples patch-memory-card/examples)
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as acorn from 'acorn';

const SRC = process.argv.slice(2);
if (!SRC.length) SRC.push('examples', 'patch-memory-card/examples');
const CLEAN = join(process.cwd(), 'correctness', 'clean');
mkdirSync(CLEAN, { recursive: true });

const G = new Set(['globalThis','undefined','NaN','Infinity','arguments','this','Object','Array','String','Number','Boolean','Math','JSON','Date','RegExp','Error','Map','Set','WeakMap','WeakSet','Promise','Symbol','parseInt','parseFloat','isNaN','isFinite','window','document','console','navigator','location','setTimeout','setInterval','clearTimeout','clearInterval','requestAnimationFrame','cancelAnimationFrame','localStorage','sessionStorage','fetch','Image','Audio','AudioContext','performance','alert','requestIdleCallback','structuredClone','module','exports','require','process','Path2D','OffscreenCanvas','TextEncoder','TextDecoder','URL','Blob','crypto']);
const kids = (n, fn) => { for (const k in n) { if (['type','start','end','loc','range'].includes(k)) continue; const v = n[k]; if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && fn(c)); else if (v && typeof v.type === 'string') fn(v); } };
function extractJS(name, txt) { return name.endsWith('.html') ? [...txt.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].filter(m => !/\bsrc=/i.test(m[0])).map(m => m[1]).join('\n;\n') : txt; }
function selfContained(code) {
  let ast; for (const sourceType of ['module','script']) { try { ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType, allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true, allowImportExportEverywhere: true }); break; } catch { ast = null; } }
  if (!ast) return false;
  const decl = new Set(), ref = new Set(), skip = new WeakSet();
  const bind = (n) => { if (!n) return; if (n.type === 'Identifier') { decl.add(n.name); skip.add(n); } else if (n.type === 'ObjectPattern') n.properties.forEach(p => bind(p.type === 'RestElement' ? p.argument : p.value)); else if (n.type === 'ArrayPattern') n.elements.forEach(e => e && bind(e)); else if (n.type === 'AssignmentPattern') bind(n.left); else if (n.type === 'RestElement') bind(n.argument); };
  const dp = (n) => { switch (n.type) { case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': if (n.id) { decl.add(n.id.name); skip.add(n.id); } n.params.forEach(bind); break; case 'ClassDeclaration': case 'ClassExpression': if (n.id) { decl.add(n.id.name); skip.add(n.id); } break; case 'VariableDeclarator': bind(n.id); break; case 'ImportDefaultSpecifier': case 'ImportNamespaceSpecifier': case 'ImportSpecifier': decl.add(n.local.name); skip.add(n.local); break; case 'CatchClause': if (n.param) bind(n.param); break; case 'MemberExpression': if (!n.computed && n.property?.type === 'Identifier') skip.add(n.property); break; case 'Property': if (!n.computed && n.key?.type === 'Identifier') skip.add(n.key); break; case 'MethodDefinition': case 'PropertyDefinition': if (!n.computed && n.key?.type === 'Identifier') skip.add(n.key); break; } kids(n, dp); };
  const rp = (n) => { if (n.type === 'Identifier' && !skip.has(n)) ref.add(n.name); kids(n, rp); };
  dp(ast); rp(ast);
  return [...ref].every(n => decl.has(n) || G.has(n));
}

let copied = 0;
for (const dir of SRC) {
  const root = join(process.cwd(), dir); if (!existsSync(root)) continue;
  for (const d of readdirSync(root)) {
    let files; try { files = readdirSync(join(root, d)); } catch { continue; }
    const f = files.find(x => x.startsWith('output') && (x.endsWith('.js') || x.endsWith('.html')));
    if (!f) continue;
    if (!selfContained(extractJS(f, readFileSync(join(root, d, f), 'utf8')))) continue;
    const od = join(CLEAN, d.replace(/[^\w-]/g, '')); mkdirSync(od, { recursive: true });
    for (const x of files) writeFileSync(join(od, x), readFileSync(join(root, d, x)));
    copied++;
  }
}
const repairs = existsSync(join(process.cwd(), 'correctness', 'repairs')) ? readdirSync(join(process.cwd(), 'correctness', 'repairs')).length : 0;
console.log(`clean (verified self-contained): ${copied}`);
console.log(`repairs (bug->fix pairs):        ${repairs}`);
console.log(`correctness dataset total:       ${copied + repairs}`);
