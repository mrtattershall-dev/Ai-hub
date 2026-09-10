/**
 * labelIcons.mjs - make numbered icon packs searchable by what the icons ARE.
 *
 *   node server/labelIcons.mjs <index.txt>          # apply
 *   node server/labelIcons.mjs <index.txt> --dry    # show what it would do
 *   node server/labelIcons.mjs --clear              # remove every label in the pack
 *   node server/labelIcons.mjs --report             # coverage by family
 *
 * WHY
 * ---
 * Icon packs ship one numbered file per icon: Franuka's are `1.png`..`354.png` at three
 * sizes, Raven's `fa1.png`..`fa2192.png`. Imported straight, 11,000 icons are effectively
 * invisible - measured 2026-09-09, the library returned NOTHING for "potion", "barrel",
 * "scroll" or "slot". The art was there; the vocabulary was not.
 *
 * TWO TRAPS, BOTH HIT ON THE FIRST ATTEMPT
 * ----------------------------------------
 * 1. The index is not one list. It is five: a base set numbered 1..354, then four
 *    expansions EACH RESTARTING AT 1. Parsing it flat collapsed 1,025 entries into 385 and
 *    every later block silently overwrote the earlier one, so `82` labelled itself with a
 *    spell instead of "Healing potion". Sections are therefore parsed separately and
 *    matched to the directory the file came from.
 * 2. `_<n>` at the end of a filename is not always an icon number. The importer appends
 *    `_2` to break name collisions, so `..._heart_of_the_sea_2.png` - a NAMED icon from the
 *    Minecraft expansion - was read as icon #2 and labelled "chainmail helmet". A file only
 *    counts as numbered when a size token is immediately followed by pure digits.
 *
 * Raven ships no index, only a reference-sheet image, so its 6,579 icons stay unlabelled.
 * That is a real gap and is reported as one rather than filled with guesses.
 */
import { readFileSync, existsSync } from 'fs';
import * as assets from './assets.js';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const CLEAR = args.includes('--clear');
const REPORT = args.includes('--report');
const flag = (n, d) => { const i = args.indexOf('--' + n); return i > -1 && args[i + 1] ? args[i + 1] : d; };
const PREFIX = flag('prefix', 'fantasy_rpg_icon');
const FILE = args.find((a) => !a.startsWith('--') && /\.(txt|md)$/i.test(a));

if (REPORT) {
  const items = assets.list();
  const byFam = new Map();
  for (const i of items) {
    const f = i.name.split('_')[0];
    const e = byFam.get(f) || { n: 0, l: 0 };
    e.n++; if (i.label) e.l++;
    byFam.set(f, e);
  }
  console.log(`\n${items.filter((i) => i.label).length} of ${items.length} assets carry a label\n`);
  console.log('family            total  labelled');
  for (const [f, e] of [...byFam.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 22)) {
    console.log(`  ${f.padEnd(20)} ${String(e.n).padStart(5)} ${String(e.l).padStart(9)}`);
  }
  process.exit(0);
}

if (CLEAR) {
  let n = 0;
  for (const i of assets.list()) {
    if (i.label && i.name.startsWith(PREFIX)) { assets.label(i.name, ''); n++; }
  }
  assets.flush();
  console.log(`cleared ${n} label(s) from ${PREFIX}*`);
  process.exit(0);
}

if (!FILE || !existsSync(FILE)) {
  console.error('usage: node server/labelIcons.mjs <index.txt> [--dry] [--prefix <tag>] | --clear | --report');
  process.exit(1);
}

// ── parse the index into sections ───────────────────────────────────────────────
// A section starts at "INDEX" (the base set) or an "EXPANSION n (Title)" heading, and its
// numbering is local to it.
const SECTION_KEY = [
  [/^INDEX\b/i, 'base_set'],
  [/^EXPANSION\s*1\b/i, 'expansions_01'],
  [/^EXPANSION\s*2\b/i, 'expansions_02'],
  [/^EXPANSION\s*3\b/i, 'expansions_03'],
  [/^EXPANSION\s*4\b/i, 'expansions_04'],
];
const sections = new Map();
let current = null;
for (const line of readFileSync(FILE, 'utf8').split(/\r?\n/)) {
  const head = SECTION_KEY.find(([rx]) => rx.test(line.trim()));
  if (head) { current = head[1]; sections.set(current, new Map()); continue; }
  if (!current) continue;
  const m = line.match(/^\s*(\d+)\s*:\s*(.+?)\s*$/);
  if (!m) continue;
  const label = m[2].replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (label && label.length <= 80 && !/^\d+[-–]\d+$/.test(m[2])) sections.get(current).set(m[1], label);
}
console.log(`index: ${[...sections].map(([k, v]) => `${k}=${v.size}`).join('  ')}`);

// ── match files to sections ─────────────────────────────────────────────────────
// A size token followed by PURE DIGITS is an icon number. Anything else is a name.
const NUMBERED = /_(\d+x\d+)_(\d+)\.(png|jpg|gif|webp)$/i;

let labelled = 0, named = 0, noSection = 0;
const missing = new Map();
const samples = [];
for (const item of assets.list()) {
  if (!item.name.startsWith(PREFIX)) continue;
  const m = item.name.match(NUMBERED);
  if (!m) { named++; continue; }
  const key = [...sections.keys()].find((k) => item.name.includes(k));
  if (!key) { noSection++; continue; }
  const text = sections.get(key).get(m[2]);
  if (!text) { missing.set(key, (missing.get(key) || 0) + 1); continue; }
  if (item.label === text) continue;
  if (!DRY) assets.label(item.name, text);
  labelled++;
  if (samples.length < 6) samples.push(`${item.name} -> ${text}`);
}
if (!DRY) assets.flush();

console.log(`${DRY ? '[dry] would label' : 'labelled'} ${labelled}`);
console.log(`  ${named} already-named file(s) left alone (expansion 4 ships real names)`);
if (noSection) console.log(`  ${noSection} numbered file(s) matched no section`);
for (const [k, n] of missing) console.log(`  ${n} number(s) in ${k} had no index entry`);
for (const s of samples) console.log(`  e.g. ${s}`);

if (!DRY) {
  console.log('');
  for (const q of ['healing potion', 'gold coins', 'steel sword', 'steel shield', 'golden key', 'chest', 'heart', 'skull', 'ruby', 'torch']) {
    const r = assets.search(q, { limit: 1 });
    const top = r.items[0];
    console.log(`  "${q}"`.padEnd(18) + `${String(r.total).padStart(4)} hit(s)` + (top ? `   ${top.path}  — ${top.label || ''}` : ''));
  }
}
