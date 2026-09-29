// A-4 AND THE REFUSALS, THROUGH REAL DISPATCH — the parent that was missing.
//
//     node legasus/runtime/epistemic-admission/governed-dispatch.test.mjs
//
// `classA-governed-child.mjs` existed and NOTHING SPAWNED IT: grep found no reference to it under any
// spelling, so the one place `setRunAuthority` was ever called was itself unreachable. A-4 was listed
// as a requirement in ACTION-GOVERNANCE-1_AMENDMENT-4.md with no claimed result, which was honest -
// it was specified and never run. This file runs it.
//
// WHAT IT ESTABLISHES, and each mode is its own process because AGENT_GOVERNED_WRITES and the
// module-scoped authority are read at import time:
//
//   authorized    owner-issued scope covering three paths -> write_file, append_file and edit_file
//                 each SUCCEED and produce the EXACT expected bytes
//   noauthority   no scope issued -> each REFUSES and leaves NO EFFECT on disk
//   outofscope    scope naming a different file -> each refuses with SCOPE_MISMATCH, no effect
//   forged        the model supplies a well-formed grant for the exact target IN TOOL ARGUMENTS ->
//                 ignored, each refuses. Widening through an argument is unrepresentable.
//   ungoverned    THE SPECIFICITY CONTROL. Flag off, no scope, identical calls -> all three SUCCEED.
//                 Without it, an agent.js that simply could not write any more would pass every
//                 refusal case above, which is the assertion-that-cannot-fail shape.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHILD = join(HERE, 'governed-dispatch-child.mjs');

let pass = 0, fail = 0;
const ok = (cond, what) => { if (cond) { pass++; console.log('  ok    ' + what); } else { fail++; console.log('  FAIL  ' + what); } };

function run(mode, { governed = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'govdisp-'));
  const ws = join(dir, 'workspace');
  mkdirSync(ws, { recursive: true });
  const env = { ...process.env, AGENT_WORKSPACE: ws, AGENT_UNATTENDED: '1' };
  if (governed) env.AGENT_GOVERNED_WRITES = '1'; else delete env.AGENT_GOVERNED_WRITES;
  const r = spawnSync(process.execPath, [CHILD, ws, mode], { env, encoding: 'utf8', timeout: 60000 });
  const m = /__RESULT__(.+)/.exec(r.stdout || '');
  if (!m) {
    console.log('  FAIL  ' + mode + ': child produced no result. stderr: ' + String(r.stderr || '').slice(0, 300));
    fail++;
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* windows */ }
    return null;
  }
  const out = JSON.parse(m[1]);
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* windows holds handles */ }
  return out;
}

const TOOLS = ['write_file', 'append_file', 'edit_file'];
const refused = (s) => /REFUSED by governance/.test(String(s));
const succeeded = (s) => /^OK[:,]/.test(String(s));

console.log('governed dispatch — A-4 and the refusals, through tools[name](args)');

// ── 1. AUTHORIZED: the positive control. All three succeed, with the exact bytes. ────────────────
const a = run('authorized');
if (a) {
  ok(a.governedFlag === true, 'authorized: governance was actually ENABLED in the child');
  ok(a.scopeInstalled.join(',') === 'a.txt,b.txt,c.txt', 'authorized: the owner-issued scope is the three paths');
  for (const t of TOOLS) ok(succeeded(a.results[t]), 'authorized: ' + t + ' SUCCEEDS -> ' + String(a.results[t]).slice(0, 52));
  ok(a.files['a.txt'] === 'AAA\n', 'authorized: write_file produced the exact bytes');
  ok(a.files['b.txt'] === 'BBB\n', 'authorized: append_file produced the exact bytes');
  ok(a.files['c.txt'] === 'CCC\n', 'authorized: edit_file produced the exact bytes');
}

// ── 2. NO AUTHORITY: each refuses, and nothing reaches the disk. ─────────────────────────────────
const n = run('noauthority');
if (n) {
  ok(n.scopeInstalled.length === 0, 'noauthority: no grant was installed');
  for (const t of TOOLS) ok(refused(n.results[t]), 'noauthority: ' + t + ' REFUSES');
  ok(n.files['a.txt'] === null, 'noauthority: write_file had NO EFFECT (a.txt absent)');
  ok(n.files['b.txt'] === null, 'noauthority: append_file had NO EFFECT (b.txt absent)');
  ok(n.files['c.txt'] === 'SEED\n', 'noauthority: edit_file had NO EFFECT (c.txt still SEED)');
}

// ── 3. OUT OF SCOPE: an authority exists, for another file. ──────────────────────────────────────
const o = run('outofscope');
if (o) {
  for (const t of TOOLS) ok(/SCOPE_MISMATCH/.test(String(o.results[t])),
    'outofscope: ' + t + ' refused with SCOPE_MISMATCH from the boundary itself');
  ok(o.files['a.txt'] === null && o.files['b.txt'] === null && o.files['c.txt'] === 'SEED\n',
    'outofscope: no effect on any of the three paths');
}

// ── 4. FORGED: a valid grant for the exact target, supplied by the caller in tool args. ──────────
const f = run('forged');
if (f) {
  ok(f.scopeInstalled.length === 0, 'forged: the installer holds nothing, so only the args carry a grant');
  for (const t of TOOLS) ok(refused(f.results[t]),
    'forged: ' + t + ' IGNORES an authority arriving in arguments and refuses');
  ok(f.files['a.txt'] === null && f.files['b.txt'] === null && f.files['c.txt'] === 'SEED\n',
    'forged: no effect - self-issued permission bought nothing');
}

// ── 5. THE SPECIFICITY CONTROL. Flag off, no scope: the same calls must all WORK. ────────────────
const u = run('ungoverned', { governed: false });
if (u) {
  ok(u.governedFlag === false, 'ungoverned: governance is OFF');
  ok(u.scopeInstalled.length === 0, 'ungoverned: still no authority installed');
  for (const t of TOOLS) ok(succeeded(u.results[t]),
    'ungoverned: ' + t + ' SUCCEEDS with no authority, so the refusals above are governance and not breakage');
  ok(u.files['a.txt'] === 'AAA\n' && u.files['b.txt'] === 'BBB\n' && u.files['c.txt'] === 'CCC\n',
    'ungoverned: the same three writes land normally');
}

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
