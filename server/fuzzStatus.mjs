/**
 * fuzzStatus.mjs - is the fuzz campaign alive, and what has it found so far?
 *
 *   node server/fuzzStatus.mjs [outdir]          (default: <repo>/fuzz-out)
 *
 * Reads only the files the campaign writes, so it answers without process archaeology:
 *   forever.pid     the wrapper's pid          -> is that process still there?
 *   heartbeat.json  written by fuzzLoop after every iteration (and when each starts)
 *   status.json     written by fuzzForever after every batch
 *   batches.jsonl   one line per batch
 *
 * Verdict is RUNNING only if the pid exists AND the heartbeat is fresh. A pid with a stale heartbeat is
 * STALLED (alive but making no progress); no pid is DEAD. A single iteration can legitimately take several
 * minutes under load, so "stale" means more than 30 minutes, not more than a few.
 */
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.argv[2] || join(HERE, '..', 'fuzz-out'));
const STALE_MIN = 30;
const rd = (f) => { try { return JSON.parse(readFileSync(join(OUT, f), 'utf8')); } catch { return null; } };
const ago = (iso) => { if (!iso) return 'never'; const m = (Date.now() - Date.parse(iso)) / 60000; return m < 90 ? `${m.toFixed(1)} min ago` : `${(m / 60).toFixed(1)} h ago`; };

if (!existsSync(OUT)) { console.log(`no campaign directory at ${OUT}`); process.exit(2); }

let pid = null; try { pid = parseInt(readFileSync(join(OUT, 'forever.pid'), 'utf8'), 10); } catch { /* none */ }
let alive = false;
if (pid) { try { process.kill(pid, 0); alive = true; } catch (e) { alive = e.code === 'EPERM'; } }
const hb = rd('heartbeat.json');
const st = rd('status.json');
const id = rd('identity.json');
const hbMin = hb ? (Date.now() - Date.parse(hb.at)) / 60000 : Infinity;

let lease;
try { lease = JSON.parse(readFileSync(join(process.env.LEGASUS_STATUS_DIR || join(homedir(), '.local/state/legasus/status'), `fuzz-${pid}.json`), 'utf8')); } catch {}
const waiting = alive && lease?.pid === pid && /waiting|idle/.test(lease.state);
const verdict = waiting ? `WAITING (${lease.state})` : alive && hbMin <= STALE_MIN ? 'RUNNING' : alive ? `STALLED (pid ${pid} alive, heartbeat ${ago(hb?.at)})` : 'DEAD (no such process)';
console.log(`verdict : ${verdict}`);
console.log(`pid     : ${pid ?? '?'}   started ${ago(id?.startedAt)}   code ${id?.code?.head?.slice(0, 8) ?? '?'} on ${id?.code?.branch ?? '?'}`);
console.log(`heartbeat: ${hb ? `${hb.phase} seed ${hb.seed}, ${hb.iterationsDone}/${hb.of} in batch, ${ago(hb.at)}` : 'none yet'}`);
if (st) console.log(`last batch: #${st.batchNo} ${ago(st.at)} (${(st.lastBatchMs / 60000).toFixed(1)} min), next seed ${st.nextSeed}, total ${st.totalClean}/${st.totalRuns} clean`);

let batches = [];
try { batches = readFileSync(join(OUT, 'batches.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { /* none */ }
if (batches.length) {
  console.log(`\nlast ${Math.min(6, batches.length)} of ${batches.length} batches:`);
  for (const b of batches.slice(-6)) {
    console.log(`  #${String(b.batchNo).padStart(3)} ${b.hostile ? 'HOSTILE' : 'default'} ${b.per} goals  ${b.clean}/${b.rows} clean  ${(b.ms / 60000).toFixed(1)} min  kinds ${JSON.stringify(b.kinds)}${b.rows === 0 ? '  <-- NO RESULTS' : ''}${b.timedOut ? '  <-- TIMED OUT' : ''}`);
  }
}
process.exit(waiting || verdict === 'RUNNING' ? 0 : 1);
