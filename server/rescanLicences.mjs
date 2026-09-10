/**
 * rescanLicences.mjs - rebuild assets/LICENSES.md from the original pack archives.
 *
 *   node server/rescanLicences.mjs <dir-of-zips> [more.zip ...]
 *
 * WHY THIS IS SEPARATE FROM THE IMPORTER
 * --------------------------------------
 * The importer's licence-file pattern required the word to be followed by a dot or the end
 * of the name, so "License and index.txt" did not match and its terms were dropped. That
 * pack (Franuka's Fantasy RPG icons, 4,420 files) is CC BY 4.0: free for commercial use
 * and legally REQUIRING attribution. Silently losing that text is the kind of mistake that
 * only shows up when someone ships.
 *
 * Re-importing 13k files to recover a few text files would be absurd, so this reads the
 * archives again and extracts only the terms. It also pulls out a CREDITS block, because
 * "the licence text is somewhere in a 6,000-line file" is not the same as knowing who has
 * to be credited.
 */
import { readdirSync, statSync, writeFileSync, existsSync, mkdtempSync, rmSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import * as assets from './assets.js';

const args = process.argv.slice(2);
let inputs = args.filter((a) => !a.startsWith('--'));
if (!inputs.length) {
  console.error('usage: node server/rescanLicences.mjs <dir-of-zips|pack.zip> [...]');
  process.exit(1);
}
inputs = inputs.flatMap((p) => {
  try {
    if (statSync(p).isDirectory()) return readdirSync(p).filter((f) => /\.zip$/i.test(f)).map((f) => join(p, f));
  } catch { /* not a dir */ }
  return [p];
});

const LICENCE_FILE = /^(licen[cs](e|ing)|readme|read_me|terms|credits?|description|about|info|special\s*note)(?![a-z])/i;
const FILLERS = ['craftpixnet', 'craftpix', 'topdown', 'pixelart', 'pixel', 'sprites', 'sprite',
  'characters', 'character', 'animated', 'animation', 'directional', 'direction', 'assets', 'asset',
  'enemies', 'mobs', 'pack', 'free', 'game', 'the', 'and', 'by'];
function packTag(zipPath) {
  let s = basename(zipPath).replace(/\.zip$/i, '').replace(/^[0-9a-f]{6,}[-_]/i, '').toLowerCase();
  s = s.replace(/\d+/g, ' ');
  for (const f of FILLERS) s = s.split(f).join(' ');
  const words = s.replace(/[^a-z ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  let tag = words.slice(0, 3).join('_');
  while (tag.length > 26 && tag.includes('_')) tag = tag.slice(0, tag.lastIndexOf('_'));
  return tag || 'pack';
}

function walk(root) {
  const out = [];
  (function rec(d) {
    let ents = [];
    try { ents = readdirSync(d); } catch { return; }
    for (const e of ents) {
      if (e === '__MACOSX') continue;
      const p = join(d, e);
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) rec(p);
      else out.push(p);
    }
  })(root);
  return out;
}

/** Pull the lines that say who to credit and under what terms. */
function summarise(text) {
  const out = { licence: null, credit: [] };
  const LIC = [
    // CraftPix ships a License.txt containing nothing but a URL, so the terms are by
    // reference. Their standard file licence permits use in commercial and non-commercial
    // games and forbids redistributing or reselling the assets themselves.
    [/craftpix\.net\/file-licenses/i, 'CraftPix file licence (by URL) - usable in games, REDISTRIBUTION NOT PERMITTED'],
    [/creative\s*commons[^\n]*by[^\n]*4\.0|CC[ -]?BY[ -]?4\.0/i, 'CC BY 4.0 - free to use, ATTRIBUTION REQUIRED'],
    [/CC0|public domain/i, 'CC0 / public domain — no attribution required'],
    [/CC[ -]?BY[ -]?SA/i, 'CC BY-SA — attribution required, derivatives share-alike'],
    [/CC[ -]?BY[ -]?NC/i, 'CC BY-NC — non-commercial only'],
    [/MIT License/i, 'MIT'],
    [/you\s+can(not|'t)\s+(re)?distribute|not\s+allowed\s+to\s+(re)?(sell|distribute)|do\s+not\s+redistribute/i,
      'proprietary — usable in games, REDISTRIBUTION NOT PERMITTED'],
  ];
  for (const [rx, label] of LIC) if (rx.test(text)) { out.licence = label; break; }
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.length > 150) continue;
    if (/(https?:\/\/\S+)/i.test(t) && /(itch\.io|patreon|twitter|x\.com|instagram|craftpix|artstation)/i.test(t)) out.credit.push(t);
    else if (/^(author|artist|created by|made by|credit)\b/i.test(t)) out.credit.push(t);
  }
  out.credit = [...new Set(out.credit)].slice(0, 6);
  return out;
}

const rows = [];
for (const zip of inputs) {
  if (!existsSync(zip)) continue;
  const tag = packTag(zip);
  let dir;
  try {
    dir = mkdtempSync(join(tmpdir(), 'lic-'));
    execFileSync('powershell', ['-NoProfile', '-Command',
      `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${dir.replace(/'/g, "''")}' -Force`],
    { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 600_000 });
  } catch (e) {
    console.log(`  ! ${basename(zip)}: ${String(e.stderr || e.message).slice(0, 100)}`);
    continue;
  }

  // One level of nesting, same as the importer.
  for (const [i, z] of walk(dir).filter((f) => /\.zip$/i.test(f)).entries()) {
    try {
      execFileSync('powershell', ['-NoProfile', '-Command',
        `Expand-Archive -LiteralPath '${z.replace(/'/g, "''")}' -DestinationPath '${join(dir, `_n${i}`).replace(/'/g, "''")}' -Force`],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 600_000 });
    } catch { /* keep going */ }
  }

  const found = walk(dir).filter((f) => LICENCE_FILE.test(basename(f)) && /\.(txt|md)$/i.test(f));
  const texts = [];
  for (const f of found) {
    try { texts.push({ name: basename(f), body: readFileSync(f, 'utf8').trim() }); } catch { /* skip */ }
  }
  const joined = texts.map((t) => t.body).join('\n');
  const sum = summarise(joined);
  // A thank-you note is not a licence. Saying "terms not identified" when the archive
  // contains NO terms at all hides the thing that actually matters: nobody has agreed to
  // anything, and the source page is the only place the terms exist.
  if (!sum.licence) {
    sum.licence = texts.length
      ? 'TERMS UNCLEAR - documents present but no recognisable licence; check the source page'
      : 'NO TERMS IN ARCHIVE - check the source page before shipping or redistributing';
  }
  rows.push({ zip: basename(zip), tag, files: texts, ...sum });
  console.log(`  ${basename(zip).padEnd(60).slice(0, 60)} ${tag.padEnd(20)} ${String(texts.length).padStart(2)} doc  ${sum.licence.slice(0, 58)}`);
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
}

