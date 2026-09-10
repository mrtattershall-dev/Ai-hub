/**
 * filter_games.mjs - keep the rows that are actually game code.
 *
 *   node factory/filter_games.mjs <in.jsonl> --out <out.jsonl>
 *
 * WHY
 * ---
 * The 1,976-repo harvest produced 50,710 rows, and auditing them found only 18.3% carried
 * any game signal at all. 77.8% was generic JavaScript that happened to sit in a repo
 * tagged with a game topic - a DOM helper, a date formatter, Babel's `_createClass`
 * boilerplate (34 identical copies). Another 3.9% was React components, tests and build
 * scripts.
 *
 * That composition is not a neutral dilution. It is the shape of run5's correctness slice,
 * which was 30% of that dataset and took the code axis from 7/9 (untouched base) to 5/9,
 * and then run6 to 3/9. Twice measured, same direction. A row only earns its place if it
 * teaches something about building a game.
 *
 * The test is deliberately about EVIDENCE IN THE CODE, not the repo's topic tag: a repo
 * calling itself a game does not make its date formatter game code.
 */
import { readFileSync, writeFileSync, appendFileSync } from 'fs';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i > -1 && args[i + 1] ? args[i + 1] : d; };
const IN = args.find((a) => !a.startsWith('--'));
const OUT = flag('out', null);
if (!IN || !OUT) { console.error('usage: node factory/filter_games.mjs <in.jsonl> --out <out.jsonl>'); process.exit(1); }

// Evidence that this code is about running a game: a frame loop, a drawing surface, or the
// nouns and verbs of simulation.
const GAME_SIGNAL = [
  /requestAnimationFrame|cancelAnimationFrame/,
  /getContext\s*\(\s*['"]2d|getContext\s*\(\s*['"]webgl/,
  /\bPhaser\b|\bPIXI\b|\bTHREE\b|\bkaboom\b|\bkontra\b|\bROT\b/,
  /\b(sprite|tilemap|tileset|spritesheet)\b/i,
  /\b(velocity|acceleration|collide|collision|hitbox|bounding ?box)\b/i,
  /\b(player|enemy|projectile|bullet|powerup|inventory|respawn|spawn)\b/i,
  /\b(deltaTime|dt|elapsed|tick)\b\s*[*+\-/)]/,
  /function\s+(update|draw|render|gameLoop|tick)\s*\(/i,
  /\.(draw|render|update)\s*\(\s*(ctx|context|canvas|g)\b/i,
];

// Evidence it is something else wearing a game topic.
const NOT_GAME = [
  /\bReact\b|useState|useEffect|useCallback|jsx|<\/[A-Z]/,
  /\bdescribe\s*\(|\bit\s*\(\s*['"]|\bexpect\s*\(|\btest\s*\(\s*['"]/,
  /webpack|rollup|vite\.config|eslint|babel\.config|tsconfig/i,
  /\bexpress\s*\(|mongoose|sequelize|prisma|\bfastify\b|\bkoa\b/i,
  /@angular|\bVue\b|svelte|next\/router/,
  /_defineProperties|_createClass|_classCallCheck|__webpack_require__/,
];

const rows = readFileSync(IN, 'utf8').split('\n').filter(Boolean);
writeFileSync(OUT, '');

const stats = { total: 0, kept: 0, noSignal: 0, notGame: 0, tooShort: 0, dupe: 0 };
const seen = new Set();
const keptRepos = new Map();
const keptAxis = new Map();

for (const line of rows) {
  stats.total++;
  let r;
  try { r = JSON.parse(line); } catch { continue; }
  const code = r.code || '';

  if (code.length < 150) { stats.tooShort++; continue; }
  if (NOT_GAME.some((rx) => rx.test(code))) { stats.notGame++; continue; }
  if (!GAME_SIGNAL.some((rx) => rx.test(code))) { stats.noSignal++; continue; }

  const key = code.replace(/\s+/g, ' ').trim();
  if (seen.has(key)) { stats.dupe++; continue; }
  seen.add(key);

  appendFileSync(OUT, JSON.stringify(r) + '\n');
  stats.kept++;
  keptRepos.set(r.repo, (keptRepos.get(r.repo) || 0) + 1);
  keptAxis.set(r.axis, (keptAxis.get(r.axis) || 0) + 1);
}

const pct = (n) => `${((100 * n) / stats.total).toFixed(1)}%`;
console.log(`\n${stats.total.toLocaleString()} rows in`);
console.log(`  -${String(stats.tooShort).padStart(6)} under 150 chars`);
console.log(`  -${String(stats.notGame).padStart(6)} react / tests / build / server  ${pct(stats.notGame)}`);
console.log(`  -${String(stats.noSignal).padStart(6)} no game signal in the code      ${pct(stats.noSignal)}`);
console.log(`  -${String(stats.dupe).padStart(6)} duplicate body`);
console.log(`  =${String(stats.kept).padStart(6)} kept                            ${pct(stats.kept)}`);
console.log(`\n  by axis: ${[...keptAxis].map(([k, v]) => `${k}=${v}`).join('  ')}`);
console.log(`  repos contributing: ${keptRepos.size}`);
const top = [...keptRepos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log('  top:');
for (const [n, c] of top) console.log(`    ${String(c).padStart(5)} ${n}  (${((100 * c) / stats.kept).toFixed(1)}%)`);
console.log(`\n  -> ${OUT}\n`);
