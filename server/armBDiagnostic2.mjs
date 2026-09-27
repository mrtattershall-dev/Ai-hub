/**
 * DIAGNOSTIC 2 (not a gate change; the official arm B verdicts stand).
 *
 * Diagnostic 1 showed the 7B's candidates bound the feature to `document.getElementById('plant')`
 * and friends - buttons this page does not have - so the listener threw, the seam downstream never
 * ran, and nothing was observable. With that throw neutralised, movement worked and planting never
 * fired, because a click on a button nobody can click is not a key press.
 *
 * This asks the next question: IF its wiring had been right, would its LOGIC have passed? The shim
 * now routes a click listener on a stub button to the key that button obviously meant - plant to p,
 * harvest to h, advance to t, save to s, load to l - and changes nothing else. The model's own
 * handler bodies run, on the key the task specified.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const W = process.argv[2];   // directory holding MODEL-CMP-1_MODEL-CMP-1_armB_seed*.json
const { playCheck } = await import('file:///C:/Users/tatte/Projects/ai-coding-hub-phase1/server/playCheck.js');
const { farmTasks } = await import('file:///C:/Users/tatte/Projects/ai-coding-hub-phase1/server/benchTasks.js');
const spec = farmTasks().find((t) => t.id === 'farm-plant').diagnostic.spec;

const SHIM = `        // DIAGNOSTIC SHIM (added by the analysis, not by the model): a missing element returns a
        // detached stub, and a click listener on that stub is routed to the key the button's id
        // obviously meant. This tests the model's handler LOGIC independently of its wiring.
        (function () {
            const KEY = { plant: 'p', harvest: 'h', advance: 't', time: 't', save: 's', load: 'l', gather: 'g', day: 'd' };
            const orig = document.getElementById.bind(document);
            document.getElementById = function (id) {
                const el = orig(id);
                if (el) return el;
                const stub = document.createElement('button');
                stub.id = id;
                stub.addEventListener = function (type, handler) {
                    if (type !== 'click') return;
                    const key = KEY[String(id).toLowerCase()];
                    if (!key) return;
                    document.addEventListener('keydown', function (e) { if (e.key === key) handler(e); });
                };
                return stub;
            };
        })();`;

console.log('seed  official   wiring fixed only   + logic on the right key   reading');
for (const s of [2, 3, 4, 5]) {
  const r = JSON.parse(readFileSync(`${W}/MODEL-CMP-1_armB_seed${s}.json`, 'utf8'));
  const html = r.candidate.text.replace('<script>', '<script>\n' + SHIM);
  const ws = mkdtempSync(join(tmpdir(), 'diagB2-'));
  try {
    writeFileSync(join(ws, 'index.html'), html, 'utf8');
    const p = await playCheck(ws, spec, { timeoutMs: 90_000 });
    const pass = [...p.passing];
    const plant = pass.includes(4), neg = pass.includes(5), exhaust = pass.includes(6);
    const reading = !plant ? 'planting STILL does not fire'
      : (neg && exhaust ? 'ALL CLAUSES PASS - only the wiring was wrong'
        : `plants (4 OK) but breaks the negative clause: 5 ${neg ? 'ok' : 'FAIL'}, 6 ${exhaust ? 'ok' : 'FAIL'}`);
    console.log(`  ${s}      []         [1,2,3,5]           [${pass.join(',')}]${' '.repeat(Math.max(1, 20 - pass.join(',').length))}${reading}`);
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
}