const counts = new Map();
for (const i of assets.list()) {
  const fam = i.name.split('_')[0].replace(/\.[^.]+$/, '');
  counts.set(fam, (counts.get(fam) || 0) + 1);
}

let md = `# Asset licences\n\nTerms for every imported pack. These assets may be USED in games built here; check each\nlicence before REDISTRIBUTING the files themselves. Training rows reference asset PATHS\nonly and never embed the bytes, so they are unaffected either way.\n\nRegenerate with \`node server/rescanLicences.mjs <dir-of-zips>\`.\n\n## Attribution required\n\n`;
const attrib = rows.filter((r) => /ATTRIBUTION REQUIRED/.test(r.licence || ''));
md += attrib.length
  ? attrib.map((r) => `- **${r.tag}** (${counts.get(r.tag) || 0} files) — ${r.licence}\n${r.credit.map((c) => `  - ${c}`).join('\n')}`).join('\n\n') + '\n'
  : '_None of the imported packs require attribution._\n';

const unknown = rows.filter((r) => /NO TERMS IN ARCHIVE|TERMS UNCLEAR/.test(r.licence));
if (unknown.length) {
  const n = unknown.reduce((a, r) => a + (counts.get(r.tag) || 0), 0);
  md += `\n## Terms not established (${n} files)\n\nThese archives carry no licence text. Fine to use locally; verify the terms on the source\npage before shipping a game with them or redistributing the files.\n\n`;
  for (const r of unknown) md += `- **${r.tag}** (${counts.get(r.tag) || 0} files) - from \`${r.zip}\`\n`;
}

md += `\n## Summary\n\n| pack tag | files | terms |\n|---|---|---|\n`;
for (const r of rows) md += `| \`${r.tag}_*\` | ${counts.get(r.tag) || 0} | ${r.licence} |\n`;

md += `\n## Full text\n`;
for (const r of rows) {
  md += `\n### ${r.zip}\n\ntag: \`${r.tag}_*\`\n`;
  if (!r.files.length) { md += `\n_No licence file found in this archive._\n`; continue; }
  for (const f of r.files) md += `\n#### ${f.name}\n\n\`\`\`\n${f.body.slice(0, 6000)}\n\`\`\`\n`;
}

const dest = join(assets.ASSETS_DIR, 'LICENSES.md');
writeFileSync(dest, md, 'utf8');
console.log(`\n-> ${dest}`);
console.log(`   ${rows.length} pack(s); ${attrib.length} require attribution; ${unknown.length} with no terms in the archive`);
