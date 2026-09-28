/**
 * armB.test.mjs — can the CONTROL actually win?
 *
 *   node server/armB.test.mjs
 *
 * A comparison whose control cannot succeed measures nothing, and it fails in the flattering direction:
 * arm A wins, the write-up says the manager helped, and the truth is that arm B's harness was broken.
 * So before arm B is used for anything, it has to be shown capable of reaching RETAIN on a correct
 * answer, through the same acceptance path arm A uses.
 *
 * Three controls, against a scripted backend, $0:
 *   correct page   reaches RETAIN - the control CAN win
 *   echoed input   refused as ECHOED_THE_INPUT and named, because a returned-unchanged file is a
 *                  recorded failure mode of this interface, not a mysterious rejection
 *   regression     breaks carried-forward behaviour, is REJECTED and RESTORED on byte evidence
 */
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const NL = String.fromCharCode(10);
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const ITEMS = ['apple', 'apricot', 'banana', 'cherry', 'date'];
const BASE = `<!DOCTYPE html><html><body>
<h1>Fruit</h1>
<input type="text" id="filter" placeholder="filter">
<ul id="list">${ITEMS.map((x) => `<li class="item">${x}</li>`).join('')}</ul>
<script>
const input = document.getElementById('filter');
const items = Array.from(document.querySelectorAll('#list .item'));
function applyFilter() {
  const q = input.value.toLowerCase();
  items.forEach((li) => { li.style.display = li.textContent.toLowerCase().includes(q) ? '' : 'none'; });
}
input.addEventListener('input', applyFilter);
</script></body></html>`;

// A correct whole page: the control's natural output shape.
const CORRECT_PAGE = BASE.replace(
  "input.addEventListener('input', applyFilter);",
  `input.addEventListener('input', applyFilter);
const clearBtn = document.createElement('button');
clearBtn.id = 'clear-filter';
clearBtn.textContent = 'Clear';
document.body.appendChild(clearBtn);
clearBtn.addEventListener('click', () => { input.value = ''; applyFilter(); });`);

// Wrapped in a markdown fence and prose, which a direct loop legitimately strips.
const FENCED = 'Sure! Here is the updated page:' + NL + NL + '```html' + NL + CORRECT_PAGE + NL + '```' + NL + 'Let me know if you need anything else.';

const REGRESSION_PAGE = BASE.replace(
  "input.addEventListener('input', applyFilter);",
  `input.addEventListener('input', applyFilter);
const clearBtn = document.createElement('button');
clearBtn.id = 'clear-filter';
document.body.appendChild(clearBtn);
items.forEach((li) => li.remove());`);

function scriptedBackend(completion) {
  return new Promise((done) => {
    const srv = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ response: completion, done: true, done_reason: 'stop', eval_count: 900, prompt_eval_count: 700 }));
      });
    });
    srv.listen(0, '127.0.0.1', () => done({ srv, port: srv.address().port }));
  });
}

async function arm(completion) {
  const dir = mkdtempSync(join(tmpdir(), 'armb-t-'));
  const { srv, port } = await scriptedBackend(completion);
  try {
    writeFileSync(join(dir, 'baseline-as-delivered.html'), BASE, 'utf8');
    await exec(process.execPath, ['server/emitTaskAuto.mjs', '--dir', dir],
      { cwd: process.cwd(), windowsHide: true, maxBuffer: 20e6 });
    const outFile = join(dir, 'run.json');
    await exec(process.execPath, ['server/directRun.mjs', '--dir', dir, '--out', outFile,
      '--model-url', `http://127.0.0.1:${port}`, '--seeds', '1', '--max-rounds', '1'],
      { cwd: process.cwd(), windowsHide: true, maxBuffer: 20e6 }).catch(() => {});
    const run = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : null;
    const task = JSON.parse(readFileSync(join(dir, 'task.json'), 'utf8'));
    return { run, task, attempt: run && run.attempts[0] };
  } finally {
    try { srv.close(); } catch { /* best effort */ }
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

// ══ 1. the control can win ══════════════════════════════════════════════════════════════════════
console.log('\n1. a correct whole page - the control MUST be able to reach RETAIN');
const c = await arm(CORRECT_PAGE);
say(!!c.attempt, 'an attempt was recorded');
say(c.attempt && c.attempt.outcome === 'ACCEPTED', `outcome ACCEPTED (${c.attempt && c.attempt.outcome})`);
say(c.attempt && c.attempt.acceptance.disposition === 'RETAIN', `disposition RETAIN (${c.attempt && c.attempt.acceptance.disposition})`);
say(c.run && c.run.accepted === true, 'and the run reports the addition accepted');
say(c.attempt && (c.attempt.play.passing || []).length === c.task.diagnostic.spec.steps.length,
  `every check passed (${c.attempt && (c.attempt.play.passing || []).length} of ${c.task.diagnostic.spec.steps.length})`);
say(c.run && c.run.status === 'COMPLETE', 'and the run finalised its own record');

// ══ 2. prose and a fence are stripped, not refused ══════════════════════════════════════════════
console.log('\n2. the same page wrapped in prose and a markdown fence - a control is not refused for SHAPE');
const f = await arm(FENCED);
say(f.attempt && f.attempt.outcome === 'ACCEPTED', `still ACCEPTED (${f.attempt && f.attempt.outcome})`);
say(f.attempt && f.attempt.transformedCandidate.text.trim().startsWith('<!DOCTYPE html'),
  'the page was taken out of the reply cleanly');
say(f.attempt && !/Sure! Here is/.test(f.attempt.transformedCandidate.text), 'and the prose did not reach the page');

// ══ 3. the echo failure is named ════════════════════════════════════════════════════════════════
console.log('\n3. the model returns the page it was given, unchanged - a recorded failure of this interface');
const e = await arm(BASE);
say(e.attempt && e.attempt.outcome === 'REFUSED_ECHOED_THE_INPUT',
  `named as ${e.attempt && e.attempt.outcome}, not as a mysterious rejection`);
say(e.run && e.run.totals.echoed >= 1, `and counted separately in the totals (${e.run && e.run.totals.echoed})`);
say(e.run && e.run.accepted === false, 'the run reports no accepted addition');

// ══ 4. a regression is caught and restored, by the SAME path arm A uses ═════════════════════════
console.log('\n4. a whole page that breaks what worked - same acceptance path, same evidence');
const r = await arm(REGRESSION_PAGE);
say(r.attempt && r.attempt.outcome !== 'ACCEPTED', `not accepted (${r.attempt && r.attempt.outcome})`);
say(r.attempt && r.attempt.classification.mismatch === 'BROKE_WHAT_WORKED',
  `classified BROKE_WHAT_WORKED (${r.attempt && r.attempt.classification.mismatch})`);
say(r.attempt && r.attempt.acceptance.disposition === 'RESTORED', `disposition RESTORED (${r.attempt && r.attempt.acceptance.disposition})`);
say(r.attempt && r.attempt.acceptance.survivingBytes === 'IDENTICAL_TO_START',
  `with byte-identity evidence (${r.attempt && r.attempt.acceptance.survivingBytes})`);

console.log(`\n  arm B controls: ${passed} passed, ${failed} failed -> ${failed ? 'THE CONTROL ARM IS NOT FIT TO COMPARE AGAINST' : 'the control can win, is not refused for shape, and is judged by the same path as arm A'}`);
process.exit(failed ? 1 : 0);
