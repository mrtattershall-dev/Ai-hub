/**
 * verify_gate.mjs — runnability gate for training examples.
 *
 * "Working code" can't be taught from fragments that reference things they never
 * define. This gate parses each example's output with acorn and reports its FREE
 * VARIABLES — identifiers used but neither declared locally, imported, nor a
 * standard global. Zero free vars ≈ self-contained (trainable for correctness);
 * many free vars = a fragment ripped out of a bigger program (teaches the model
 * to reference things that don't exist — the exact bug class we're fixing).
 *
 *   node verify_gate.mjs [dir]        (default: examples)
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import * as acorn from 'acorn';

const DIR = process.argv[2] || 'examples';

const GLOBALS = new Set([
  // language
  'globalThis','undefined','NaN','Infinity','arguments','this','eval','Symbol',
  'Object','Array','String','Number','Boolean','Math','JSON','Date','RegExp','Error',
  'Map','Set','WeakMap','WeakSet','Promise','Proxy','Reflect','BigInt','Function',
  'parseInt','parseFloat','isNaN','isFinite','encodeURIComponent','decodeURIComponent',
  'encodeURI','decodeURI','structuredClone','queueMicrotask',
  'Int8Array','Uint8Array','Uint8ClampedArray','Int16Array','Uint16Array',
  'Int32Array','Uint32Array','Float32Array','Float64Array','ArrayBuffer','DataView',
  // browser / DOM / canvas / audio / timers — the legit game-dev surface
  'window','document','console','navigator','location','history','screen',
  'setTimeout','setInterval','clearTimeout','clearInterval',
  'requestAnimationFrame','cancelAnimationFrame','requestIdleCallback',
  'localStorage','sessionStorage','fetch','XMLHttpRequest','WebSocket',
  'Image','Audio','AudioContext','webkitAudioContext','OffscreenCanvas','Path2D',
  'alert','confirm','prompt','performance','crypto','URL','Blob','FileReader',
  'addEventListener','removeEventListener','getComputedStyle','matchMedia',
  'devicePixelRatio','innerWidth','innerHeight','CustomEvent','Event','DOMParser',
  'TextEncoder','TextDecoder','KeyboardEvent','MouseEvent','TouchEvent','Gamepad',
  'module','exports','require','process','Buffer','__dirname','__filename',
]);

function extractJS(name, txt) {
  if (name.endsWith('.html')) {
    return [...txt.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
      .filter(m => !/\bsrc=/i.test(m[0])).map(m => m[1]).join('\n;\n');
  }
  return txt;
}

function analyze(code) {
  let ast;
  for (const sourceType of ['module', 'script']) {
    try { ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType, allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true, allowImportExportEverywhere: true }); break; }
    catch (e) { ast = null; var lastErr = e; }
  }
  if (!ast) return { syntax: false, error: String(lastErr).split('\n')[0] };

  const declared = new Set(), referenced = new Set(), skip = new WeakSet();
  const bind = (n) => {
    if (!n) return;
    if (n.type === 'Identifier') { declared.add(n.name); skip.add(n); }
    else if (n.type === 'ObjectPattern') n.properties.forEach(p => bind(p.type === 'RestElement' ? p.argument : p.value));
    else if (n.type === 'ArrayPattern') n.elements.forEach(e => e && bind(e));
    else if (n.type === 'AssignmentPattern') bind(n.left);
    else if (n.type === 'RestElement') bind(n.argument);
  };
  const kids = (node, fn) => {
    for (const k in node) {
      if (k === 'type' || k === 'start' || k === 'end' || k === 'loc' || k === 'range') continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && fn(c));
      else if (v && typeof v.type === 'string') fn(v);
    }
  };
  const declPass = (node) => {
    switch (node.type) {
      case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression':
        if (node.id) { declared.add(node.id.name); skip.add(node.id); }
        node.params.forEach(bind); break;
      case 'ClassDeclaration': case 'ClassExpression':
        if (node.id) { declared.add(node.id.name); skip.add(node.id); } break;
      case 'VariableDeclarator': bind(node.id); break;
      case 'ImportDefaultSpecifier': case 'ImportNamespaceSpecifier': case 'ImportSpecifier':
        declared.add(node.local.name); skip.add(node.local); break;
      case 'CatchClause': if (node.param) bind(node.param); break;
      case 'MemberExpression': if (!node.computed && node.property?.type === 'Identifier') skip.add(node.property); break;
      case 'Property': if (!node.computed && node.key?.type === 'Identifier') skip.add(node.key); break;
      case 'MethodDefinition': case 'PropertyDefinition': if (!node.computed && node.key?.type === 'Identifier') skip.add(node.key); break;
      case 'LabeledStatement': skip.add(node.label); break;
      case 'BreakStatement': case 'ContinueStatement': if (node.label) skip.add(node.label); break;
    }
    kids(node, declPass);
  };
  const refPass = (node) => {
    if (node.type === 'Identifier' && !skip.has(node)) referenced.add(node.name);
    kids(node, refPass);
  };
  declPass(ast); refPass(ast);
  const free = [...referenced].filter(n => !declared.has(n) && !GLOBALS.has(n));
  return { syntax: true, free };
}

// ---- run over the dataset ----
const root = join(process.cwd(), DIR);
if (!existsSync(root)) { console.error('no dir:', root); process.exit(1); }
const folders = readdirSync(root).filter(d => existsSync(join(root, d)) && readdirSync(join(root, d)).some(f => f.startsWith('output')));

let pass = 0, syntaxFail = 0, fragment = 0, skipped = 0;
const freeTally = new Map();
for (const d of folders) {
  const files = readdirSync(join(root, d)).filter(f => f.startsWith('output'));
  const f = files.find(x => x.endsWith('.js')) || files.find(x => x.endsWith('.html')) || files[0];
  if (!f || !/\.(js|html)$/.test(f)) { skipped++; continue; }
  const code = extractJS(f, readFileSync(join(root, d, f), 'utf8'));
  const r = analyze(code);
  if (!r.syntax) { syntaxFail++; continue; }
  if (r.free.length === 0) { pass++; }
  else {
    fragment++;
    for (const n of r.free) freeTally.set(n, (freeTally.get(n) || 0) + 1);
  }
}

const total = folders.length;
const pct = (n) => `${n} (${(100 * n / total).toFixed(0)}%)`;
console.log(`\n=== runnability gate: ${DIR} (${total} examples) ===`);
console.log(`  self-contained (PASS): ${pct(pass)}`);
console.log(`  fragment (free vars):  ${pct(fragment)}`);
console.log(`  syntax error:          ${pct(syntaxFail)}`);
if (skipped) console.log(`  skipped (non-js):      ${skipped}`);
const top = [...freeTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
if (top.length) {
  console.log(`\n  top undefined references (the external coupling that breaks generation):`);
  for (const [name, n] of top) console.log(`    ${String(n).padStart(4)}  ${name}`);
}
