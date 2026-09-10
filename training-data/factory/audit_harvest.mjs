/**
 * audit_harvest.mjs - is this harvest actually good?
 *
 *   node factory/audit_harvest.mjs <rows.jsonl> [--samples 8]
 *
 * WHY
 * ---
 * 50,710 rows is a number, not a quality. A harvest can be large and still be the wrong
 * thing: dominated by two repos, full of minified bundles, or generic web code wearing a
 * game topic. This project has already shipped a 4,242-row Phaser slice that scored 0/12
 * because nobody checked what was in it, and a 30%-of-data correctness slice that made the
 * model measurably worse.
 *
 * So this reports the things that would make the set unusable, in the order they matter:
 * concentration, whether the code is game code at all, duplication, and size sanity.
 */
import { readFileSync } from 'fs';

const args = process.argv.slice(2);
const FILE = args.find((a) => !a.startsWith('--'));
const SAMPLES = Number((args.indexOf('--samples') > -1 && args[args.indexOf('--samples') + 1]) || 6);
if (!FILE) { console.error('usage: node factory/audit_harvest.mjs <rows.jsonl>'); process.exit(1); }

const rows = readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map((l) => {
  try { return JSON.parse(l); } catch { return null; }
}).filter(Boolean);

const pct = (n, d = rows.length) => `${((100 * n) / d).toFixed(1)}%`;
const bar = (n, d, w = 28) => '#'.repeat(Math.round((n / d) * w)).padEnd(w, '.');

console.log(`\n${rows.length.toLocaleString()} rows from ${FILE}\n`);

// ── 1. concentration: does a handful of repos own the set? ──────────────────────
const byRepo = new Map();
for (const r of rows) byRepo.set(r.repo, (byRepo.get(r.repo) || 0) + 1);
const repos = [...byRepo.entries()].sort((a, b) => b[1] - a[1]);
const top10 = repos.slice(0, 10).reduce((a, r) => a + r[1], 0);
console.log('CONCENTRATION');
console.log(`  ${repos.length} repos contributed`);
console.log(`  top 1  = ${pct(repos[0][1])}   top 10 = ${pct(top10)}`);
for (const [name, n] of repos.slice(0, 10)) {
  console.log(`    ${String(n).padStart(5)} ${bar(n, repos[0][1], 20)} ${name}`);
}

// ── 2. is it game code? ─────────────────────────────────────────────────────────
// A row tagged `phaser` should mention Phaser. A row tagged `code` should look like a
// game loop or game logic, not a React component or a build script.
const GAME_SIGNAL = /requestAnimationFrame|getContext\(|canvas|\bsprite|\bvelocity|\bcollide|\bcollision|\btilemap|\bplayer\b|\benemy\b|update\s*\(|draw\s*\(|render\s*\(|Phaser|deltaTime|\bdt\b/i;
const NOT_GAME = /\bReact\b|useState|useEffect|module\.exports\s*=\s*\{[\s\S]*webpack|eslint|jest\.|describe\(|it\(['"]|expect\(|@angular|vue|next\/|express\(\)|mongoose|\bsequelize\b/i;
let gameish = 0; let notGame = 0; let neither = 0;
const suspicious = [];
for (const r of rows) {
  const c = r.code || '';
  const g = GAME_SIGNAL.test(c);
  const n = NOT_GAME.test(c);
  if (g && !n) gameish++;
  else if (n) { notGame++; if (suspicious.length < 400) suspicious.push(r); }
  else neither++;
}
console.log('\nIS IT GAME CODE?');
console.log(`  game signals present   ${String(gameish).padStart(6)}  ${pct(gameish)}`);
console.log(`  looks like NOT a game  ${String(notGame).padStart(6)}  ${pct(notGame)}   (react/tests/build/server)`);
console.log(`  neither signal         ${String(neither).padStart(6)}  ${pct(neither)}`);
const suspectRepos = new Map();
for (const s of suspicious) suspectRepos.set(s.repo, (suspectRepos.get(s.repo) || 0) + 1);
if (suspectRepos.size) {
  console.log('  worst offenders:');
  for (const [n, c] of [...suspectRepos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    console.log(`    ${String(c).padStart(4)} ${n}`);
  }
}

// ── 3. axis + form ──────────────────────────────────────────────────────────────
const count = (k) => {
  const m = new Map();
  for (const r of rows) m.set(r[k], (m.get(r[k]) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
console.log('\nSHAPE');
for (const k of ['axis', 'form', 'license']) {
  console.log(`  ${k.padEnd(8)} ${count(k).map(([v, n]) => `${v}=${n}`).join('  ')}`);
}
const ts = rows.filter((r) => /\.tsx?$/i.test(r.path || '')).length;
console.log(`  from .ts/.tsx  ${ts}  ${pct(ts)}`);

// ── 4. duplication ──────────────────────────────────────────────────────────────
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const seen = new Map();
for (const r of rows) {
  const k = norm(r.code);
  seen.set(k, (seen.get(k) || 0) + 1);
}
const dupes = rows.length - seen.size;
console.log('\nDUPLICATION');
console.log(`  unique bodies ${seen.size.toLocaleString()}  duplicates ${dupes.toLocaleString()} (${pct(dupes)})`);
const worst = [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
for (const [body, n] of worst) {
  if (n < 3) break;
  console.log(`    x${n}  ${body.slice(0, 88)}`);
}

// ── 5. size sanity ──────────────────────────────────────────────────────────────
const lens = rows.map((r) => (r.code || '').length).sort((a, b) => a - b);
const q = (p) => lens[Math.floor(lens.length * p)] || 0;
const minified = rows.filter((r) => {
  const c = r.code || '';
  const lines = c.split('\n').length;
  return c.length > 500 && c.length / lines > 200;      // very long lines = bundled/minified
}).length;
console.log('\nSIZE');
console.log(`  chars  p10 ${q(0.1)}  p50 ${q(0.5)}  p90 ${q(0.9)}  p99 ${q(0.99)}  max ${lens[lens.length - 1]}`);
console.log(`  suspected minified/bundled: ${minified} (${pct(minified)})`);
console.log(`  total content ${(lens.reduce((a, b) => a + b, 0) / 1e6).toFixed(1)}M chars  ~${(lens.reduce((a, b) => a + b, 0) / 3.6e6).toFixed(1)}M tokens`);

// ── 6. eyeball a few ────────────────────────────────────────────────────────────
console.log('\nSAMPLES (random)');
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
for (let i = 0; i < SAMPLES; i++) {
  const r = rows[Math.floor(rnd() * rows.length)];
  console.log(`\n  --- ${r.repo}  ${r.path}  [${r.axis}/${r.form}${r.name ? ' ' + r.name : ''}]`);
  console.log('  ' + String(r.code).split('\n').slice(0, 6).join('\n  ').slice(0, 420));
}
console.log('');
