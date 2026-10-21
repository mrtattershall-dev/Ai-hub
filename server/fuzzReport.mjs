/**
 * fuzzReport.mjs - turn a fuzz campaign's results.jsonl into evidence about WHY the hub fails.
 *
 *   node server/fuzzReport.mjs [outdir]          (default: <repo>/fuzz-out)
 *
 * Reads rows written by fuzzLoop's detail capture (row.detail). Rows from older campaigns carry no
 * detail and are counted but not analysed. Everything here is descriptive; where a number is a LEAD
 * rather than a finding (reply over-representation, load correlation) it says so, because with a few
 * hundred failures and a few thousand replies, some of those will look striking by chance alone.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.argv[2] || join(HERE, '..', 'fuzz-out'));
const FILE = join(OUT, 'results.jsonl');
if (!existsSync(FILE)) { console.log(`no results at ${FILE}`); process.exit(2); }
const rows = readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const real = (r) => (r.violations || []).filter((v) => !v.startsWith('ESM'));
const bad = rows.filter((r) => real(r).length);
const withDetail = rows.filter((r) => r.detail && r.detail.postmortem);
const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}%` : 'n/a');
const med = (a) => { const s = a.filter((x) => typeof x === 'number').sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const count = (arr, f) => { const m = {}; for (const x of arr) { const k = f(x); m[k] = (m[k] || 0) + 1; } return Object.entries(m).sort((a, b) => b[1] - a[1]); };
const H = (t) => console.log(`\n== ${t} ${'='.repeat(Math.max(2, 74 - t.length))}`);

let id = null; try { id = JSON.parse(readFileSync(join(OUT, 'identity.json'), 'utf8')); } catch { /* none */ }
H('CAMPAIGN');
console.log(`code under test : ${id?.code?.head?.slice(0, 10) ?? '?'} on ${id?.code?.branch ?? '?'} (${id?.code?.changedVsHead?.length ?? '?'} paths changed vs HEAD)`);
console.log(`iterations      : ${rows.length} (${withDetail.length} with detail), seeds ${Math.min(...rows.map((r) => r.seed))}..${Math.max(...rows.map((r) => r.seed))}`);
console.log(`with a violation: ${bad.length} (${pct(bad.length, rows.length)})   [ESM excluded - known corpus artifact]`);
for (const [m, n] of count(rows, (r) => (r.hostile ? 'hostile' : 'default'))) {
  const b = bad.filter((r) => (r.hostile ? 'hostile' : 'default') === m).length;
  console.log(`  ${m.padEnd(8)} ${String(n).padStart(5)} iterations, ${String(b).padStart(4)} failing (${pct(b, n)})`);
}

H('VIOLATIONS BY KIND');
for (const [k, n] of count(bad.flatMap(real), (v) => v.split(':')[0])) console.log(`  ${String(n).padStart(5)}  ${k}`);

// ── BROKEN: the hub left a .js that does not parse ────────────────────────────────────────────
const brokenIters = withDetail.filter((r) => r.detail.postmortem.broken.length);
const brokenFiles = brokenIters.flatMap((r) => r.detail.postmortem.broken.map((b) => ({ ...b, seed: r.seed, goals: r.detail.goals })));
H('BROKEN FILES - could the hub have restored them?');
console.log(`iterations with a file that does not parse: ${brokenIters.length} of ${withDetail.length} (${pct(brokenIters.length, withDetail.length)})`);
console.log(`broken files: ${brokenFiles.length}`);
const restorable = brokenFiles.filter((b) => b.goodVersion);
console.log(`  a committed version that PARSES existed for ${restorable.length} (${pct(restorable.length, brokenFiles.length)})  <- the hub left these broken anyway`);
console.log(`  no parsing version in history for ${brokenFiles.length - restorable.length}`);
if (restorable.length) {
  console.log(`  how far back the nearest parsing version was (commits touching the file): ${JSON.stringify(Object.fromEntries(count(restorable, (b) => b.goodVersionBack).slice(0, 6)))}`);
  console.log(`  size of the version that would be restored vs the broken file (median): ${med(restorable.map((b) => b.goodBytes))} B vs ${med(restorable.map((b) => b.bytes))} B`);
}
const refused = brokenIters.filter((r) => r.detail.goals.some((g) => g.repairRefused));
console.log(`iterations where the hub RECORDED refusing the end-of-run repair: ${refused.length} of ${brokenIters.length}`);
const notRefused = brokenIters.filter((r) => !r.detail.goals.some((g) => g.repairRefused));
if (notRefused.length) console.log(`  broken WITHOUT a recorded refusal (repair never ran, or ran and failed): ${notRefused.length}  seeds ${notRefused.slice(0, 8).map((r) => r.seed).join(', ')}${notRefused.length > 8 ? ' ...' : ''}`);

H('BROKEN - which files, and what the syntax error is');
for (const [f, n] of count(brokenFiles, (b) => b.file).slice(0, 8)) console.log(`  ${String(n).padStart(5)}  ${f}`);
console.log('  error signatures (line numbers and paths stripped):');
for (const [s, n] of count(brokenFiles, (b) => String(b.syntaxError).replace(/^[^ ]*\.js:\d+ \| /, '').replace(/\d+/g, '#').slice(0, 90)).slice(0, 8)) console.log(`  ${String(n).padStart(5)}  ${s}`);

