#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// verifyRun3.mjs — rebuild TRANSFER-3's accepted page from the run record and prove it is the file
// that was judged, then run the FULL requested sequence against it in a fresh process.
//
//   node server/verifyRun3.mjs --run legasus/out/TRANSFER-3_run.json --out <page.html>
//
// Two different claims, kept apart: the sha match shows this is the artefact the gate accepted;
// re-running it shows REPRODUCIBLE EXECUTION. Neither shows reproducible GENERATION, which would need
// the same prompt to be run again and is reported separately if it is ever done.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const RUN = opt('run', 'legasus/out/TRANSFER-3_run.json');
const OUT = opt('out', null);
const sha = (t) => createHash('sha256').update(t).digest('hex');
const NL = String.fromCharCode(10);

const { cutRegion } = await import('./localEdit.mjs');
const { playCheck } = await import('./playCheck.js');

const run = JSON.parse(readFileSync(RUN, 'utf8'));
if (!run.accepted) { console.log('this run has no accepted attempt'); process.exit(0); }
const acc = run.attempts.find((a) => a.outcome === 'ACCEPTED');
const roundRec = run.rounds.find((r) => r.round === acc.round);

const startFile = readFileSync(run.page, 'utf8');
if (sha(startFile) !== run.baselineSha) { console.error('the baseline on disk is not the one the run used'); process.exit(1); }

const lines = startFile.split(NL);
const scaffoldLines = roundRec.scaffold.split(NL);
const scaffolded = [...lines.slice(0, roundRec.insertAfterLine + 1), ...scaffoldLines, ...lines.slice(roundRec.insertAfterLine + 1)].join(NL);
const FILL = scaffoldLines.find((l) => l.includes('// FILL IN'));
const cut = cutRegion(scaffolded, FILL, FILL);
if (!cut.ok) { console.error(`could not re-cut the slot: ${cut.reason}`); process.exit(1); }

const indent = FILL.match(/^\s*/)[0];
const context = roundRec.contextDelivered ? roundRec.contextDelivered.split(NL).map((l) => indent + l).join(NL) : '';
const block = [context, roundRec.feedbackDelivered || ''].filter(Boolean).join(NL);
const rebuilt = cut.prefix + (block ? block + NL : '') + roundRec.instruction + NL + acc.transformedCandidate.text + cut.suffix;

const match = sha(rebuilt) === acc.candidateSha;
console.log(`rebuilt sha ${sha(rebuilt).slice(0, 16)}  vs judged ${String(acc.candidateSha).slice(0, 16)}  ${match ? 'MATCH' : 'MISMATCH'}`);
if (!match) { console.error('NOT VERIFIED: a rebuild that does not hash to the judged candidate is not the judged candidate'); process.exit(1); }

const task = JSON.parse(readFileSync(join(dirname(run.page), 'task.json'), 'utf8'));
const spec = task.requested.play.spec;
const ws = mkdtempSync(join(tmpdir(), 'verify3-'));
try {
  writeFileSync(join(ws, spec.entry || 'index.html'), rebuilt.endsWith(NL) ? rebuilt : rebuilt + NL, 'utf8');
  const r = await playCheck(ws, spec);
  console.log(`\nfresh run: ${r.status}  passing [${[...(r.passing || [])].sort((a, b) => a - b).join(',')}]  failing [${[...(r.failing || [])].sort((a, b) => a - b).join(',')}]  errors ${(r.errors || []).length}`);
  for (const c of r.cases || []) console.log(`  ${c.kind === 'PASS' ? 'PASS' : 'FAIL'}  ${c.n}. ${c.name}`);
  for (const e of (r.errors || []).slice(0, 4)) console.log(`  ${e}`);
} finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }

if (OUT) { writeFileSync(OUT, rebuilt.endsWith(NL) ? rebuilt : rebuilt + NL, 'utf8'); console.log(`\nwritten to ${OUT}`); }
