/**
 * extractAssets.mjs - pull the inlined assets out of a finished single-file game and put
 * them in the hub's asset library.
 *
 *   node server/extractAssets.mjs <game.html> --dry     # show what it would name things
 *   node server/extractAssets.mjs <game.html>           # actually import
 *   node server/extractAssets.mjs <dir>/*.html
 *
 * WHY
 * ---
 * The user's own games are the best asset source available, and they already exist - but
 * they ship as one HTML file with every sprite, sound and font inlined as a data: URI.
 * Measured on aetherfall_demo.html: 5.71 MB total, of which 3.41 MB is 49 base64
 * payloads (23 PNG, 24 MP3, 2 TTF).
 *
 * That form has two costs. Every game that uses the same footstep sound embeds its own
 * copy, and a 6 MB file is far past anything that can be a training row or go through the
 * verifier (MAX_CODE is 200 KB). Extracting the payloads into the shared library fixes
 * both: the code shrinks to the part that is actually interesting, and the assets become
 * reusable by everything the agent builds.
 *
 * NAMING
 * ------
 * A data: URI carries no filename, so the name has to come from the surrounding code. In
 * practice these games name them well already - `const SRC = { village_a: "data:...",
 * battle_a: "data:..." }` - so the object key is the best available name, and the
 * heuristics below are ordered by how trustworthy the source is. Anything unnamed falls
 * back to a numbered name rather than guessing.
 */
import { readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';
import * as assets from './assets.js';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const REWRITE = args.includes('--rewrite');
const FILES = args.filter((a) => !a.startsWith('--'));
if (!FILES.length) {
  console.error('usage: node server/extractAssets.mjs <game.html> [--dry] [--rewrite]');
  process.exit(1);
}

const EXT = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp',
  'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav', 'audio/mp4': '.m4a',
  'font/ttf': '.ttf', 'font/otf': '.otf', 'font/woff': '.woff', 'font/woff2': '.woff2',
  'application/font-woff': '.woff', 'application/x-font-ttf': '.ttf',
};

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);

/**
 * Work out what to call the payload at `index`, from the ~200 chars before it.
 * Ordered most- to least-trustworthy; returns null when nothing reliable is available so
 * the caller can fall back to a number instead of inventing something wrong.
 */
function nameFrom(src, index, prefix) {
  const before = src.slice(Math.max(0, index - 240), index);

  // `key: "data:...` - an object of named assets. The most common and most reliable.
  let m = before.match(/([A-Za-z_$][\w$]*)\s*:\s*["'`]\s*$/);
  if (m) return slug(m[1]);

  // `const NAME = "data:...`
  m = before.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*["'`]\s*$/);
  if (m) return slug(m[1].replace(/_SRC$|_DATA$/i, ''));

  // @font-face{font-family:'X'; src:url(data:...
  m = before.match(/font-family\s*:\s*["']?([\w -]+)["']?[^{}]*src\s*:\s*url\(\s*$/i);
  if (m) return `font_${slug(m[1])}`;

  // CSS rule: take the most specific thing in the selector - #id, [data-dir="up"], .class
  if (/url\(\s*$/.test(before)) {
    const rule = before.slice(before.lastIndexOf('}') + 1);
    const pressed = /\.pressed/.test(rule) ? '_pressed' : '';
    let sel = rule.match(/\[data-[\w-]+=["']([\w-]+)["']\]/);
    if (sel) return `${prefix}ui_${slug(sel[1])}${pressed}`;
    // A CSS colour is not an id. `color:#3a2418` otherwise names an asset "ui_3a2418".
    sel = rule.match(/#([\w-]+)/);
    if (sel && !/^(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(sel[1])) {
      return `${prefix}ui_${slug(sel[1])}${pressed}`;
    }
    sel = rule.match(/\.([a-zA-Z][\w-]*)/);
    if (sel) return `${prefix}ui_${slug(sel[1])}${pressed}`;
    return `${prefix}ui`;
  }
  return null;
}

const DATA_URI = /data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/gi;

for (const file of FILES) {
  let src;
  try { src = readFileSync(file, 'utf8'); }
  catch (e) { console.error(`  ! ${file}: ${e.message}`); continue; }

  // Strip the content hash an upload directory prepends ("b432cb0b-aetherfall_demo.html"),
  // or every asset ends up named after a temp file.
  const stem = basename(file).replace(/\.html?$/i, '').replace(/^[0-9a-f]{6,}[-_]/i, '').replace(/[-_]demo$/i, '');
  const prefix = `${slug(stem)}_`;
  console.log(`\n=== ${basename(file)} (${(src.length / 1048576).toFixed(2)} MB) ===`);

  const found = [];
  const used = new Set();
  let n = 0;
  for (const m of src.matchAll(DATA_URI)) {
    n++;
    const mime = m[1].toLowerCase();
    const ext = EXT[mime];
    if (!ext) { console.log(`  skip  ${mime} (no mapping)`); continue; }

    let name = nameFrom(src, m.index, prefix);
    // A bare key like `village_a` is more useful namespaced to the game it came from.
    if (name && !name.startsWith(prefix)) name = prefix + name;
    if (!name) name = `${prefix}asset_${n}`;

    let final = `${name}${ext}`;
    let k = 2;
    while (used.has(final)) final = `${name}_${k++}${ext}`;
    used.add(final);

    found.push({ name: final, b64: m[2], bytes: Math.floor((m[2].length * 3) / 4), mime, at: m.index, raw: m[0] });
  }

  const totalMB = found.reduce((a, f) => a + f.bytes, 0) / 1048576;
  console.log(`  ${found.length} payload(s), ${totalMB.toFixed(2)} MB`);

  if (DRY) {
    for (const f of found) console.log(`   ${String(Math.round(f.bytes / 1024)).padStart(5)}KB  ${f.name}`);
    continue;
  }

  let added = 0;
  let dupes = 0;
  const failed = [];
  const map = new Map();
  for (const f of found) {
    const r = assets.add({ name: f.name, dataB64: f.b64 });
    if (!r.ok) { failed.push(`${f.name}: ${r.error}`); continue; }
    if (r.duplicate) dupes++; else added++;
    map.set(f.raw, r.item.path);
  }
  console.log(`  imported ${added} new, ${dupes} already present, ${failed.length} failed`);
  for (const e of failed.slice(0, 5)) console.log(`   ! ${e}`);

  if (REWRITE) {
    // Point the game at the library instead of carrying its own copies. Written beside
    // the original rather than over it - this is a lossy transform, and the original is
    // the only copy of those bytes until the import above succeeded.
    let out = src;
    for (const [raw, path] of map) out = out.split(raw).join(path);
    const dest = file.replace(/\.html?$/i, '.linked.html');
    writeFileSync(dest, out, 'utf8');
    console.log(`  rewrote -> ${basename(dest)}  ${(src.length / 1048576).toFixed(2)}MB -> ${(out.length / 1048576).toFixed(2)}MB`);
  }
}

console.log(`\nlibrary now: ${JSON.stringify(assets.totals())}\n`);
