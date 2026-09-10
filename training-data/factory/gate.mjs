/**
 * gate.mjs — shared runnability gate (importable).
 *
 * This MIRRORS the analyze()/GLOBALS/extractJS in ../verify_gate.mjs so the factory
 * and the repo-harvester apply a byte-identical standard. verify_gate.mjs stays the
 * canonical standalone CLI; if you change the gate there, re-sync this copy.
 *
 *   import { analyze, extractJS } from './gate.mjs'
 *   analyze(code) -> { syntax:true, free:[...] } | { syntax:false, error }
 *   free.length === 0 && syntax  ===  self-contained / runnable / trainable
 */
import * as acorn from 'acorn';

export const GLOBALS = new Set([
  'globalThis','undefined','NaN','Infinity','arguments','this','eval','Symbol',
  'Object','Array','String','Number','Boolean','Math','JSON','Date','RegExp','Error',
  'Map','Set','WeakMap','WeakSet','Promise','Proxy','Reflect','BigInt','Function',
  'parseInt','parseFloat','isNaN','isFinite','encodeURIComponent','decodeURIComponent',
  'encodeURI','decodeURI','structuredClone','queueMicrotask',
  'Int8Array','Uint8Array','Uint8ClampedArray','Int16Array','Uint16Array',
  'Int32Array','Uint32Array','Float32Array','Float64Array','ArrayBuffer','DataView',
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

export function extractJS(name, txt) {
  if (name.endsWith('.html')) {
    return [...txt.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
      .filter(m => !/\bsrc=/i.test(m[0])).map(m => m[1]).join('\n;\n');
  }
  return txt;
}

export function analyze(code) {
  let ast, lastErr;
  for (const sourceType of ['module', 'script']) {
    try { ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType, allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true, allowImportExportEverywhere: true }); break; }
    catch (e) { ast = null; lastErr = e; }
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

/**
 * dependsOnExternalResources — the gate criterion that was missing.
 *
 * Every prior check asked "is this code well-formed?" (parses, no free variables,
 * not minified). None asked "can it RUN somewhere other than where it came from?"
 *
 * That gap produced the worst defect measured in this project: harvest_phaser.mjs
 * deliberately skipped the free-var gate and trusted Phaser's official examples
 * "as-is". Those examples are correct — on a site that serves assets/sprites/*.png.
 * Lifted into any other context they boot, create a canvas, and render nothing.
 * 71% of the Phaser slice carried that dependency, and the fine-tuned model
 * reproduced it faithfully: 0/12 on a Chromium-verified Phaser eval, 11 failures
 * traceable to a missing asset.
 *
 * Portability was true by CONVENTION (the examples' home server satisfied it), never
 * by construction or enforcement. This is the enforcement.
 */
export function dependsOnExternalResources(code) {
  const reasons = [];
  const checks = [
    [/this\.load\.(image|spritesheet|atlas|multiatlas|audio|bitmapFont|video|tilemapTiledJSON|svg)\s*\(/i, 'loads an asset file at runtime'],
    [/setBaseURL\s*\(/i, 'sets an asset base URL'],
    [/phaserfiles\.com|labs\.phaser\.io/i, 'references the Phaser examples CDN'],
    [/['"]assets\//i, 'references an assets/ path'],
    // data: URIs are self-contained, so only flag a src pointing at a real URL
    [/\bnew\s+Image\s*\(\s*\)[\s\S]{0,80}\.src\s*=\s*['"](?!data:)/i, 'loads an image by URL'],
    [/\bfetch\s*\(\s*['"](?!data:)[^'"]*\.(png|jpg|jpeg|gif|mp3|ogg|wav|json)['"]/i, 'fetches an asset by URL'],
  ];
  for (const [rx, why] of checks) if (rx.test(code)) reasons.push(why);
  return { portable: reasons.length === 0, reasons };
}

/**
 * Every `assets/<name>` path the code references.
 *
 * Deliberately matches the string form rather than only `this.load.*` calls: paths get
 * built from variables, held in config objects and passed to atlas loaders, and a
 * detector that only knows the direct loaders under-reports. Measured 2026-09-09 on real
 * repos, a `this.load.(image|spritesheet|...)`-only regex called super-mario-land, tank
 * and space-invaders asset-free when each ships 19+ PNGs, because they load via
 * `this.load.pack()`.
 */
export function referencedAssets(code) {
  const out = new Set();
  const rx = /['"`]([^'"`\s]*assets\/[^'"`\s]+)['"`]/gi;
  let m;
  while ((m = rx.exec(String(code || ''))) !== null) {
    const p = m[1].split(/[?#]/)[0];
    const name = p.slice(p.toLowerCase().lastIndexOf('assets/') + 'assets/'.length);
    if (name) out.add(name);
  }
  return [...out];
}

/**
 * The training contract, now that the hub has an asset library.
 *
 * There are two DIFFERENT properties, and they were previously the same thing:
 *
 *   self-contained  needs nothing outside the file (data: URIs only)
 *   runnable        everything it references is either self-contained, or a file the
 *                   verifier will really serve
 *
 * `dependsOnExternalResources` above still means self-contained, and is left exactly as
 * it was so existing assemblers do not silently change meaning. This is the second
 * property, and it is the one a training row should have to satisfy from now on: the
 * verifier intercepts `assets/<name>` and answers it from the manifest, so a row that
 * loads a sprite IN THE LIBRARY is verifiable and legal, while a row that loads
 * `assets/hero.png` when no hero.png exists is a 404 and a blank canvas.
 *
 * Pass `manifest` as an array of names (or a Set). Omit it and this collapses back to
 * the strict self-contained rule, so callers that have no library are unaffected.
 */
export function runnableWithAssets(code, manifest) {
  const strict = dependsOnExternalResources(code);
  const names = manifest instanceof Set ? manifest : new Set(manifest || []);
  const wanted = referencedAssets(code);

  // Nothing to check against: fall back to the old, stricter contract.
  if (!names.size) {
    return { runnable: strict.portable, reasons: strict.reasons, assets: wanted, missing: wanted };
  }

  const missing = wanted.filter((n) => !names.has(n));

  // Re-run the strict reasons, dropping the two that only fired BECAUSE the code touched
  // assets/ - those are now legitimate when the file is in the library.
  const reasons = strict.reasons.filter((r) => r !== 'loads an asset file at runtime' && r !== 'references an assets/ path');
  for (const n of missing) reasons.push(`references assets/${n}, which is not in the library`);

  return { runnable: reasons.length === 0, reasons, assets: wanted, missing };
}
