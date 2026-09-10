/**
 * filter_assets.mjs - strip asset-dependent rows from a dataset.
 *
 * WHY: 71% of the Phaser slice was harvested from the official Phaser examples,
 * which load textures from an asset server (assets/sprites/*.png, phaserfiles.com).
 * A model trained on it faithfully writes code that cannot run anywhere else - it
 * boots, creates a canvas, and renders nothing. Measured: run3 scored 0/12 on a
 * Phaser eval, 11 of 12 failing on exactly this.
 *
 *   node factory/filter_assets.mjs factory/trained_run4.jsonl factory/dataset_v6.jsonl
 *
 * Non-destructive: reads one file, writes another, never edits in place.
 */
import { readFileSync, writeFileSync } from 'fs';
import { dependsOnExternalResources } from './gate.mjs';

const IN = process.argv[2];
const OUT = process.argv[3];
if (!IN || !OUT) { console.error('usage: node filter_assets.mjs <in.jsonl> <out.jsonl>'); process.exit(1); }

// One source of truth: gate.mjs owns what 'depends on something external' means.
// This file used its own narrower regexes and let 18 rows through that the gate
// catches - the same duplication bug we fixed for the engine registry.

const rows = readFileSync(IN, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
const kept = [], dropped = { phaser: 0, other: 0 };

function sysOf(r) { return (r.messages.find(m => m.role === 'system') || {}).content || ''; }
function asstOf(r) { return (r.messages.find(m => m.role === 'assistant') || {}).content || ''; }
function isPhaser(r) { return sysOf(r).startsWith('You are an expert Phaser'); }

for (const r of rows) {
  const a = asstOf(r);
  if (!dependsOnExternalResources(a).portable) {
    dropped[isPhaser(r) ? 'phaser' : 'other']++;
    continue;
  }
  kept.push(r);
}

writeFileSync(OUT, kept.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');

const count = (rs, p) => rs.filter(p).length;
console.log(`in  : ${rows.length} rows`);
console.log(`out : ${kept.length} rows  ->  ${OUT}`);
console.log(`dropped: ${dropped.phaser} phaser + ${dropped.other} other = ${dropped.phaser + dropped.other}`);
console.log('');
console.log('composition after filtering:');
for (const [label, pred] of [
  ['phaser', isPhaser],
  ['correctness', r => sysOf(r).startsWith('You are a senior engineer')],
  ['interpret', r => sysOf(r).startsWith('You correctly interpret')],
]) {
  const before = count(rows, pred), after = count(kept, pred);
  const pct = kept.length ? Math.round(100 * after / kept.length) : 0;
  console.log(`  ${label.padEnd(12)} ${String(after).padStart(5)} / ${String(before).padStart(5)}  (${String(pct).padStart(2)}% of new set)`);
}
