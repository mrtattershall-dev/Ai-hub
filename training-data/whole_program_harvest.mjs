/**
 * whole_program_harvest.mjs — turn complete single-file games into verified,
 * self-contained training examples (one per game, deduped, size-capped, gated).
 *
 * Whole programs are the right unit for teaching WORKING code: every reference
 * resolves because nothing is ripped out of context. But the corpus is dozens of
 * versioned builds of a few games, and many are far too large to fit a training
 * example, so we:
 *   1. group files by game family (dust-harvest-v38-… → "dust-harvest")
 *   2. keep only versions whose inline JS is self-contained (passes the gate)
 *   3. within a family pick the LARGEST gate-passing file UNDER --cap bytes
 *   4. emit one example per family
 *
 *   node whole_program_harvest.mjs <srcDir> [--cap=32768]
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as acorn from 'acorn';

const SRC = process.argv[2];
const cap = +(process.argv.find(a => a.startsWith('--cap='))?.split('=')[1] || 32768);
if (!SRC || !existsSync(SRC)) { console.error('usage: node whole_program_harvest.mjs <srcDir> [--cap=BYTES]'); process.exit(1); }
const OUT = join(process.cwd(), 'correctness', 'games');
mkdirSync(OUT, { recursive: true });

const G = new Set(['globalThis','undefined','NaN','Infinity','arguments','this','eval','Object','Array','String','Number','Boolean','Math','JSON','Date','RegExp','Error','TypeError','RangeError','Map','Set','WeakMap','WeakSet','Promise','Symbol','Proxy','Reflect','BigInt','Function','parseInt','parseFloat','isNaN','isFinite','encodeURIComponent','decodeURIComponent','encodeURI','decodeURI','queueMicrotask','structuredClone',
  'Int8Array','Uint8Array','Uint8ClampedArray','Int16Array','Uint16Array','Int32Array','Uint32Array','Float32Array','Float64Array','BigInt64Array','BigUint64Array','ArrayBuffer','SharedArrayBuffer','DataView','Atomics',
  'window','document','console','navigator','location','history','screen','devicePixelRatio','innerWidth','innerHeight','setTimeout','setInterval','clearTimeout','clearInterval','requestAnimationFrame','cancelAnimationFrame','requestIdleCallback','cancelIdleCallback',
  'localStorage','sessionStorage','indexedDB','fetch','XMLHttpRequest','WebSocket','EventSource','Worker','SharedWorker','MessageChannel','BroadcastChannel',
  'Image','Audio','AudioContext','webkitAudioContext','OfflineAudioContext','OffscreenCanvas','Path2D','ImageData','createImageBitmap','FontFace','VideoFrame',
  'performance','alert','confirm','prompt','crypto','URL','URLSearchParams','Blob','File','FileReader','FormData','Headers','Request','Response','ReadableStream','TextEncoder','TextDecoder',
  'CustomEvent','Event','EventTarget','MouseEvent','KeyboardEvent','TouchEvent','PointerEvent','WheelEvent','DragEvent','DOMParser','XMLSerializer','MutationObserver','ResizeObserver','IntersectionObserver','getComputedStyle','matchMedia','DOMRect','DOMMatrix',
  'Gamepad','GamepadButton','AbortController','AbortSignal','IdleDeadline',
  'module','exports','require','process','Buffer','__dirname','__filename','global','setImmediate']);
const kids = (n, fn) => { for (const k in n) { if (['type','start','end','loc','range'].includes(k)) continue; const v = n[k]; if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && fn(c)); else if (v && typeof v.type === 'string') fn(v); } };
const extractJS = (txt) => [...txt.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].filter(m => !/\bsrc=/i.test(m[0])).map(m => m[1]).join('\n;\n');
function freeVarCount(code) {
  let ast; for (const sourceType of ['script','module']) { try { ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType, allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true, allowImportExportEverywhere: true }); break; } catch { ast = null; } }
  if (!ast) return Infinity;                       // unparseable = unusable
  const decl = new Set(), ref = new Set(), skip = new WeakSet();
  const bind = (n) => { if (!n) return; if (n.type === 'Identifier') { decl.add(n.name); skip.add(n); } else if (n.type === 'ObjectPattern') n.properties.forEach(p => bind(p.type === 'RestElement' ? p.argument : p.value)); else if (n.type === 'ArrayPattern') n.elements.forEach(e => e && bind(e)); else if (n.type === 'AssignmentPattern') bind(n.left); else if (n.type === 'RestElement') bind(n.argument); };
  const dp = (n) => { switch (n.type) { case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': if (n.id) { decl.add(n.id.name); skip.add(n.id); } n.params.forEach(bind); break; case 'ClassDeclaration': case 'ClassExpression': if (n.id) { decl.add(n.id.name); skip.add(n.id); } break; case 'VariableDeclarator': bind(n.id); break; case 'ImportDefaultSpecifier': case 'ImportNamespaceSpecifier': case 'ImportSpecifier': decl.add(n.local.name); skip.add(n.local); break; case 'CatchClause': if (n.param) bind(n.param); break; case 'MemberExpression': if (!n.computed && n.property?.type === 'Identifier') skip.add(n.property); break; case 'Property': if (!n.computed && n.key?.type === 'Identifier') skip.add(n.key); break; case 'MethodDefinition': case 'PropertyDefinition': if (!n.computed && n.key?.type === 'Identifier') skip.add(n.key); break; } kids(n, dp); };
  const rp = (n) => { if (n.type === 'Identifier' && !skip.has(n)) ref.add(n.name); kids(n, rp); };
  dp(ast); rp(ast);
  return [...ref].filter(n => !decl.has(n) && !G.has(n)).length;
}
function family(name) {
  const s = name.toLowerCase().replace(/\.html$/, '').replace(/\(\d+\)/g, '');
  const out = [];
  for (const p of s.split(/[-_]+/).filter(Boolean)) {
    if (/^v?\d/.test(p) || /^s\d/.test(p) || ['fixed','final','stable','ready','test','patch','refactored','audited','backup','idk','vol2'].includes(p)) break;
    out.push(p); if (out.length >= 2) break;
  }
  return out.join('-') || s;
}

const fams = new Map();   // family -> { best:{file,size,free}, minPassing, overCap, failed }
for (const f of readdirSync(SRC).filter(x => x.endsWith('.html'))) {
  let txt; try { txt = readFileSync(join(SRC, f), 'utf8'); } catch { continue; }
  const js = extractJS(txt); if (!js.trim()) continue;
  const size = Buffer.byteLength(js);
  const free = freeVarCount(js);
  const k = family(f);
  if (!fams.has(k)) fams.set(k, { best: null, minPassing: Infinity, overCap: false, failed: 0 });
  const e = fams.get(k);
  if (free !== 0) { e.failed++; continue; }         // not self-contained → skip
  e.minPassing = Math.min(e.minPassing, size);
  if (size > cap) { e.overCap = true; continue; }
  if (!e.best || size > e.best.size) e.best = { file: f, size };
}

let id = 1, emitted = 0;
const emittedRows = [], tooBig = [];
for (const [k, e] of [...fams.entries()].sort()) {
  if (e.best) {
    const slug = `${String(id).padStart(4, '0')}-game-${k}`.replace(/[^\w-]/g, '');
    const od = join(OUT, slug); mkdirSync(od, { recursive: true });
    writeFileSync(join(od, 'output.html'), readFileSync(join(SRC, e.best.file)));
    writeFileSync(join(od, 'prompt.txt'), `[REVIEW - backtranslate] A complete, self-contained single-file HTML5 canvas game (family: ${k}). Source: ${e.best.file}`, 'utf8');
    emittedRows.push(`  ${String(Math.round(e.best.size / 1024)).padStart(4)}KB  ${k}  (${e.best.file})`);
    id++; emitted++;
  } else if (e.minPassing !== Infinity) {
    tooBig.push(`  ${String(Math.round(e.minPassing / 1024)).padStart(4)}KB  ${k}  (smallest clean version still over ${Math.round(cap/1024)}KB cap)`);
  }
}
console.log(`\n=== whole-program harvest (cap ${Math.round(cap/1024)}KB of JS) ===`);
console.log(`distinct game families: ${fams.size}\n`);
console.log(`EMITTED ${emitted} verified whole-game examples -> correctness/games/`);
emittedRows.forEach(r => console.log(r));
if (tooBig.length) { console.log(`\nTOO BIG for a training example (need module-split or a bigger maxlen):`); tooBig.forEach(r => console.log(r)); }
