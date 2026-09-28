#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// freezeProtocols.mjs — capture what BOTH arms actually send, from the same page, verbatim.
//
//   node server/freezeProtocols.mjs > AUDIT-2_PROTOCOLS.md
//
// Stage 3 compares two methods. The comparison is only interpretable if the exact request each arm
// makes is on the record BEFORE any fresh page exists - otherwise "arm A got better guidance" is a
// claim about text nobody can inspect.
//
// This runs both runners against a scripted backend that records the request and answers with an empty
// completion, so nothing is generated, nothing is judged, and the only output is the two prompts as
// they actually cross the wire. $0.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const NL = String.fromCharCode(10);
const sha = (t) => createHash('sha256').update(t).digest('hex').slice(0, 16);

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

function backend(seen) {
  return new Promise((done) => {
    const srv = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        try { seen.push(JSON.parse(body)); } catch { /* recorded as absent below */ }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ response: '', done: true, done_reason: 'stop' }));
      });
    });
    srv.listen(0, '127.0.0.1', () => done({ srv, port: srv.address().port }));
  });
}

const dir = mkdtempSync(join(tmpdir(), 'proto-'));
const seen = [];
const { srv, port } = await backend(seen);
let task = null;
try {
  writeFileSync(join(dir, 'baseline-as-delivered.html'), BASE, 'utf8');
  await exec(process.execPath, ['server/emitTaskAuto.mjs', '--dir', dir], { cwd: process.cwd(), windowsHide: true, maxBuffer: 20e6 });
  task = JSON.parse(readFileSync(join(dir, 'task.json'), 'utf8'));
  for (const runner of ['server/managerRun.mjs', 'server/directRun.mjs']) {
    await exec(process.execPath, [runner, '--dir', dir, '--out', join(dir, `${runner.includes('direct') ? 'b' : 'a'}.json`),
      '--model-url', `http://127.0.0.1:${port}`, '--seeds', '1', '--max-rounds', '1'],
      { cwd: process.cwd(), windowsHide: true, maxBuffer: 20e6 }).catch(() => {});
  }
} finally {
  try { srv.close(); } catch { /* best effort */ }
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

const [a, b] = seen;
const fence = '```';
console.log('# AUDIT-2 — the two protocols, frozen before any fresh page exists');
console.log('');
console.log('Captured by running both runners against a recording backend on the same emitted page.');
console.log('Nothing was generated and nothing judged: these are the requests as they cross the wire.');
console.log('');
console.log(`Requirement, emitted by \`emitTaskAuto\` and identical for both arms: **${task && JSON.stringify(task.requirement.trigger)}**`);
console.log(`Effects: ${task && task.requirement.effects.map((e) => `"${e}"`).join(', ')}`);
console.log('');
console.log('| | arm A — full Legasus | arm B — direct repair |');
console.log('|---|---|---|');
console.log(`| interface | infill, prefix + suffix | whole page |`);
console.log(`| prompt bytes | ${a ? String(a.prompt || '').length : 'n/a'} | ${b ? String(b.prompt || '').length : 'n/a'} |`);
console.log(`| suffix bytes | ${a ? String(a.suffix || '').length : 'n/a'} | none |`);
console.log(`| prompt sha | ${a ? sha(String(a.prompt || '')) : 'n/a'} | ${b ? sha(String(b.prompt || '')) : 'n/a'} |`);
console.log(`| num_predict | ${a && a.options ? a.options.num_predict : '?'} | ${b && b.options ? b.options.num_predict : '?'} |`);
console.log(`| temperature | ${a && a.options ? a.options.temperature : '?'} | ${b && b.options ? b.options.temperature : '?'} |`);
console.log('');
console.log('## Arm A — the request, in full');
console.log('');
console.log(fence);
console.log(a ? String(a.prompt || '') : '(no request captured)');
console.log(fence);
console.log('');
console.log('### Arm A — the suffix the completion must join onto');
console.log('');
console.log(fence);
console.log(a ? String(a.suffix || '') : '(none)');
console.log(fence);
console.log('');
console.log('## Arm B — the request, in full');
console.log('');
console.log(fence);
console.log(b ? String(b.prompt || '') : '(no request captured)');
console.log(fence);
console.log('');
console.log('## What differs, and it is only the thing under test');
console.log('');
console.log('Arm B has the same starting page, the same machine-emitted requirement in the same English,');
console.log('the same model, backend, decoding and call cap, an output contract of the same kind as arm A\'s');
console.log('slot-language contract, containment of the same kind (its inline scripts must parse), the same');
console.log('restoration path and the same final evaluator. It does not have observation selection, code-fact');
console.log('extraction, a planner-chosen site or scaffold, or any guidance packet.');
