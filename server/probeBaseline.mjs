#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// probeBaseline.mjs — does a delivered page satisfy the four baseline requirements?
//
//   node server/probeBaseline.mjs --file <page> --spec <play.json>
//
// ASSISTED-1's definition says a baseline must load clean, pass its FULL declared sequence from a
// fresh load, lack the requested addition, and have its sha recorded - and that a page failing any of
// those is not a baseline and the experiment does not start on it. This measures the first two rather
// than reasoning about them, because "a canvas is not focusable so the keys cannot work" is a
// prediction until a browser says so.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const FILE = opt('file', null);
const SPEC = opt('spec', null);
if (!FILE || !SPEC) { console.error('usage: node server/probeBaseline.mjs --file <page> --spec <play.json>'); process.exit(2); }

const { playCheck } = await import('./playCheck.js');
const html = readFileSync(FILE, 'utf8');
const spec = JSON.parse(readFileSync(SPEC, 'utf8'));

console.log(`file   ${FILE}`);
console.log(`sha256 ${createHash('sha256').update(html).digest('hex')}`);
console.log(`chars  ${html.length}`);

const ws = mkdtempSync(join(tmpdir(), 'probe-'));
try {
  writeFileSync(join(ws, spec.entry || 'index.html'), html, 'utf8');
  const r = await playCheck(ws, spec);
  // playCheck reports `status`, not `ok`, and its passing/failing are Sets. Reading it as `r.ok`
  // reported a perfectly healthy run as UNAVAILABLE and buried the real per-step reasons in a JSON
  // dump - the probe was lying about its own subject on its first use.
  if (r.status !== 'OK') { console.log(`\nUNAVAILABLE: ${r.reason || 'the play could not run'}`); process.exit(0); }
  const passing = [...(r.passing || [])].sort((a, b) => a - b);
  const failing = [...(r.failing || [])].sort((a, b) => a - b);
  console.log(`\npassing steps  [${passing.join(', ')}]`);
  console.log(`failing steps  [${failing.join(', ')}]`);
  console.log(`errors         ${(r.errors || []).length}`);
  for (const e of (r.errors || []).slice(0, 6)) console.log(`  ${String(e.text || e).slice(0, 160)}`);
  if (r.dom) console.log(`dom            ${JSON.stringify(r.dom).slice(0, 400)}`);
  for (const c of r.cases || []) {
    console.log(`  ${c.kind === 'PASS' ? 'PASS' : 'FAIL'}  ${c.n}. ${c.name}`);
    if (c.kind !== 'PASS' && c.text) console.log(`          ${String(c.text).slice(0, 200)}`);
  }
} finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
