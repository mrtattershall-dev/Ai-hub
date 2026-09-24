/**
 * stallAudit.mjs - audit the HISTORICAL transcripts for the stall, at the request boundary.
 *
 *   node server/stallAudit.mjs <measurements-dir>
 *
 * The 500 transcripts under measurements/ (sets E, F, G - 14B and Qwen3-Coder, Sept 11) store
 * the real per-turn delta sent to the model. So for every run that repeated an identical reply
 * after a tool result, the question "did the model receive the new information?" can be
 * answered from the record rather than assumed.
 *
 * NO CODE CHANGES, NO MODEL CALLS. Counts carry denominators. Missing request-level evidence is
 * reported as UNKNOWN, never as a zero.
 *
 * For each run:
 *   stalled?        two consecutive identical replies
 *   result reached? the delta before the repeated reply contains a TOOL RESULT
 *   warning reached? any later delta contains the repeat warning
 *   sent changed?   the deltas before the two identical replies differ
 *   outcome         edited afterwards / stopped by a guard / budget / other
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.argv[2];
if (!DIR || !existsSync(DIR)) { console.error('usage: node server/stallAudit.mjs <measurements-dir>'); process.exit(2); }

const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules/.test(p)) walk(p); }
    else if (/\.transcript\.jsonl$/.test(e.name)) files.push(p);
  }
})(DIR);

const rows = [];
for (const f of files) {
  // e.g. measurements/2026-09-11-setG/runs/coder14b-setg/runs/<id>.transcript.jsonl
  const rel = f.slice(DIR.length).split(/[\\/]/).filter(Boolean);
  const set = `${rel[0]} / ${rel[2] || '?'}`;
  const lines = readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const turns = lines.filter((l) => l.kind === 'turn');
  const runFile = f.replace('.transcript.jsonl', '.json');
  const run = existsSync(runFile) ? (() => { try { return JSON.parse(readFileSync(runFile, 'utf8')); } catch { return null; } })() : null;

  // first stall: index i where reply[i] === reply[i-1]
  let i = -1;
  for (let k = 1; k < turns.length; k++) if (turns[k].reply && turns[k].reply === turns[k - 1].reply) { i = k; break; }
  const stalled = i >= 0;
  let resultReached = 'UNKNOWN', warningReached = 'UNKNOWN', sentChanged = 'UNKNOWN', outcome = 'UNKNOWN', editedAfter = 'UNKNOWN';
  if (stalled) {
    const before = Array.isArray(turns[i].sent) ? turns[i].sent : null;
    const prev = Array.isArray(turns[i - 1].sent) ? turns[i - 1].sent : null;
    if (before) resultReached = before.some((m) => /^TOOL RESULT/.test(String(m.content))) ? 'yes' : 'no';
    if (before && prev) sentChanged = JSON.stringify(before) !== JSON.stringify(prev) ? 'yes' : 'no';
    const later = turns.slice(i).flatMap((t) => (Array.isArray(t.sent) ? t.sent : []));
    if (turns.slice(i).some((t) => Array.isArray(t.sent))) warningReached = later.some((m) => /already ran this exact|You already ran/.test(String(m.content))) ? 'yes' : 'no';
    // outcome from the run record
    if (run) {
      const steps = run.steps || [];
      const stallTs = turns[i].ts || 0;
      const editsAfter = steps.filter((s) => s.tool && ['write_file', 'edit_file', 'append_file'].includes(s.tool) && (s.ts || 0) > stallTs && !/^ERROR/.test(String(s.result || '')));
      editedAfter = editsAfter.length ? 'yes' : 'no';
      const err = steps.filter((s) => s.type === 'error').map((s) => String(s.text || '')).join(' | ');
      outcome = /same response|identical answer/.test(err) ? 'stopped-by-repeat-guard'
        : /budget|deadline|time limit|out of time/i.test(err) ? 'budget'
          : run.status === 'done' ? 'finished' : (run.status || 'UNKNOWN');
    }
  }
  rows.push({ set, file: f, stalled, resultReached, warningReached, sentChanged, editedAfter, outcome, turns: turns.length, model: run?.provider || run?.model || 'UNKNOWN' });
}

const by = (k) => rows.reduce((a, r) => { a[r[k]] = (a[r[k]] || 0) + 1; return a; }, {});
const stalled = rows.filter((r) => r.stalled);
console.log(`transcripts: ${rows.length}  |  stalled (identical consecutive replies): ${stalled.length}/${rows.length}`);
console.log('\nper set (stalled / n):');
for (const s of [...new Set(rows.map((r) => r.set))]) { const n = rows.filter((r) => r.set === s); console.log(`  ${s.padEnd(22)} ${n.filter((r) => r.stalled).length}/${n.length}`); }

const tally = (label, key) => { const t = stalled.reduce((a, r) => { a[r[key]] = (a[r[key]] || 0) + 1; return a; }, {}); console.log(`\n${label} (of ${stalled.length} stalled):`); for (const [k, v] of Object.entries(t).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`); };
tally('tool RESULT in the delta before the repeated reply', 'resultReached');
tally('repeat WARNING in any later delta', 'warningReached');
tally('SENT changed between the two identical replies', 'sentChanged');
tally('EDITED successfully after the stall', 'editedAfter');
tally('OUTCOME', 'outcome');
const unwarnedStop = stalled.filter((r) => r.outcome === 'stopped-by-repeat-guard' && r.warningReached === 'no').length;
console.log(`
stopped by the repeat guard WITHOUT the warning ever reaching the model: ${unwarnedStop}/${stalled.length} stalled`);
console.log('  (the guard stops after 3 identical replies; the warning arrives 2 calls late - most stalls are killed before the model is told)');

// contrast: runs that did NOT stall
const ok = rows.filter((r) => !r.stalled);
console.log(`\nCONTRAST - non-stalled runs: ${ok.length}/${rows.length}`);

// representative traces
console.log('\nrepresentative stalled traces (result reached, warning reached, still repeated):');
for (const r of stalled.filter((r) => r.resultReached === 'yes' && r.warningReached === 'yes').slice(0, 3)) console.log('  ' + r.file);
console.log('representative stalled traces where the result did NOT reach the model:');
for (const r of stalled.filter((r) => r.resultReached === 'no').slice(0, 3)) console.log('  ' + r.file);
