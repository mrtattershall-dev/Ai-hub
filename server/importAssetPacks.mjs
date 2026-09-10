/**
 * importAssetPacks.mjs - bring downloaded asset packs (.zip) into the hub's library.
 *
 *   node server/importAssetPacks.mjs <pack.zip> [more.zip ...] [--dry]
 *   node server/importAssetPacks.mjs <dir-of-zips> [--dry]
 *
 * WHAT A PACK LOOKS LIKE (measured on 13 CraftPix / itch packs, 2026-09-09)
 * ---------------------------------------------------------------------------
 *   PNG/Orc1/Parts/orc1_attack_body.png    <- the payload, already well named
 *   ASEPRITE/  PSD/                          <- editor sources, not game assets
 *   Tiled_files/*.tmx                        <- usable map data
 *   __MACOSX/  COUPON.png  *.url  *.pdf      <- packaging noise
 *   License.txt  readme.txt                  <- terms, which we must keep but not serve
 *
 * So: import only real asset types, skip source/noise directories, and fold every licence
 * file into assets/LICENSES.md so the terms travel with the library. The last part is not
 * decoration - these packs are free to USE in a game but not to REDISTRIBUTE, which is fine
 * for the hub and the local verifier, and is exactly the thing to know before ever
 * publishing the library or a dataset that embeds it. Training rows only ever contain the
 * asset PATH, never the bytes, so they are unaffected.
 *
 * NAMING
 * ------
 * Thirteen packs will each have an `idle_01.png`, so every file gets a short tag derived
 * from its pack name: `orc_orc1_attack_body.png`. Redundant-looking, unambiguous, and the
 * agent sees the pack in the name, which is how a human would look for it too.
 */
import { readdirSync, statSync, readFileSync, mkdtempSync, rmSync, existsSync, writeFileSync, appendFileSync } from 'fs';
import { join, extname, basename, relative, sep, dirname } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as assets from './assets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
let inputs = args.filter((a) => !a.startsWith('--'));
if (!inputs.length) {
  console.error('usage: node server/importAssetPacks.mjs <pack.zip|dir> [...] [--dry]');
  process.exit(1);
}

// A directory argument means every zip in it, plus any loose asset file sitting beside
// them - five .wav footsteps were dropped next to the packs, and a tool that only saw
// archives would have ignored them without a word.
inputs = inputs.flatMap((p) => {
  try {
    if (statSync(p).isDirectory()) {
      return readdirSync(p).filter((f) => /\.zip$/i.test(f) || assets.kindOf(f)).map((f) => join(p, f));
    }
  } catch { /* fall through */ }
  return [p];
});

// A loose file is imported under its own name, minus any upload hash prefix.
function importLoose(file) {
  const clean = basename(file).replace(/^[0-9a-f]{6,}[-_]/i, '');
  const name = clean.replace(/\.[^.]+$/, (ext) => ext.toLowerCase()).replace(/^(.*)(\.[^.]+)$/, (_, stem, ext) => `${slug(stem)}${ext}`);
  if (DRY) { console.log(`\n=== ${clean}  ->  ${name}  (loose, ${(statSync(file).size / 1024).toFixed(0)} KB) ===`); return { imported: 1, dupes: 0, failed: 0, bytes: statSync(file).size }; }
  const r = assets.add({ name, dataB64: readFileSync(file).toString('base64') });
  if (!r.ok) { console.log(`\n=== ${clean} === \n  ! ${r.error}`); return { imported: 0, dupes: 0, failed: 1, bytes: 0 }; }
  console.log(`\n=== ${clean}  ->  ${r.item.path}${r.duplicate ? '  (already present)' : ''} ===`);
  return { imported: r.duplicate ? 0 : 1, dupes: r.duplicate ? 1 : 0, failed: 0, bytes: r.duplicate ? 0 : r.item.bytes };
}

const SKIP_DIRS = new Set(['__macosx', 'aseprite', 'psd', 'ase', 'source', 'sources', 'src_files', 'krita']);
const SKIP_FILES = /^(coupon|thumbs\.db|\.ds_store|desktop\.ini)/i;
// "Description.txt" is pack prose, not a game asset - one pack (rpguielements: three .psd
// sources and two text files) shipped nothing else and its description was imported as
// data. Record it with the licence text instead of serving it.
// Anchored at the start, then ANY separator. The original `(\.|$)` required the word to
// be followed by a dot or end-of-name, so "License and index.txt" - the licence for a
// CC BY pack that legally requires attribution - was not recognised and its terms were
// silently dropped. Found 2026-09-09 while checking who owns the icon art.
const LICENCE_FILE = /^(licen[cs](e|ing)|readme|read_me|terms|credits?|description|about|info)(?![a-z])/i;
const NOISE_EXT = new Set(['.url', '.pdf', '.psd', '.aseprite', '.ase', '.kra', '.xcf', '.db', '.ini', '.html', '.htm', '.js']);

