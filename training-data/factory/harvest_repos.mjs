/**
 * harvest_repos.mjs - measure how much usable Phaser training data real GitHub repos hold.
 *
 *   node factory/harvest_repos.mjs <clone-dir> [--emit out.jsonl]
 *
 * A training row for this project must be a COMPLETE, SELF-CONTAINED, PORTABLE Phaser
 * program: it runs as given, in a bare page, with no local imports and no external
 * assets. That contract is not a preference - the original 4,242-row harvested Phaser
 * slice ignored it, 71% of its rows loaded external assets, and it scored 0/12 in
 * Chromium. Everything that has since worked was execution-gated.
 *
 * So this reports YIELD honestly, per repo, at each filter, rather than assuming a
 * highly-starred repo is a good source. Most real games load sprites; the expectation
 * going in is that survival is low.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, sep } from 'path';

const ROOT = process.argv[2];
const EMIT = process.argv.includes('--emit') ? process.argv[process.argv.indexOf('--emit') + 1] : null;
if (!ROOT) { console.error('usage: node factory/harvest_repos.mjs <clone-dir> [--emit out.jsonl]'); process.exit(1); }

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', 'coverage', '.next']);

const files = [];
(function walk(d) {
  let ents = [];
  try { ents = readdirSync(d); } catch { return; }
  for (const e of ents) {
    if (SKIP_DIR.has(e)) continue;
    const p = join(d, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p);
    else if (/\.(js|ts)$/.test(e) && !/\.min\.|\.d\.ts$/.test(e) && st.size < 400_000) files.push(p);
  }
})(ROOT);

const gate = await import('./gate.mjs');

const repoOf = (f) => {
  const rel = f.startsWith(ROOT) ? f.slice(ROOT.length) : f;
  return rel.split(/[\\/]/).filter(Boolean)[0] || '?';
};

const tally = {};
const survivors = [];
let phaserFiles = 0;

for (const f of files) {
  let code = '';
  try { code = readFileSync(f, 'utf8'); } catch { continue; }
  if (!/Phaser\.Scene|extends\s+Phaser|Phaser\.Game/.test(code)) continue;
  phaserFiles++;

  const repo = repoOf(f);
  tally[repo] = tally[repo] || { files: 0, localImport: 0, assets: 0, small: 0, noScene: 0, ok: 0 };
  const t = tally[repo];
  t.files++;

  // A row that imports a sibling file is a fragment, not a program.
  if (/^\s*(?:import|export)\s[^;]*from\s+['"]\.{1,2}\//m.test(code) || /require\(\s*['"]\.{1,2}\//.test(code)) {
    t.localImport++; continue;
  }
  if (!/Phaser\.Scene|extends\s+Phaser/.test(code)) { t.noScene++; continue; }
  if (code.length < 300) { t.small++; continue; }
  if (!gate.dependsOnExternalResources(code).portable) { t.assets++; continue; }

  t.ok++;
  survivors.push({ file: f.slice(ROOT.length).split(sep).join('/'), repo, len: code.length, code });
}

console.log('\n=== harvest yield ===\n');
console.log('repo'.padEnd(40) + 'phaser  localImp  assets   small    PASS');
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1].ok - a[1].ok)) {
  console.log(k.padEnd(40)
    + String(v.files).padStart(6) + String(v.localImport).padStart(10)
    + String(v.assets).padStart(8) + String(v.small).padStart(8) + String(v.ok).padStart(8));
}
console.log('\n  scanned js/ts files      ' + files.length);
console.log('  phaser-bearing           ' + phaserFiles);
console.log('  self-contained+portable  ' + survivors.length
  + `  (${phaserFiles ? Math.round((100 * survivors.length) / phaserFiles) : 0}% of phaser-bearing)`);

for (const s of survivors.slice(0, 25)) console.log('   ' + String(s.len).padStart(6) + '  ' + s.file);

if (EMIT) {
  writeFileSync(EMIT, survivors.map((s) => JSON.stringify(s)).join('\n') + '\n', 'utf8');
  console.log('\n  -> ' + EMIT + ' (' + survivors.length + ' candidates, NOT yet verified or prompted)');
}
