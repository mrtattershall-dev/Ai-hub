/**
 * harvest_diagnose.mjs - why do real Phaser repos fail the training contract?
 *
 *   node factory/harvest_diagnose.mjs <clone-dir>
 *
 * harvest_repos.mjs short-circuits: a file rejected for local imports is never asset-
 * checked, so the report cannot say whether BUNDLING those fragments into single programs
 * would rescue them. This measures every property independently, which is what decides
 * whether the multi-file games are worth reassembling or are unusable in kind.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.argv[2];
if (!ROOT) { console.error('usage: node factory/harvest_diagnose.mjs <clone-dir>'); process.exit(1); }
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', 'coverage']);

const files = [];
(function walk(d) {
  let ents = [];
  try { ents = readdirSync(d); } catch { return; }
  for (const e of ents) {
    if (SKIP.has(e)) continue;
    const p = join(d, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p);
    else if (/\.(js|ts)$/.test(e) && !/\.min\.|\.d\.ts$/.test(e) && st.size < 400_000) files.push(p);
  }
})(ROOT);

const gate = await import('./gate.mjs');

let phaser = 0;
const has = { localImport: 0, assetLoad: 0, notPortable: 0, typescript: 0, bothImportAndAsset: 0 };
// Per game directory: could the whole game be bundled into one portable program?
const games = new Map();

for (const f of files) {
  let code = '';
  try { code = readFileSync(f, 'utf8'); } catch { continue; }
  if (!/Phaser\.Scene|extends\s+Phaser|Phaser\.Game/.test(code)) continue;
  phaser++;

  const localImport = /^\s*(?:import|export)\s[^;]*from\s+['"]\.{1,2}\//m.test(code) || /require\(\s*['"]\.{1,2}\//.test(code);
  // A real asset load. `load.pack` MUST be here: these repos declare every sprite in an
  // asset-pack JSON and call this.load.pack() once, so a regex listing only the direct
  // loaders reports an asset-heavy game as asset-free. Measured 2026-09-09: that gap made
  // super-mario-land, tank and space-invaders - 19+ PNGs each - all look portable.
  const assetLoad = /this\.load\.(image|spritesheet|audio|atlas|bitmapFont|tilemapTiledJSON|json|svg|video|html|pack|multiatlas|sprite|animation|scenePlugin|plugin|text|xml|glsl|binary|obj)\s*\(/.test(code)
    || /\.(png|jpe?g|gif|webp|mp3|ogg|wav|svg|ttf|woff2?)\b/i.test(code);
  const notPortable = !gate.dependsOnExternalResources(code).portable;
  const ts = /:\s*(number|string|boolean|void|any|Phaser\.[A-Za-z.]+)\b|private\s+\w+|public\s+\w+|interface\s+\w+/.test(code) && /\.ts$/.test(f);

  if (localImport) has.localImport++;
  if (assetLoad) has.assetLoad++;
  if (notPortable) has.notPortable++;
  if (ts) has.typescript++;
  if (localImport && assetLoad) has.bothImportAndAsset++;

  // Group by the directory that looks like one game (…/games/<name>/…)
  const m = f.replace(/\\/g, '/').match(/\/(games|experimental|patterns)\/([^/]+)\//);
  const key = m ? `${m[1]}/${m[2]}` : null;
  if (key) {
    const g = games.get(key) || { files: 0, assets: 0, imports: 0 };
    g.files++;
    if (assetLoad) g.assets++;
    if (localImport) g.imports++;
    games.set(key, g);
  }
}

const pct = (n) => `${Math.round((100 * n) / (phaser || 1))}%`.padStart(4);
console.log('\n=== why real repos fail the contract ===\n');
console.log(`  phaser-bearing files              ${phaser}`);
console.log(`  import a sibling file (fragment)  ${String(has.localImport).padStart(4)}  ${pct(has.localImport)}`);
console.log(`  load an external asset            ${String(has.assetLoad).padStart(4)}  ${pct(has.assetLoad)}`);
console.log(`  fail the portability gate         ${String(has.notPortable).padStart(4)}  ${pct(has.notPortable)}`);
console.log(`  written in TypeScript             ${String(has.typescript).padStart(4)}  ${pct(has.typescript)}`);
console.log(`  BOTH fragment and asset-loading   ${String(has.bothImportAndAsset).padStart(4)}  ${pct(has.bothImportAndAsset)}`);

console.log('\n  If a whole game were bundled into one file, would it be portable?\n');
console.log('  game'.padEnd(38) + 'files  loads-assets');
let bundlable = 0;
for (const [k, g] of [...games.entries()].sort()) {
  const verdict = g.assets ? 'NO - loads assets' : 'yes';
  if (!g.assets) bundlable++;
  console.log('  ' + k.padEnd(36) + String(g.files).padStart(5) + '  ' + verdict);
}
console.log(`\n  bundlable games: ${bundlable} of ${games.size}`);
