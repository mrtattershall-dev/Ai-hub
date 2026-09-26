/**
 * desktopReport.mjs - M5 of MILESTONE-1: what a session cost THIS desktop, from the sampler's
 * CSV (node / ollama / chrome RSS and CPU every 5 s) and the run record (model latency and
 * tokens from callStats).
 *
 *   node server/desktopReport.mjs <desktop.csv> <run.json> [--out report.json]
 *
 * Reports peak and mean RSS per process family, CPU load, model calls, tokens per second
 * (output tokens / call ms), longest call, and wall clock. Measurements, no thresholds.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [CSV, RUN] = process.argv.slice(2);
const OUT = (() => { const i = process.argv.indexOf('--out'); return i > -1 ? process.argv[i + 1] : null; })();
if (!CSV || !RUN) { console.error('usage: desktopReport.mjs <desktop.csv> <run.json> [--out f]'); process.exit(2); }

const rows = readFileSync(CSV, 'utf8').replace(/^﻿/, '').trim().split('\n').slice(1).map((l) => l.split(',')).filter((c) => c.length >= 5)
  .map((c) => ({ at: c[0], node: +c[1], ollama: +c[2], chrome: +c[3], cpu: +c[4] }));
const run = JSON.parse(readFileSync(RUN, 'utf8'));
const within = rows.filter((r) => Date.parse(r.at) >= (run.createdAt || 0) - 10_000 && Date.parse(r.at) <= (run.finalizedAt || Date.now()) + 10_000);
const use = within.length ? within : rows;
const stat = (k) => { const v = use.map((r) => r[k]).filter((x) => Number.isFinite(x)); return v.length ? { peak: Math.max(...v), mean: Math.round(v.reduce((a, b) => a + b, 0) / v.length) } : null; };
const calls = Array.isArray(run.callStats) ? run.callStats : [];
const tokPerSec = calls.filter((c) => c.ms > 0 && c.outTok > 0).map((c) => c.outTok / (c.ms / 1000));
const report = {
  run: run.id, status: run.status, wallSec: run.finalizedAt && run.createdAt ? Math.round((run.finalizedAt - run.createdAt) / 1000) : null,
  samples: use.length, sampleWindowSec: use.length ? Math.round((Date.parse(use[use.length - 1].at) - Date.parse(use[0].at)) / 1000) : 0,
  rssMb: { node: stat('node'), ollama: stat('ollama'), chrome: stat('chrome'), combinedPeak: Math.max(...use.map((r) => r.node + r.ollama + r.chrome)) },
  cpuPct: stat('cpu'),
  model: { calls: calls.length, tokensPerSecMedian: tokPerSec.length ? +tokPerSec.sort((a, b) => a - b)[Math.floor(tokPerSec.length / 2)].toFixed(2) : null, longestCallSec: calls.length ? Math.round(Math.max(...calls.map((c) => c.ms || 0)) / 1000) : null, outputTokens: calls.reduce((a, c) => a + (c.outTok || 0), 0), promptTokens: calls.reduce((a, c) => a + (c.promptTok || 0), 0) },
  diagnostics: (run.diagnostics || []).filter((d) => !d.skipped).length,
  note: 'measurements on this desktop during this run; no threshold is implied',
};
if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));
