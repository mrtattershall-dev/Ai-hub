/**
 * comparability.smoke.mjs - run the REAL scorer end to end against a stub verifier, three times.
 *
 *   node factory/comparability.smoke.mjs
 *
 * The unit test proves the decision; this proves the WIRING - that the report path actually
 * withholds the affected columns and preserves the raw verdicts. The stub answers the same
 * `/api/game/verify` and `/api/health` contract the Modal verifier does, and decides the
 * asset version it reports from a marker in the submitted code, so one process can produce
 * matching, mismatched and missing versions without a real library.
 *
 * The scorer is spawned ASYNCHRONOUSLY. The first version of this file used execFileSync,
 * which blocked this process's event loop - and the stub server lives in this process, so it
 * could not answer a single request while the scorer ran. Every phaser row scored '?', the
 * verifier read NONE REACHABLE, and the smoke was measuring its own deadlock, not the gate.
 */
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCORER = join(HERE, 'score_run.mjs');
const execFileP = promisify(execFile);

const server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/health') { res.end(JSON.stringify({ ok: true, assetVersion: 'stub' })); return; }
    let code = '';
    try { code = JSON.parse(body || '{}').code || ''; } catch { code = ''; }
    const m = /LIB:([A-Za-z0-9_-]+)/.exec(code);
    const out = { ok: true, verdict: 'stub: rendered' };
    if (m && m[1] !== 'NONE') out.assetVersion = m[1];        // LIB:NONE -> no version reported
    res.end(JSON.stringify(out));
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}`;

const evalDir = mkdtempSync(join(tmpdir(), 'comparability-smoke-'));
const row = (id, lib) => JSON.stringify({ id, axis: 'phaser', text: '```js\n// LIB:' + lib + '\nnew Phaser.Game({});\n```' });
const codeRow = (id) => JSON.stringify({ id, axis: 'code', text: '```js\nconsole.log(1);\n```' });
const write = (name, libA, libB) => writeFileSync(join(evalDir, `eval_${name}.jsonl`),
  [row('p1', libA), row('p2', libB), codeRow('c1')].join('\n') + '\n');

async function runScorer(a, b) {
  try {
    const r = await execFileP(process.execPath, [SCORER, a, b], {
      encoding: 'utf8', timeout: 300_000, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, CHROMIUM_VERIFY: url, EVAL_DIR: evalDir, MODEL_BASE: '' },
    });
    return r.stdout + r.stderr;
  } catch (e) {
    return String(e.stdout || '') + String(e.stderr || '') + `\n[scorer exited: ${e.code ?? e.signal}]`;
  }
}

const cases = [
  { name: 'matching known versions', a: ['v7', 'v7'], b: ['v7', 'v7'], expect: 'COMPARABLE' },
  { name: 'mismatched versions', a: ['v7', 'v7'], b: ['v8', 'v8'], expect: 'MISMATCH' },
  { name: 'missing version evidence', a: ['NONE', 'NONE'], b: ['v7', 'v7'], expect: 'UNESTABLISHED' },
];

let failures = 0;
for (const c of cases) {
  write('base', ...c.a); write('cand', ...c.b);
  const out = await runScorer('base', 'cand');
  const lines = out.split(/\r?\n/);
  const phaserLine = (lines.find((l) => /^phaser\s/.test(l)) || '').trim();
  const codeLine = (lines.find((l) => /^code\s/.test(l)) || '').trim();
  const rawFile = readdirSync(evalDir).find((f) => f.startsWith('scores-base_cand-'));
  const raw = rawFile ? JSON.parse(readFileSync(join(evalDir, rawFile), 'utf8')) : null;
  const status = raw && raw.comparability.phaser.status;
  const numbersShown = /^phaser\s+\d+\/\d+/.test(phaserLine);
  const ok = status === c.expect
    && (c.expect === 'COMPARABLE' ? numbersShown : !numbersShown)
    && /^code\s+\d+\/\d+/.test(codeLine)                                    // the independent axis is never blocked
    && !!raw && raw.results.base.phaser.every((r) => 'assetVersion' in r);  // raw preserved with versions
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  console.log(`        phaser row : ${phaserLine || '(none)'}`);
  console.log(`        code row   : ${codeLine || '(none)'}`);
  console.log(`        raw status : ${status}  (${raw ? raw.comparability.phaser.why : 'no raw file'})`);
  if (!ok) {
    console.log('        ---- scorer output (first 60 lines) ----');
    for (const l of lines.slice(0, 60)) console.log('        | ' + l);
    console.log('        ---- end ----');
  }
  for (const f of readdirSync(evalDir)) if (f.startsWith('scores-')) rmSync(join(evalDir, f), { force: true });
}
server.close();
console.log(failures ? `\n${failures} smoke case(s) FAILED` : '\nall smoke cases passed');
process.exit(failures ? 1 : 0);