// Turn "craftpixnet363992freetopdownorcgamecharacterpixelart" into "orc".
//
// Applied as sequential passes, longest word first, NOT as one alternation. A single regex
// scans left to right and takes the first alternative that matches at each position, so
// on "entcharactersprites" it consumed "characters" and left "prites" behind - the tag
// came out as "ent_prites". Bare "art"/"top"/"down" are deliberately absent: they match
// inside real words.
// 'sprites' MUST precede 'characters': in "charactersprites" they share the "s", and
// whichever is stripped first takes it. Stripping 'characters' first left "prites".
const FILLERS = ['craftpixnet', 'craftpix', 'topdown', 'pixelart', 'pixel', 'sprites', 'sprite',
  'characters', 'character', 'animated', 'animation', 'directional', 'direction', 'assets', 'asset',
  'enemies', 'mobs', 'pack', 'free', 'game', 'the', 'and', 'by'];
function packTag(zipPath) {
  let s = basename(zipPath).replace(/\.zip$/i, '').replace(/^[0-9a-f]{6,}[-_]/i, '').toLowerCase();
  s = s.replace(/\d+/g, ' ');
  for (const f of FILLERS) s = s.split(f).join(' ');
  const words = s.replace(/[^a-z ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  // Up to three words, never cut mid-word.
  let tag = words.slice(0, 3).join('_');
  while (tag.length > 26 && tag.includes('_')) tag = tag.slice(0, tag.lastIndexOf('_'));
  return tag || 'pack';
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

function extract(zip) {
  const dest = mkdtempSync(join(tmpdir(), 'pack-'));
  // Expand-Archive is what the hub already uses for zip uploads. Errors surface here
  // rather than being swallowed, because a silently-empty extraction looks like an empty
  // pack - which is what happened on the first batch attempt.
  execFileSync('powershell', ['-NoProfile', '-Command',
    `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`],
  { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 600_000 });
  return dest;
}

function walk(root) {
  const out = [];
  (function rec(d) {
    let ents = [];
    try { ents = readdirSync(d); } catch { return; }
    for (const e of ents) {
      const p = join(d, e);
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) { if (!SKIP_DIRS.has(e.toLowerCase())) rec(p); }
      else out.push({ p, rel: relative(root, p).split(sep).join('/'), size: st.size });
    }
  })(root);
  return out;
}

const LICENSES = join(assets.ASSETS_DIR, 'LICENSES.md');
const grand = { packs: 0, found: 0, imported: 0, dupes: 0, skippedType: 0, failed: 0, bytes: 0 };
const skippedExt = {};

for (const zip of inputs) {
  if (!existsSync(zip)) { console.log(`\n! missing: ${zip}`); continue; }
  if (!/\.zip$/i.test(zip)) {
    const r = importLoose(zip);
    grand.found++; grand.imported += r.imported; grand.dupes += r.dupes; grand.failed += r.failed; grand.bytes += r.bytes;
    continue;
  }
  const tag = packTag(zip);
  console.log(`\n=== ${basename(zip)}  ->  tag "${tag}"  (${(statSync(zip).size / 1048576).toFixed(1)} MB) ===`);

  let dir;
  try { dir = extract(zip); }
  catch (e) { console.log(`  ! extraction failed: ${String(e.stderr || e.message).slice(0, 200)}`); continue; }

  let files = walk(dir);

  // A pack that is a zip inside a zip (rpguielements.zip was one) imported a single file
  // and silently skipped the rest. Unpack one level of nesting into the same temp dir.
  const nested = files.filter((f) => /\.zip$/i.test(f.p));
  for (const [i, z] of nested.entries()) {
    const sub = join(dir, `_nested_${i}`);
    try {
      execFileSync('powershell', ['-NoProfile', '-Command',
        `Expand-Archive -LiteralPath '${z.p.replace(/'/g, "''")}' -DestinationPath '${sub.replace(/'/g, "''")}' -Force`],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 600_000 });
      files = files.concat(walk(sub).map((f) => ({ ...f, rel: f.rel.replace(/^_nested_\d+\//, '') })));
    } catch (e) {
      console.log(`  ! nested ${basename(z.p)} failed: ${String(e.stderr || e.message).slice(0, 120)}`);
    }
  }
  // The inner zips have been unpacked; drop the archives themselves.
  files = files.filter((f) => !/\.zip$/i.test(f.p));

  const licences = files.filter((f) => LICENCE_FILE.test(basename(f.p)) && /\.(txt|md)$/i.test(f.p));
  const candidates = files.filter((f) => !LICENCE_FILE.test(basename(f.p)) && !SKIP_FILES.test(basename(f.p)));

  const stats = { found: candidates.length, imported: 0, dupes: 0, skippedType: 0, failed: 0, bytes: 0 };
  const failures = [];
  const used = new Set();

  for (const f of candidates) {
    const ext = extname(f.p).toLowerCase();
    if (NOISE_EXT.has(ext) || !assets.kindOf(f.p)) {
      stats.skippedType++;
      skippedExt[ext || '(none)'] = (skippedExt[ext || '(none)'] || 0) + 1;
      continue;
    }

    // Name: pack tag + the path under the payload dir, minus a leading PNG/ or similar.
    const relNoTop = f.rel.replace(/^(png|images?|sprites?|tiles?|audio|sfx|music|fonts?|tiled_files|data)\//i, '');
    const parts = relNoTop.split('/');
    const file = parts.pop();
    const stem = file.replace(/\.[^.]+$/, '');
    // Only prepend directory parts that add information the filename lacks.
    const dirBits = parts.map(slug).filter((d) => d && !slug(stem).includes(d));
    let name = [tag, ...dirBits, slug(stem)].filter(Boolean).join('_').slice(0, 110) + ext;
    let k = 2;
    while (used.has(name)) name = name.replace(/(\.[^.]+)$/, `_${k++}$1`);
    used.add(name);

    if (DRY) { stats.imported++; stats.bytes += f.size; continue; }

    let b64;
    try { b64 = readFileSync(f.p).toString('base64'); }
    catch (e) { stats.failed++; failures.push(`${name}: ${e.message}`); continue; }
    const r = assets.add({ name, dataB64: b64, defer: true });
    if (!r.ok) { stats.failed++; failures.push(`${name}: ${r.error}`); continue; }
    if (r.duplicate) stats.dupes++; else { stats.imported++; stats.bytes += f.size; }
  }
  if (!DRY) assets.flush();   // one manifest write per pack, not per file

  // Keep the terms with the library, once per pack.
  if (!DRY && licences.length) {
    const existing = existsSync(LICENSES) ? readFileSync(LICENSES, 'utf8') : '# Asset licences\n\nTerms for every imported pack. These assets may be USED in games built here; check each licence before REDISTRIBUTING the files themselves.\n';
    if (!existing.includes(`## ${basename(zip)}`)) {
      let block = `\n## ${basename(zip)}\n\ntag: \`${tag}_*\`\n`;
      for (const l of licences) block += `\n### ${l.rel}\n\n\`\`\`\n${readFileSync(l.p, 'utf8').trim().slice(0, 6000)}\n\`\`\`\n`;
      if (!existsSync(LICENSES)) writeFileSync(LICENSES, existing, 'utf8');
      appendFileSync(LICENSES, block, 'utf8');
    }
  }

  console.log(`  files ${String(stats.found).padStart(5)}  imported ${String(stats.imported).padStart(5)}  dupes ${String(stats.dupes).padStart(4)}  skipped-type ${String(stats.skippedType).padStart(4)}  failed ${stats.failed}  ${(stats.bytes / 1048576).toFixed(1)} MB  licence files ${licences.length}`);
  for (const e of failures.slice(0, 4)) console.log(`   ! ${e}`);

  grand.packs++;
  for (const k of ['found', 'imported', 'dupes', 'skippedType', 'failed', 'bytes']) grand[k] += stats[k];
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
}

console.log(`\n=== ${grand.packs} pack(s): ${grand.imported} imported, ${grand.dupes} duplicate, ${grand.skippedType} skipped by type, ${grand.failed} failed, ${(grand.bytes / 1048576).toFixed(1)} MB ===`);
if (Object.keys(skippedExt).length) {
  console.log('  skipped by extension: ' + Object.entries(skippedExt).sort((a, b) => b[1] - a[1]).map(([e, n]) => `${e} x${n}`).join('  '));
}
if (!DRY) console.log(`  library now: ${JSON.stringify(assets.totals())}`);
if (!DRY && existsSync(LICENSES)) console.log(`  licences recorded in ${relative(join(__dirname, '..'), LICENSES)}`);
console.log('');
