/**
 * build_verified.mjs - keep only rows that PROVABLY run.
 *
 *   node factory/build_verified.mjs factory/dataset_v6_filtered.jsonl factory/dataset_v6_verified.jsonl
 *
 * The static gate asks "is this well-formed and self-contained?". Measured, that gets
 * the Phaser slice from ~0% to 70% usable. The remaining 30% are FRAGMENTS - helper
 * functions and partial scene classes lifted from an examples repo organised by API
 * rather than by whole program. They parse, load nothing, and render nothing.
 *
 * Only execution separates those. Every Phaser row is loaded in real Chromium; a row
 * survives only if the engine loaded, a canvas exists with non-zero size, and nothing
 * threw. Non-Phaser rows pass through untouched (they have their own gates).
 *
 * Slow by nature (~5s/row). Resumable: re-running skips rows already decided, via the
 * sidecar .verdicts.json, so an interrupted run costs nothing.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

const IN = process.argv[2], OUT = process.argv[3];
const HUB = process.env.HUB || 'http://localhost:3001';
if (!IN || !OUT) { console.error('usage: node build_verified.mjs <in.jsonl> <out.jsonl>'); process.exit(1); }

const SIDECAR = OUT + '.verdicts.json';
const verdicts = existsSync(SIDECAR) ? JSON.parse(readFileSync(SIDECAR, 'utf8')) : {};

const rows = readFileSync(IN, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
const sysOf = (r) => (r.messages.find(m => m.role === 'system') || {}).content || '';
const isPhaser = (r) => sysOf(r).startsWith('You are an expert Phaser');
const codeOf = (r) => {
  const a = (r.messages.find(m => m.role === 'assistant') || {}).content || '';
  const m = a.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
  return (m ? m[1] : a).trim();
};
const idOf = (r) => createHash('sha1').update(codeOf(r)).digest('hex').slice(0, 16);

const phaser = rows.filter(isPhaser);
const others = rows.filter(r => !isPhaser(r));
console.log(`${rows.length} rows: ${phaser.length} phaser to verify, ${others.length} pass through`);

let done = 0, pass = 0, skipped = 0, unreachable = 0;
for (const r of phaser) {
  const id = idOf(r);
  if (id in verdicts) { skipped++; if (verdicts[id]) pass++; done++; continue; }
  // A HARNESS failure is not a verdict. Caching one as `false` marks good rows bad
  // and the cache makes it permanent - which is exactly what happened when the hub
  // server was restarted mid-run: `kept` froze and every subsequent row was recorded
  // as failing. Only record a verdict when the verifier actually answered.
  let ok = null;
  try {
    const res = await fetch(HUB + '/api/game/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine: 'phaser', code: codeOf(r) }), signal: AbortSignal.timeout(90000) });
    if (res.ok) ok = (await res.json()).ok === true;
  } catch { ok = null; }
  if (ok === null) { unreachable++; done++; continue; }   // retry on a later run
  verdicts[id] = ok;
  if (ok) pass++;
  done++;
  if (done % 25 === 0) {
    writeFileSync(SIDECAR, JSON.stringify(verdicts));
    console.log(`  ${done}/${phaser.length}  kept ${pass} (${Math.round(100 * pass / done)}%)`);
  }
}
writeFileSync(SIDECAR, JSON.stringify(verdicts));

const keptPhaser = phaser.filter(r => verdicts[idOf(r)]);
const out = [...others, ...keptPhaser];
writeFileSync(OUT, out.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');
console.log(`\nphaser verified : ${keptPhaser.length}/${phaser.length} (${Math.round(100 * keptPhaser.length / phaser.length)}%)  [${skipped} from cache]`);
console.log(`written         : ${out.length} rows -> ${OUT}`);
