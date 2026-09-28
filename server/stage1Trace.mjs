#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// stage1Trace.mjs — AUDIT-2 stage 1. WHAT DOES THE LIVE RUNNER ACTUALLY INVOKE?
//
//   node server/stage1Trace.mjs
//
// Traced transitively by import from the runner's own entry point, with a content hash per module, so
// the audit's claims are pinned to code that is actually reached rather than to intentions.
//
// THREE IMPORT FORMS, and the middle one is why this file exists as more than a formality:
//
//   import { x } from './a.mjs'     named        - found by the obvious regex
//   import './b.mjs'                SIDE EFFECT  - no `from` clause at all
//   await import('./c.mjs')         dynamic      - resolvable only when the specifier is a literal
//
// The first version of this tracer looked for `from` and `import(` and therefore missed
// `import './adapters/browser.mjs';` - the line that REGISTERS EVERY BROWSER ADAPTER. It would have
// reported the adapters as outside the system while the observer was demonstrably using them.
//
// WHAT THIS CANNOT SEE, stated rather than left implied: a specifier built at run time, a module loaded
// by a package rather than by this tree, and anything reached through a child process. `puppeteer-core`
// and `git` are both real dependencies of the deciding path and neither is an import in this tree.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';

const SEP = String.fromCharCode(92);
const ENTRY = join(process.cwd(), 'server', 'managerRun.mjs');
const sha = (t) => createHash('sha256').update(t).digest('hex').slice(0, 12);
const NL = String.fromCharCode(10);

// Both static forms, plus dynamic imports with a literal specifier.
const NAMED = /from\s*['"](\.[^'"]+)['"]/g;
const BARE = /(?:^|;)\s*import\s*['"](\.[^'"]+)['"]/gm;
const DYNAMIC = /import\(\s*['"](\.[^'"]+)['"]\s*\)/g;

const seen = new Map();
function walk(file, depth, via) {
  const key = file.split(SEP).join('/');
  if (seen.has(key)) return;
  if (!existsSync(file)) { seen.set(key, { missing: true, depth, via }); return; }
  const src = readFileSync(file, 'utf8');
  seen.set(key, { sha: sha(src), lines: src.split(NL).length, depth, via });
  for (const [re, how] of [[NAMED, 'named'], [BARE, 'side effect'], [DYNAMIC, 'dynamic']]) {
    re.lastIndex = 0;
    for (const m of src.matchAll(re)) walk(join(dirname(file), m[1]), depth + 1, how);
  }
}
walk(ENTRY, 0, 'entry point');

const rows = [...seen].map(([f, v]) => ({ name: f.split('/server/')[1] || f, ...v })).sort((a, b) => a.name.localeCompare(b.name));
console.log('COMPONENTS THE LIVE RUNNER REACHES, transitively from managerRun.mjs:');
console.log('  sha           lines  reached by    module');
for (const r of rows) {
  console.log(`  ${r.missing ? 'MISSING     ' : r.sha}  ${String(r.lines || '').padStart(5)}  ${String(r.via).padEnd(12)}  ${r.name}`);
}
console.log(`${NL}${rows.length} modules reached; ${rows.filter((r) => r.via === 'side effect').length} of them by SIDE-EFFECT import alone.`);
console.log(`${NL}NOT VISIBLE TO THIS TRACE, and therefore not pinned by it:`);
console.log('  puppeteer-core   a package, launched by observationSelect and playCheck');
console.log('  git              a child process, used by the acceptance/restore path');
console.log('  the model server a network dependency, pinned separately by model name and digest');
console.log(`${NL}OUTSIDE EVERY CLAIM in AUDIT-2: the permission-boundary machinery is a design, not code.`);
console.log('  It appears in no module above because it does not exist.');
