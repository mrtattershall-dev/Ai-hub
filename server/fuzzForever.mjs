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
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { tmpdir, hostname, cpus, totalmem } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIRST = parseInt(process.argv[2] || '100000', 10);
const BATCH = parseInt(process.argv[3] || '12', 10);
const seen = new Set(['ESM']);
const log = (s) => process.stdout.write(s + '\n');

// ── fuzz2-detail: a durable, self-describing campaign directory ─────────────────────────────
// Earlier campaigns left one results file per batch in %TEMP% and nothing recording WHAT code had been
// fuzzed - the main working tree changes under it as sessions switch branches. Here everything the
// campaign produces goes to one directory, and the identity of the code under test is written before
// any number is produced: file hashes and the diff against HEAD, since the tree is deliberately not committed.
const OUTDIR = resolve(process.env.FUZZ_OUTDIR || join(HERE, '..', 'fuzz-out'));
for (const d of ['', 'raw', 'evidence']) mkdirSync(join(OUTDIR, d), { recursive: true });
const sha1 = (buf) => createHash('sha1').update(buf).digest('hex');
const sh = (args) => { try { return execFileSync('git', args, { cwd: HERE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000, maxBuffer: 16 << 20 }); } catch { return null; } };
const startedAt = new Date().toISOString();
const corpus = readFileSync(join(HERE, 'testdata', 'model-corpus.jsonl'));
const identity = {
  startedAt, pid: process.pid, argv: process.argv.slice(2), outdir: OUTDIR,
  node: process.version, platform: process.platform, host: hostname(), cpus: cpus().length, totalMemMB: Math.round(totalmem() / 1048576),
  code: {
    head: (sh(['rev-parse', 'HEAD']) || '').trim(), branch: (sh(['rev-parse', '--abbrev-ref', 'HEAD']) || '').trim(),
    changedVsHead: (sh(['status', '--porcelain', '--', '.']) || '').split('\n').filter(Boolean),
    sha1: Object.fromEntries(['agent.js', 'fuzzLoop.mjs', 'fuzzForever.mjs', 'fuzzInvariants.mjs', 'fuzzCorpus.mjs', 'index.js'].map((f) => { try { return [f, sha1(readFileSync(join(HERE, f)))]; } catch { return [f, null]; } })),
  },
  corpus: { rows: corpus.toString('utf8').split('\n').filter(Boolean).length, sha1: sha1(corpus) },
};
try {
  const stamp = startedAt.replace(/[:.]/g, '-');
  writeFileSync(join(OUTDIR, `identity-${stamp}.json`), JSON.stringify(identity, null, 2));
  writeFileSync(join(OUTDIR, 'identity.json'), JSON.stringify(identity, null, 2));
  const delta = sh(['diff', 'HEAD', '--', '.']);
  if (delta) writeFileSync(join(OUTDIR, `code-delta-${stamp}.patch`), delta);
  writeFileSync(join(OUTDIR, 'forever.pid'), String(process.pid));
} catch (e) { log(`OUTDIR WRITE FAILED: ${e.message}`); }

let seed = FIRST, batchNo = 0, totalRuns = 0, totalClean = 0;
log(`fuzzForever: batches of ${BATCH} from seed ${seed}, alternating 4 and 6 goals per iteration, until stopped`);

for (;;) {
  batchNo += 1;
  const per = batchNo % 2 ? 4 : 6;
  // Every third batch serves ONLY the hostile corpus (fuzzCorpus.mjs: multi-action replies,
  // package.json-first writes, leaked line numbers, no THOUGHT). Default mode went seven
  // batches in a row without a non-ESM violation once the append fix landed; a quiet fuzzer
  // is only worth something if it is still looking where the bugs are. Hostile implies
  // --settle, so these batches run slower.
  const mode = batchNo % 3 === 0 ? ['--mode=hostile'] : [];
  const out = join(tmpdir(), `fuzzforever-${seed}.jsonl`);
  try { rmSync(out, { force: true }); } catch { /* fresh file each batch - results append */ }
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(HERE, 'fuzzLoop.mjs'), String(BATCH), String(per), String(seed), ...mode], {
    env: { ...process.env, FUZZ_OUT: out, FUZZ_RAW: join(OUTDIR, 'raw'), FUZZ_EVIDENCE: join(OUTDIR, 'evidence'), FUZZ_HEARTBEAT: join(OUTDIR, 'heartbeat.json') },
    stdio: 'ignore', timeout: 45 * 60 * 1000, windowsHide: true,
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
  log(`BATCH ${batchNo} seeds ${seed}-${seed + BATCH - 1} (${per} goals${mode.length ? ', HOSTILE' : ''}): ${clean.length}/${rows.length} clean ignoring ESM | kinds ${JSON.stringify(kinds)} | esm ${esm} | ${((Date.now() - t0) / 60000).toFixed(1)} min | total ${totalClean}/${totalRuns}`);

  for (const row of rows) {
    for (const v of real(row)) {
      const k = v.split(':')[0];
      if (seen.has(k)) continue;
      seen.add(k);
      log(`NEW KIND ${k} at seed ${row.seed} (${per} goals): ${v.slice(0, 200)}  -> reproduce: node server/fuzzLoop.mjs 1 ${per} ${row.seed}${mode.length ? ' ' + mode.join(' ') : ''}`);
    }
  }

  // fuzz2-detail: the campaign's own durable record (the %TEMP% batch file is one per batch and gets cleaned).
  const batchMs = Date.now() - t0;
  try {
    appendFileSync(join(OUTDIR, 'results.jsonl'), rows.map((row) => JSON.stringify({ batchNo, per, hostile: mode.length > 0, ...row }) + '\n').join(''));
    appendFileSync(join(OUTDIR, 'batches.jsonl'), JSON.stringify({
      at: new Date().toISOString(), batchNo, seeds: [seed, seed + BATCH - 1], per, hostile: mode.length > 0, ms: batchMs,
      rows: rows.length, clean: clean.length, kinds, esm, exit: r.status, signal: r.signal,
      timedOut: !!(r.error && /ETIMEDOUT/.test(r.error.message)), error: r.error ? r.error.message : null, totalClean, totalRuns,
    }) + '\n');
    writeFileSync(join(OUTDIR, 'status.json'), JSON.stringify({ pid: process.pid, startedAt, at: new Date().toISOString(), batchNo, nextSeed: seed + BATCH, totalClean, totalRuns, lastBatchMs: batchMs }, null, 1));
  } catch (e) { log(`OUTDIR WRITE FAILED: ${e.message}`); }

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
