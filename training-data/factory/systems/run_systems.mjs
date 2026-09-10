/**
 * run_systems.mjs — build + PROVE the systems corpus.
 *
 *   node systems/run_systems.mjs
 *
 * For each systems/<genre>/*.js this does TWO checks, not one:
 *   1. static gate (acorn free-var analysis, same as verify_gate.mjs) — self-contained
 *   2. EXECUTION — runs `node <file>`; the file's self-checking demo throws on any wrong
 *      behaviour, so a clean exit proves the systems actually work, not just parse.
 * Only files that pass BOTH become training rows in factory/dataset_systems.jsonl
 * (same chat format / system prompt as correctness/dataset.jsonl). Each row is tagged
 * with its genre so the model sees correct, runnable systems across rpg/action/
 * adventure/casual/simulation — the point being to repeat correct CODE, not copy design.
 */
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { analyze } from '../gate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));        // .../factory/systems
const FACTORY = dirname(HERE);                               // .../factory
const GENRES = ['rpg', 'action', 'adventure', 'casual', 'simulation'];
const SYSTEM = 'You are a senior engineer who writes complete, self-contained, runnable code. Every identifier you reference must be declared or imported, declarations must precede use, and you only call methods/APIs that actually exist. Return code that runs as given.';
const MAX_CHARS = 14000;

function headerDoc(code) {
  const m = code.match(/^﻿?\s*\/\*\*?([\s\S]*?)\*\//);
  if (!m) return null;
  return m[1].split('\n').map(s => s.replace(/^\s*\*?\s?/, '').trim()).filter(Boolean).join(' ').trim() || null;
}

const rows = [];
const report = [];
for (const genre of GENRES) {
  const dir = join(HERE, genre);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter(x => x.endsWith('.js'))) {
    const p = join(dir, f);
    const code = readFileSync(p, 'utf8');
    const big = code.length > MAX_CHARS;
    const a = analyze(code);
    const gateOK = a.syntax && a.free.length === 0;
    let runOK = false, err = '';
    try { execFileSync('node', [p], { timeout: 10000, stdio: 'pipe' }); runOK = true; }
    catch (e) {
      const out = (e.stderr ? e.stderr.toString() : '') || (e.stdout ? e.stdout.toString() : '') || String(e);
      err = out.split('\n').map(s => s.trim()).filter(Boolean).pop() || String(e);
    }
    const kept = gateOK && runOK && !big;
    report.push({ genre, f, gate: gateOK ? 'ok' : (a.syntax ? 'free:' + a.free.slice(0, 3).join(',') : 'syntax'), run: runOK ? 'ok' : 'FAIL', big, kept, err });
    if (kept) {
      const doc = headerDoc(code) || `${genre} systems module`;
      const instr = `Write a complete, self-contained, runnable vanilla JavaScript ${genre} game-systems module — separate classes that communicate without shared globals, ending in a small self-checking demo that asserts the behaviour. ${doc}`;
      rows.push({ messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: instr },
        { role: 'assistant', content: '```javascript\n' + code.trim() + '\n```' },
      ] });
    }
  }
}

const outPath = join(FACTORY, 'dataset_systems.jsonl');
writeFileSync(outPath, rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''), 'utf8');

console.log('\n=== systems build (gate + execution proof) ===');
console.log('  genre        file                        gate     run     kept');
for (const r of report) {
  const tag = r.kept ? 'YES' : (r.big ? 'too-big' : 'no');
  console.log(`  ${r.genre.padEnd(11)} ${r.f.padEnd(26)} ${r.gate.padEnd(8)} ${r.run.padEnd(7)} ${tag}`);
  if (!r.kept && r.err) console.log(`              ↳ ${r.err}`);
}
const kept = report.filter(r => r.kept).length;
console.log(`\n  ${kept}/${report.length} systems proved runnable -> ${outPath} (${rows.length} rows)`);
if (kept === report.length) console.log('  ✅ every system passed gate + execution.');
console.log('  append to training set:');
console.log('    Get-Content dataset_systems.jsonl | Add-Content ..\\correctness\\dataset.jsonl   (run from factory/)');
