/**
 * fuzzForever.mjs - fuzz the loop continuously, in successive seed batches, until killed.
 *
 *   node server/fuzzForever.mjs [firstSeed=100000] [batch=12]
 *
 * Each batch runs fuzzLoop.mjs against whatever is on disk NOW, so as fixes land the next
 * batch is already testing them. Output is deliberately sparse - ONE line per batch, plus one
 * line the first time a new kind of violation appears - because this is meant to be watched
 * for hours, and a line per iteration would bury the signal.
 *
 * ESM violations are counted but never treated as unclean or new: they are a known corpus
 * artifact (replies recorded before the prompt stated the module system).
 *
 * It deletes the scratch directory of every CLEAN iteration it ran and keeps the failing ones
 * for investigation, because an unattended fuzzer left for hours otherwise fills the disk. It
 * only ever touches seeds in its own range, so it cannot delete another campaign's evidence.
 *
 * Stopping it on Windows is a hard kill that runs none of our code: a batch already in flight
 * finishes on its own (at most one batch), and that batch's results are still streamed to
 * its own JSONL file.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIRST = parseInt(process.argv[2] || '100000', 10);
const BATCH = parseInt(process.argv[3] || '12', 10);
const seen = new Set(['ESM']);
const log = (s) => process.stdout.write(s + '\n');

let seed = FIRST, batchNo = 0, totalRuns = 0, totalClean = 0;
log(`fuzzForever: batches of ${BATCH} from seed ${seed}, alternating 4 and 6 goals per iteration, until stopped`);

for (;;) {
  batchNo += 1;
  const per = batchNo % 2 ? 4 : 6;
  const out = join(tmpdir(), `fuzzforever-${seed}.jsonl`);
  try { rmSync(out, { force: true }); } catch { /* fresh file each batch - results append */ }
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(HERE, 'fuzzLoop.mjs'), String(BATCH), String(per), String(seed)], {
    env: { ...process.env, FUZZ_OUT: out }, stdio: 'ignore', timeout: 45 * 60 * 1000, windowsHide: true,
  });

  let rows = [];
  try { rows = readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { /* reported below */ }
  if (!rows.length) {
    // Loud, not silent. A batch that produced nothing is exactly what the fuzzer's own silent
    // death looked like, and it must not read as "quiet, therefore clean".
    log(`RUNNER ERROR batch ${batchNo} seeds ${seed}-${seed + BATCH - 1}: no results (exit ${r.status}, signal ${r.signal}${r.error ? ', ' + r.error.message : ''})`);
  }

  const real = (row) => (row.violations || []).filter((v) => !v.startsWith('ESM'));
  const clean = rows.filter((row) => !real(row).length);
  const kinds = {};
  let esm = 0;
  for (const row of rows) {
    for (const v of row.violations || []) {
      const k = v.split(':')[0];
      if (k === 'ESM') esm += 1; else kinds[k] = (kinds[k] || 0) + 1;
    }
  }
  totalRuns += rows.length;
  totalClean += clean.length;
  log(`BATCH ${batchNo} seeds ${seed}-${seed + BATCH - 1} (${per} goals): ${clean.length}/${rows.length} clean ignoring ESM | kinds ${JSON.stringify(kinds)} | esm ${esm} | ${((Date.now() - t0) / 60000).toFixed(1)} min | total ${totalClean}/${totalRuns}`);

  for (const row of rows) {
    for (const v of real(row)) {
      const k = v.split(':')[0];
      if (seen.has(k)) continue;
      seen.add(k);
      log(`NEW KIND ${k} at seed ${row.seed} (${per} goals): ${v.slice(0, 200)}  -> reproduce: node server/fuzzLoop.mjs 1 ${per} ${row.seed}`);
    }
  }

  const cleanSeeds = new Set(clean.map((row) => row.seed));
  try {
    for (const d of readdirSync(tmpdir())) {
      const m = d.match(/^fuzz(\d+)-/);
      if (!m) continue;
      const s = Number(m[1]);
      if (s >= FIRST && cleanSeeds.has(s)) {
        try { rmSync(join(tmpdir(), d), { recursive: true, force: true }); } catch { /* still in use - leave it */ }
      }
    }
  } catch { /* cleanup is best-effort */ }

  seed += BATCH;
}
