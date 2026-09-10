/**
 * verify_dataset.mjs - run a dataset's Phaser rows through REAL Chromium.
 *
 *   node factory/verify_dataset.mjs factory/dataset_v6_filtered.jsonl 60
 *
 * "Passes the gate" and "actually renders" are different claims. The gate is static;
 * this executes. Use it to check a dataset BEFORE training on it, rather than
 * discovering the problem in the fine-tuned model three hours later.
 *
 * Needs the hub server running (it owns the Chromium verifier at /api/game/verify).
 */
import { readFileSync } from 'fs';

const IN = process.argv[2];
const N = parseInt(process.argv[3] || '40', 10);
const HUB = process.env.HUB || 'http://localhost:3001';
if (!IN) { console.error('usage: node verify_dataset.mjs <dataset.jsonl> [sample]'); process.exit(1); }

const rows = readFileSync(IN, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
const isPhaser = (r) => ((r.messages.find(m => m.role === 'system') || {}).content || '').startsWith('You are an expert Phaser');
const phaser = rows.filter(isPhaser);
console.log(`${phaser.length} phaser rows in ${IN}; sampling ${Math.min(N, phaser.length)} evenly\n`);

const pick = [];
for (let i = 0; i < Math.min(N, phaser.length); i++) pick.push(phaser[Math.floor(i * phaser.length / Math.min(N, phaser.length))]);

const codeOf = (r) => {
  const a = (r.messages.find(m => m.role === 'assistant') || {}).content || '';
  const m = a.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
  return (m ? m[1] : a).trim();
};

let pass = 0, fail = 0;
const reasons = new Map();
for (let i = 0; i < pick.length; i++) {
  const code = codeOf(pick[i]);
  try {
    const r = await fetch(HUB + '/api/game/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine: 'phaser', code }), signal: AbortSignal.timeout(90000) });
    const j = await r.json();
    if (j.ok) pass++; else {
      fail++;
      const key = (j.verdict || 'unknown').slice(0, 60);
      reasons.set(key, (reasons.get(key) || 0) + 1);
    }
  } catch (e) { fail++; reasons.set('harness: ' + e.message.slice(0, 40), (reasons.get('harness') || 0) + 1); }
  if ((i + 1) % 10 === 0) process.stdout.write(`  ${i + 1}/${pick.length} (${pass} pass)\n`);
}
console.log(`\nRESULT: ${pass}/${pick.length} render clean (${Math.round(100 * pass / pick.length)}%)`);
if (reasons.size) {
  console.log('\nwhy they failed:');
  [...reasons.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}  ${k}`));
}
