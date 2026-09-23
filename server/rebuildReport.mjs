/**
 * rebuildReport.mjs - rebuild a campaign report from its durable summary.
 *
 *   node server/rebuildReport.mjs <summary.jsonl> [out.json]
 *
 * NO MODEL CALLS, no workspaces, no live state. The summary file is the only input.
 *
 * This exists because three completed campaigns produced broken reports and each one was
 * recovered by hand. Recovery is now a command.
 */
import { buildReport, writeReport } from './campaignReport.js';

const [summary, out] = process.argv.slice(2);
if (!summary) { console.error('usage: node server/rebuildReport.mjs <summary.jsonl> [out.json]'); process.exit(2); }

const report = out ? writeReport(summary, out) : buildReport(summary);
console.log(JSON.stringify(report.arms, null, 2));
console.log(`\nruns: ${report.runs.length}   pairs: ${report.pairs.length}`);
console.log(`integrity ok: ${report.integrity.ok}   reconciliation ok: ${report.reconciliation.ok}`);
if (!report.integrity.ok) console.log('problems:', JSON.stringify(report.integrity).slice(0, 400));
if (out) console.log(`written: ${out}`);
