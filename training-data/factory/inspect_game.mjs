/**
 * inspect_game.mjs - what is actually inside a finished single-file game?
 *
 *   node factory/inspect_game.mjs <game.html>
 *
 * The user's own games are the best Phaser data available, but they ship as one huge HTML
 * file with every sprite, sound and font inlined as a data: URI. That form is unusable as
 * a training row (a 6MB row is not a row) and wasteful at runtime (the same sprite is
 * re-embedded in every game that uses it). This reports the split - payload vs code, and
 * what the code is made of - so the de-inlining pipeline knows what it is dealing with.
 */
import { readFileSync } from 'fs';

const FILE = process.argv[2];
if (!FILE) { console.error('usage: node factory/inspect_game.mjs <game.html>'); process.exit(1); }

const src = readFileSync(FILE, 'utf8');
const DATA_URI = /data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/gi;

let payloadBytes = 0;
const byType = {};
for (const m of src.matchAll(DATA_URI)) {
  const bytes = Math.floor((m[2].length * 3) / 4);
  payloadBytes += bytes;
  byType[m[1]] = byType[m[1]] || { n: 0, bytes: 0 };
  byType[m[1]].n++;
  byType[m[1]].bytes += bytes;
}

const stripped = src.replace(DATA_URI, 'DATAURI');
console.log(`\nfile              ${(src.length / 1048576).toFixed(2)} MB  (${src.length.toLocaleString()} chars)`);
console.log(`inlined payloads  ${(payloadBytes / 1048576).toFixed(2)} MB across ${Object.values(byType).reduce((a, v) => a + v.n, 0)} files`);
for (const [t, v] of Object.entries(byType)) {
  console.log(`   ${t.padEnd(18)} ${String(v.n).padStart(3)} files ${(v.bytes / 1024).toFixed(0).padStart(7)} KB`);
}
console.log(`code after strip  ${(stripped.length / 1024).toFixed(0)} KB  (${stripped.length.toLocaleString()} chars)`);

const lines = stripped.split('\n');
const longest = lines.map((l, i) => ({ i: i + 1, len: l.length, t: l.trim().slice(0, 70) }))
  .sort((a, b) => b.len - a.len);
console.log(`\nlines: ${lines.length}. The longest, which is where any remaining bulk hides:`);
for (const l of longest.slice(0, 10)) {
  console.log(`  line ${String(l.i).padStart(6)} ${String(l.len).padStart(8)} chars | ${l.t}`);
}

const MARKERS = [
  '<script', '<style', 'Phaser.Scene', 'class ', 'this.anims.create', 'this.load.',
  'tilemap', 'tileset', 'TILE', 'LEVEL', 'this.physics', 'this.sound', 'this.tweens',
];
console.log('\nstructural markers:');
for (const k of MARKERS) {
  const n = stripped.split(k).length - 1;
  if (n) console.log(`   ${k.padEnd(20)} ${n}`);
}

// How much of the remaining bulk is long literal arrays (level/tilemap data)?
const arrays = [...stripped.matchAll(/\[[\s\d,.\-\n]{400,}\]/g)];
const arrayChars = arrays.reduce((a, m) => a + m[0].length, 0);
console.log(`\nlong numeric arrays: ${arrays.length}, ${(arrayChars / 1024).toFixed(0)} KB `
  + `(${((100 * arrayChars) / stripped.length).toFixed(1)}% of the stripped code)`);
console.log(`code excluding those: ${((stripped.length - arrayChars) / 1024).toFixed(0)} KB\n`);
