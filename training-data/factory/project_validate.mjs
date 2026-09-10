/**
 * project_validate.mjs — multi-file ES6 project validator (the project-level gate+exec).
 *
 *   node factory/project_validate.mjs <project-dir> [entry.js]
 *
 * The single-file gate can't see across files. This bundles the import graph with esbuild
 * (which RESOLVES every import — a missing/typo'd import is the multi-file version of the
 * free-var bug, and esbuild fails on it) then EXECUTES the bundle (timeout = infinite-loop
 * detector). Same two-stage idea (resolve+build, then run) lifted from single-file to a
 * whole ES6 project. Browser/canvas projects are flagged for the headless-DOM stage.
 *
 * Returns: { ok, stage, note|error }. Stage 'bundle' failure = unresolved import / syntax;
 * stage 'exec' failure = runtime throw/hang the bundle still has.
 */
import esbuild from 'esbuild';
import { execFileSync } from 'child_process';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const DIR = process.argv[2];
const ENTRY = process.argv[3] || 'main.js';
if (!DIR || !existsSync(DIR)) { console.error('usage: node project_validate.mjs <project-dir> [entry.js]'); process.exit(1); }

const DOM = /\bdocument\b|\bwindow\b|requestAnimationFrame|getContext|addEventListener/;
const TMP = join('factory', '_proj_tmp');

export function validateProject(dir, entry = 'main.js') {
  // 1) bundle — esbuild resolves the whole import graph; missing/typo imports fail here
  let bundle;
  try {
    const r = esbuild.buildSync({
      entryPoints: [join(dir, entry)], bundle: true, write: false,
      format: 'cjs', platform: 'node', logLevel: 'silent',
    });
    bundle = r.outputFiles[0].text;
  } catch (e) {
    const msg = (e.errors && e.errors[0] && e.errors[0].text) || String(e).split('\n')[0];
    return { ok: false, stage: 'bundle', error: msg };
  }
  // 2) execute the bundle (browser projects can't run under node — flag for DOM stage)
  if (DOM.test(bundle)) return { ok: true, stage: 'bundle', note: 'bundled clean; browser code → pending headless-DOM stage' };
  mkdirSync(TMP, { recursive: true });
  const f = join(TMP, 'bundle.cjs');
  writeFileSync(f, bundle, 'utf8');
  try { execFileSync('node', [f], { timeout: 5000, stdio: 'pipe' }); return { ok: true, stage: 'exec', note: 'bundled + ran clean' }; }
  catch (e) {
    if (e.signal === 'SIGTERM' || e.code === 'ETIMEDOUT') return { ok: false, stage: 'exec', error: 'hung / infinite loop' };
    const err = (e.stderr ? e.stderr.toString() : String(e)).split('\n').filter(Boolean).pop();
    return { ok: false, stage: 'exec', error: err };
  } finally { rmSync(TMP, { recursive: true, force: true }); }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('project_validate.mjs')) {
  const r = validateProject(DIR, ENTRY);
  const tag = r.ok ? 'PASS' : 'FAIL';
  console.log(`\n=== project validate: ${DIR} (entry ${ENTRY}) ===`);
  console.log(`  ${tag} @ ${r.stage}: ${r.note || r.error}`);
  process.exit(r.ok ? 0 : 1);
}
