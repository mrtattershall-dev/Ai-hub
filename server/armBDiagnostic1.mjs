/**
 * DIAGNOSTIC (not a gate change; the official arm B verdicts stand).
 *
 * Every code-bearing arm B candidate scored play [] - all six steps failing, including "loads and
 * exposes state". The script PARSES, so the cause is a runtime throw, and the candidates all call
 * `document.getElementById('plant')` etc. on buttons that do not exist in the page. A top-level
 * throw aborts the rest of the script, and `window.game = ...` sits AFTER the edit region in the
 * suffix - so the seam never gets defined and the play can observe nothing at all.
 *
 * This neutralises exactly one thing: it makes getElementById return a detached element instead of
 * null, so the hallucinated listeners register harmlessly and nothing throws. Nothing else is
 * touched. Then the play runs again and says what the candidate's behaviour actually was.
 *
 * Two questions it answers:
 *   1. was movement ever broken, or merely unobservable?
 *   2. does the planting logic work once it is reachable?
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const W = process.argv[2];   // directory holding MODEL-CMP-1_MODEL-CMP-1_armB_seed*.json
const { playCheck } = await import('file:///C:/Users/tatte/Projects/ai-coding-hub-phase1/server/playCheck.js');
const { farmTasks } = await import('file:///C:/Users/tatte/Projects/ai-coding-hub-phase1/server/benchTasks.js');
const spec = farmTasks().find((t) => t.id === 'farm-plant').diagnostic.spec;

const SHIM = [
  '        // DIAGNOSTIC SHIM (added by the analysis, not by the model): a missing element returns a',
  '        // detached one instead of null, so a listener bound to a button that does not exist',
  '        // cannot throw and abort the script.',
  '        (function () {',
  '            const orig = document.getElementById.bind(document);',
  '            document.getElementById = function (id) {',
  '                const el = orig(id);',
  '                if (el) return el;',
  "                const stub = document.createElement('button');",
  '                stub.id = id;',
  '                return stub;',
  '            };',
  '        })();',
].join('\n');

console.log('seed  official play      with the DOM shim   reading');
for (const s of [2, 3, 4, 5]) {
  const r = JSON.parse(readFileSync(`${W}/MODEL-CMP-1_armB_seed${s}.json`, 'utf8'));
  const html = r.candidate.text.replace('<script>', '<script>\n' + SHIM);
  const ws = mkdtempSync(join(tmpdir(), 'diagB-'));
  try {
    writeFileSync(join(ws, 'index.html'), html, 'utf8');
    const p = await playCheck(ws, spec, { timeoutMs: 90_000 });
    const pass = [...p.passing];
    const move = pass.includes(2) && pass.includes(3);
    const plant = pass.includes(4);
    console.log(`  ${s}   [${r.play.passing.join(',') || ''}]${' '.repeat(16 - (r.play.passing.join(',').length + 2))}[${pass.join(',')}]${' '.repeat(Math.max(1, 18 - (pass.join(',').length + 2)))}movement ${move ? 'WORKS' : 'broken'}, planting ${plant ? 'WORKS' : 'never fires'}`);
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
}
