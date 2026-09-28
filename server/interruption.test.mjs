/**
 * interruption.test.mjs — does an INJECTED CRASH actually fail the campaign?
 *
 *   node server/interruption.test.mjs
 *
 * The pilot's 1.5B arm was launched with a shell loop whose last command was `echo`. Page p4 died in
 * round 4, wrote no record, and the campaign reported exit 0. An echo decided whether an experiment
 * succeeded, and a missing file was the only trace.
 *
 * This kills a real run through the real launcher and requires all three of:
 *   a NON-ZERO campaign exit
 *   an explicit INTERRUPTED record, not an absence
 *   reconciliation of what the record claims against what the corpus holds
 *
 * The positive control matters as much: an uninterrupted campaign must still exit 0 and be marked
 * COMPLETE, or the gate is just a way of failing everything.
 */
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
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

const GOOD = `
const clearBtn = document.createElement('button');
clearBtn.id = 'clear-filter';
clearBtn.textContent = 'Clear';
document.body.appendChild(clearBtn);
clearBtn.addEventListener('click', () => { input.value = ''; applyFilter(); });`;

/**
 * A scripted backend that can be told to DIE. `killAfter` closes the connection and destroys every
 * socket on the Nth request, which kills the runner mid-flight exactly as an interrupted run does -
 * rather than simulating the failure by writing a file that says "interrupted".
 */
function backend(completion, killAfter) {
  const seen = [];
  const sockets = new Set();
  return new Promise((done) => {
    const srv = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        seen.push(1);
        if (killAfter && seen.length >= killAfter) {
          for (const s of sockets) { try { s.destroy(); } catch { /* going away */ } }
          try { srv.close(); } catch { /* going away */ }
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ response: completion, done: true, done_reason: 'stop', eval_count: 40, prompt_eval_count: 300 }));
      });
    });
    srv.on('connection', (s) => sockets.add(s));
    srv.listen(0, '127.0.0.1', () => done({ srv, port: srv.address().port, seen }));
  });
}

async function campaign({ killAfter, pages }) {
  const root = mkdtempSync(join(tmpdir(), 'camp-'));
  const pagesDir = join(root, 'pages');
  const outDir = join(root, 'out');
  const { srv, port } = await backend(GOOD, killAfter);
  try {
    for (const p of pages) {
      mkdirSync(join(pagesDir, p), { recursive: true });
      writeFileSync(join(pagesDir, p, 'baseline-as-delivered.html'), BASE, 'utf8');
      await exec(process.execPath, ['server/emitTaskAuto.mjs', '--dir', join(pagesDir, p)],
        { cwd: process.cwd(), windowsHide: true, maxBuffer: 20e6 });
    }
    let code = 0; let stdout = '';
    try {
      const r = await exec(process.execPath, ['server/campaign.mjs', '--pages', pagesDir, '--out', outDir,
        '--model-url', `http://127.0.0.1:${port}`], { cwd: process.cwd(), windowsHide: true, maxBuffer: 50e6 });
      stdout = String(r.stdout || '');
    } catch (e) { code = e.code ?? 1; stdout = String(e.stdout || ''); }
    const sum = existsSync(join(outDir, '_campaign.json'))
      ? JSON.parse(readFileSync(join(outDir, '_campaign.json'), 'utf8')) : null;
    return { code, stdout, sum };
  } finally {
    try { srv.close(); } catch { /* best effort */ }
    try { rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

// ══ 1. positive control: an uninterrupted campaign succeeds ═════════════════════════════════════
console.log('\n1. positive control - nothing is injected, and the campaign must pass');
const ok = await campaign({ killAfter: 0, pages: ['a1', 'a2'] });
say(ok.code === 0, `the campaign exits 0 (${ok.code})`);
say(!!ok.sum, 'a campaign summary was written');
say(ok.sum.completed === 2 && ok.sum.interrupted === 0, `both pages COMPLETED (${ok.sum.completed} completed, ${ok.sum.interrupted} interrupted)`);
say(ok.sum.results.every((r) => r.status === 'COMPLETE'), 'each run record says COMPLETE');
say(ok.sum.results.every((r) => r.attemptsInCorpus >= r.attemptsRecorded),
  'the corpus holds at least as many attempts as each record claims');
say(ok.sum.accepted === 2, `and the work actually happened - ${ok.sum.accepted} accepted`);

// ══ 2. an injected crash must fail the campaign ═════════════════════════════════════════════════
console.log('\n2. the backend dies mid-campaign - a real kill, not a simulated flag');
const bad = await campaign({ killAfter: 2, pages: ['b1', 'b2'] });
say(bad.code !== 0, `the campaign exits NON-ZERO (${bad.code}) - an echo cannot decide this`);
say(!!bad.sum, 'a campaign summary was still written - "no file" never means "nothing to see"');
say(bad.sum.interrupted > 0, `${bad.sum.interrupted} page(s) are named as interrupted`);
const hurt = bad.sum.results.find((r) => !r.ok);
say(!!hurt && /INTERRUPTED|NO_RECORD/.test(hurt.status), `the failing page carries an explicit status (${hurt && hurt.status})`);
say(!!hurt && hurt.problems.length > 0, `and states its problem: ${hurt && hurt.problems[0]}`);
say(/CAMPAIGN FAILED/.test(bad.stdout), 'the campaign says so in plain words, not only in an exit code');
say(bad.sum.results.some((r) => r.attemptsInCorpus > 0),
  'attempts made before the interruption survive in the corpus and are counted');

console.log(`\n  interruption gate: ${passed} passed, ${failed} failed -> ${failed ? 'AN INTERRUPTED RUN CAN STILL LOOK LIKE A COMPLETED ONE' : 'an interrupted run fails the campaign, names itself, and keeps what it had'}`);
process.exit(failed ? 1 : 0);