H('BROKEN - HOW the file got into that state (ordered operations on it, across goals)');
// For each broken file, the sequence of operations the goals performed on it. A pattern like
// "append_file:OK -> write_file:ERR" names a mechanism; counting the patterns ranks the mechanisms.
const patterns = brokenFiles.map((b) => {
  const seq = [];
  for (const g of b.goals) for (const t of g.touches || []) {
    const [, tool, path, res] = t.split(':');
    if (path === b.file && /^(write_file|edit_file|append_file|delete_file)$/.test(tool)) seq.push(`${tool.replace('_file', '')}:${res}`);
  }
  return seq.join(' > ') || '(no recorded write)';
});
for (const [p, n] of count(patterns, (x) => x).slice(0, 10)) console.log(`  ${String(n).padStart(5)}  ${p}`);

// ── hub process death ─────────────────────────────────────────────────────────────────────────
H('HUB PROCESS DEATHS');
const died = withDetail.filter((r) => r.detail.hub.exitCode !== null || real(r).some((v) => v.startsWith('CRASH')));
console.log(`iterations where the hub exited on its own: ${died.length}`);
for (const [c, n] of count(died, (r) => r.detail.hub.exitCode ?? 'null')) console.log(`  exit code ${c}: ${n}`);
const spawnFail = bad.filter((r) => real(r).some((v) => /spawnSync .* UNKNOWN|EUNKNOWN|ENOMEM|EMFILE/.test(v)));
console.log(`iterations that failed to spawn a child process (UNKNOWN/ENOMEM/EMFILE): ${spawnFail.length}`);

H('LOAD AT THE TIME (is failure correlated with machine pressure?)');
const col = (rs, f) => med(rs.map(f));
const okIters = withDetail.filter((r) => !real(r).length);
const row = (label, rs) => console.log(`  ${label.padEnd(16)} n=${String(rs.length).padStart(4)}  free RAM ${String(col(rs, (r) => r.detail.env.start.freeMemMB) ?? '?').padStart(5)} MB  node procs ${String(col(rs, (r) => r.detail.env.start.nodeProcs) ?? '?').padStart(3)}  live hubs ${String(col(rs, (r) => r.detail.env.start.liveHubs) ?? '?')}  disk ${String(col(rs, (r) => r.detail.env.start.diskFreeGB) ?? '?')} GB  iteration ${((col(rs, (r) => r.detail.ms) || 0) / 1000).toFixed(0)} s`);
row('clean (median)', okIters);
row('failing (median)', withDetail.filter((r) => real(r).length));
if (died.length) row('hub died (median)', died);
const mem = withDetail.map((r) => r.detail.env.start.freeMemMB).filter((x) => typeof x === 'number').sort((a, b) => a - b);
if (mem.length >= 8) {
  const cut = mem[Math.floor(mem.length / 4)];
  const low = withDetail.filter((r) => r.detail.env.start.freeMemMB <= cut);
  const high = withDetail.filter((r) => r.detail.env.start.freeMemMB > cut);
  console.log(`  lowest-RAM quartile (<= ${cut} MB free): ${pct(low.filter((r) => real(r).length).length, low.length)} failing   vs rest: ${pct(high.filter((r) => real(r).length).length, high.length)}   [lead only]`);
}

// ── which replies are over-represented in failing iterations ─────────────────────────────────
H('REPLIES OVER-REPRESENTED IN BROKEN ITERATIONS  [LEADS, not findings]');
const seenIn = (rs) => { const m = new Map(); for (const r of rs) for (const i of new Set(r.detail.replies.idx)) m.set(i, (m.get(i) || 0) + 1); return m; };
if (brokenIters.length >= 5 && withDetail.length - brokenIters.length >= 5) {
  const inBad = seenIn(brokenIters), inAll = seenIn(withDetail);
  const leads = [...inBad.entries()].filter(([, n]) => n >= 4).map(([i, n]) => ({ i, n, base: inAll.get(i) || 0, lift: (n / brokenIters.length) / ((inAll.get(i) || 1) / withDetail.length) })).sort((a, b) => b.lift - a.lift).slice(0, 8);
  for (const l of leads) console.log(`  corpus reply #${String(l.i).padStart(4)}  in ${l.n}/${brokenIters.length} broken iterations vs ${l.base}/${withDetail.length} overall  (lift ${l.lift.toFixed(1)}x)`);
  console.log('  each is one of ~2,400 replies; some will look striking by chance. Read the reply, then confirm by re-running a seed with it removed.');
} else console.log('  not enough broken and unbroken iterations yet');

H('PROMPT SIZE');
const maxPrompt = withDetail.map((r) => Math.max(0, ...r.detail.replies.promptChars));
console.log(`  largest prompt per iteration, median ${med(maxPrompt)} chars, max ${Math.max(...maxPrompt)} chars (~${Math.round(Math.max(...maxPrompt) / 4)} tokens)`);
if (died.length) console.log(`  in iterations where the hub died: median ${med(died.map((r) => Math.max(0, ...r.detail.replies.promptChars)))} chars`);
console.log('');
