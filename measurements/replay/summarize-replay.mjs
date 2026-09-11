// summarize-replay.mjs <results.jsonl> [<results.jsonl> ...] - totals for replay-run.mjs output.
//
// Per file: how many replays ended with the same status as the recording, which changed, and - per hub fix - how
// many scenarios it fired in and how often. A replay serves the model's recorded replies, so a changed status means
// the hub behaved differently on the same words; EXHAUSTED means it asked for more than the model originally said.
import { readFileSync } from 'node:fs';

const COUNTERS = [
  ['ledgerHidden', 'leftover tasks hidden from the per-call ledger (turns)'],
  ['staleShown', 'leftover tasks still shown (same file, or the goal right after)'],
  ['noChangeEdits', 'edits answered NO CHANGE'],
  ['exportLossWarnings', 'dropped-export warnings'],
  ['shadowHints', 'hidden-method hints'],
  ['connRetries', 'dropped-connection retries'],
  ['defLossWarnings', 'definition-loss warnings'],
  ['gateBlocks', 'finish-gate blocks'],
  ['discardNudges', 'multi-action discard nudges'],
];
for (const file of process.argv.slice(2)) {
  const rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const errors = rows.filter((r) => r.error);
  const ok = rows.filter((r) => !r.error);
  const same = ok.filter((r) => r.sameAsOriginal);
  const changed = ok.filter((r) => !r.sameAsOriginal);
  const exhausted = ok.filter((r) => r.exhausted);
  console.log(`\n${file}\n  ${rows.length} replays | same status as recorded ${same.length} | changed ${changed.length} | exhausted ${exhausted.length} | errors ${errors.length}`);
  for (const [k, label] of COUNTERS) {
    const hits = ok.filter((r) => (r[k] || 0) > 0);
    const total = ok.reduce((a, r) => a + (r[k] || 0), 0);
    console.log(`  ${label.padEnd(66)} ${String(hits.length).padStart(3)} scenarios, ${total} total`);
  }
  const verify = {};
  for (const r of ok) for (const v of r.verifyDetected || []) verify[v] = (verify[v] || 0) + 1;
  console.log(`  verify_project detected: ${Object.entries(verify).map(([k, v]) => `${k} x${v}`).join(', ') || 'never called'}`);
  const byChange = {};
  for (const r of changed) { const k = `${r.original.status} -> ${r.status}`; (byChange[k] = byChange[k] || []).push(r.id.replace(/^.*-g/, 'g')); }
  for (const [k, ids] of Object.entries(byChange)) console.log(`  changed ${k}: ${ids.length} (${ids.slice(0, 12).join(' ')}${ids.length > 12 ? ' ...' : ''})`);
  for (const r of errors.slice(0, 5)) console.log(`  ERROR ${r.id}: ${String(r.error).slice(0, 140)}`);
}
