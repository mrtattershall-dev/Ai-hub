/**
 * assets.js - the hub's shared asset library.
 *
 * WHY THIS EXISTS
 * ---------------
 * Until now the agent could only draw with generated graphics. That was not a style
 * choice, it was a hard constraint: the Chromium verifier renders code with
 * `page.setContent()`, so the page has NO base URL and any relative asset path resolves
 * to nothing. Code that loaded a sprite could not be verified, so the training gate
 * rejected it outright (`gate.mjs`: "loads an asset file at runtime") and
 * `selftest.mjs` asserted that rejection. The original 4,242-row harvested Phaser slice
 * ignored the constraint, 71% of its rows loaded assets, and it scored 0/12.
 *
 * The fix is not to relax the gate - it is to make the assets REALLY THERE, everywhere
 * code runs. This module is the single source of truth for that, consumed by:
 *
 *   1. the hub          - serves /assets/<name> so a built game opens and works
 *   2. the agent        - told exactly which assets exist, so it stops inventing names
 *   3. the verifiers    - intercept asset requests and fulfil them from here
 *   4. the training gate - a path IN the manifest is portable; anything else is not
 *
 * All four must agree, or the eval stops meaning anything. Hence one manifest, one path
 * shape, and a version hash that pins the whole set.
 *
 * THE PATH CONTRACT
 * -----------------
 * Assets are referenced as `assets/<name>` - the conventional Phaser form, and what real
 * repos already write. That matters: it is the shape the model has seen most, and it
 * means harvested code does not need rewriting to be legal.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, renameSync } from 'fs';
import { readJsonSafe, renameWithRetry } from './safeJson.js';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ASSETS_DIR = join(__dirname, '..', 'assets');
const MANIFEST = join(ASSETS_DIR, 'manifest.json');

// The public path every consumer agrees on. Code writes `assets/hero.png`.
export const PUBLIC_PREFIX = 'assets/';

/**
 * Extension whitelist, by kind.
 *
 * Deliberately excludes .svg, .html, .js and .mjs. These files are served by the hub from
 * its own origin: an SVG or HTML document can carry <script>, so uploading one would be a
 * way to run script as the hub. Game textures never need it - and if SVG is ever wanted,
 * it must be served with a restrictive CSP, not simply added to this list.
 */
const KINDS = {
  image: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'],
  audio: ['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.flac'],
  data: ['.json', '.csv', '.tmx', '.tsx', '.atlas', '.txt', '.xml', '.fnt'],
  // Bitmap and TTF fonts are ordinary game assets - the user's own games ship two TTFs
  // inlined via @font-face. Web fonts cannot carry script, so they are safe to serve.
  font: ['.ttf', '.otf', '.woff', '.woff2'],
};
const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.bmp': 'image/bmp',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.aac': 'audio/aac', '.flac': 'audio/flac',
  '.json': 'application/json', '.csv': 'text/csv', '.txt': 'text/plain',
  '.tmx': 'application/xml', '.tsx': 'application/xml', '.xml': 'application/xml',
  '.atlas': 'text/plain', '.fnt': 'application/xml',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

// Per-kind size caps. Audio is allowed to be much larger than a sprite; nothing may be
// so large that one file dominates the library.
const MAX_BYTES = { image: 4 * 1024 * 1024, audio: 20 * 1024 * 1024, data: 4 * 1024 * 1024, font: 4 * 1024 * 1024 };
const MAX_TOTAL = 1024 * 1024 * 1024;   // 1 GB library ceiling
// Icon packs ship one file per icon: a single free pack measured at 4,586 PNGs, and the
// first 13 packs at 13,584. The cap exists to stop a runaway import, not to size a library.
const MAX_FILES = 40000;

export function kindOf(name) {
  const e = extname(String(name)).toLowerCase();
  for (const [k, exts] of Object.entries(KINDS)) if (exts.includes(e)) return k;
  return null;
}

/**
 * Make an uploaded filename safe to put on disk and in a URL.
 *
 * Takes the basename only (so "../../server/index.js" cannot escape), then allows just
 * word characters, dot and dash. Runs of dots collapse to one so no combination can
 * reconstruct "..".
 */
export function safeName(name) {
  const b = basename(String(name || '')).trim();
  const cleaned = b.replace(/[^A-Za-z0-9._-]/g, '_').replace(/\.{2,}/g, '.').replace(/^[._-]+/, '');
  return cleaned.slice(0, 120) || 'asset';
}

function ensureDir() {
  if (!existsSync(ASSETS_DIR)) mkdirSync(ASSETS_DIR, { recursive: true });
}

// In-memory copy of the manifest, invalidated by the file's mtime.
//
// At 13k+ entries a fresh JSON.parse per call is not free, and the verifier calls
// resolve() once for EVERY asset request a game makes. The name index turns that lookup
// from a linear scan into a Map hit. `version` is computed lazily for the same reason -
// it sorts the whole library.
let cache = { mtimeMs: -1, items: [], byName: new Map(), bySha: new Map(), version: null };

function index(items) {
  const byName = new Map();
  const bySha = new Map();
  for (const it of items) { byName.set(it.name, it); bySha.set(it.sha256, it); }
  return { byName, bySha };
}

function load() {
  try {
    if (!existsSync(MANIFEST)) {
      if (cache.mtimeMs !== -1) cache = { mtimeMs: -1, items: [], byName: new Map(), bySha: new Map(), version: null };
      return { items: cache.items };
    }
    const m = statSync(MANIFEST).mtimeMs;
    if (m !== cache.mtimeMs) {
      // Was JSON.parse in a try/catch that returned { items: [] } - so one unreadable
      // manifest, followed by any add(), wiped the index for every asset on disk. The
      // files would still be there; nothing would know their names.
      const j = readJsonSafe(MANIFEST, {
        empty: { items: [] }, label: 'assets/manifest.json', onUnrecoverable: 'quarantine',
      });
      const items = Array.isArray(j.items) ? j.items : [];
      cache = { mtimeMs: m, items, ...index(items), version: null };
    }
    return { items: cache.items };
  } catch (e) {
    console.error('[assets] manifest load failed:', e.message);
    return { items: cache.items || [] };
  }
}

// Atomic: the manifest is what every other consumer trusts, so a torn write here would
// desync the gate from the verifier from the agent. The cache is refreshed from what was
// just written, so a bulk import of thousands of files does not re-parse a growing file
// on every add.
function save(state) {
  ensureDir();
  const tmp = MANIFEST + '.tmp';
  writeFileSync(tmp, JSON.stringify({ items: state.items, updatedAt: Date.now() }, null, 2), 'utf8');
  renameWithRetry(tmp, MANIFEST);
  let m = -1;
  try { m = statSync(MANIFEST).mtimeMs; } catch { /* next load() will re-read */ }
  cache = { mtimeMs: m, items: state.items, ...index(state.items), version: null };
}

/**
 * Write the manifest now. Only needed after add() calls made with `defer: true`.
 *
 * A bulk import of 13,851 files that saved after every add would rewrite a manifest
 * growing to ~5 MB each time - tens of gigabytes of disk writes for one import. Deferring
 * keeps the in-memory copy authoritative and writes once per pack instead.
 */
export function flush() {
  save({ items: load().items });
}

export function list() {
  return load().items;
}

/**
 * A hash of the whole library. The eval MUST be able to pin this: a Phaser score is only
 * comparable across runs if the assets the code loaded were the same bytes. Derived from
 * name+hash pairs, so re-uploading identical content does not change it.
 */
export function version() {
  const items = load().items;
  if (!items.length) return 'empty';
  if (cache.version) return cache.version;
  const h = createHash('sha256');
  // CODEPOINT order, not localeCompare. The Modal verifier hashes the same manifest with
  // Python's default sort; localeCompare is locale-aware and orders "_" and digits
  // differently, so the two sides produced different versions for identical libraries
  // (e63fc24a vs ff38639f on the same 13,051 files, 2026-09-09). Names are restricted to
  // [A-Za-z0-9._-] by safeName(), so a plain code-unit comparison is exact on both sides.
  const byCodepoint = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  for (const it of [...items].sort(byCodepoint)) h.update(`${it.name}:${it.sha256}\n`);
  cache.version = h.digest('hex').slice(0, 16);
  return cache.version;
}

export function totals() {
  const items = load().items;
  return {
    files: items.length,
    bytes: items.reduce((a, i) => a + (i.bytes || 0), 0),
    byKind: items.reduce((a, i) => { a[i.kind] = (a[i.kind] || 0) + 1; return a; }, {}),
    version: version(),
  };
}

/** PNG/GIF/JPEG dimensions from the header, so the UI and the agent know sprite sizes. */
function dimensions(buf, ext) {
  try {
    if (ext === '.png' && buf.length > 24 && buf.readUInt32BE(12) === 0x49484452) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (ext === '.gif' && buf.length > 10) {
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    }
    if ((ext === '.jpg' || ext === '.jpeg') && buf.length > 4) {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + len;
      }
    }
  } catch { /* a malformed header is not a reason to reject an upload */ }
  return {};
}

/**
 * Add one asset. `dataB64` is the raw file, base64-encoded (matching how the hub already
 * takes uploads). Returns { ok, item } or { ok:false, error }.
 */
export function add({ name, dataB64, defer = false, placeholder = false, role = '', replace = false }) {
  const kind = kindOf(name);
  if (!kind) {
    return { ok: false, error: `"${extname(String(name)) || name}" is not an allowed asset type. Allowed: ${Object.values(KINDS).flat().join(' ')}` };
  }
  let buf;
  try { buf = Buffer.from(String(dataB64 || ''), 'base64'); }
  catch { return { ok: false, error: 'could not decode dataB64' }; }
  if (!buf.length) return { ok: false, error: 'file is empty' };
  if (buf.length > MAX_BYTES[kind]) {
    return { ok: false, error: `${kind} is limited to ${Math.round(MAX_BYTES[kind] / 1048576)}MB (this is ${(buf.length / 1048576).toFixed(1)}MB)` };
  }

  const s = load();
  const t = totals();
  if (t.files >= MAX_FILES) return { ok: false, error: `the library is full (${MAX_FILES} files)` };
  if (t.bytes + buf.length > MAX_TOTAL) return { ok: false, error: 'the library would exceed its 1GB ceiling' };

  const sha256 = createHash('sha256').update(buf).digest('hex');

  // The REPLACE path is checked before content-dedupe, and the order matters.
  //
  // Putting dedupe first meant an intentional replace was silently swallowed whenever the
  // new bytes already existed somewhere: promoting the real coin icon into `coin.png`
  // matched the identical bytes under its pack name, returned that item as a "duplicate",
  // and left coin.png as a placeholder while reporting success. Measured 2026-09-09 -
  // every whole-file promotion (coin, heart, key, tileset, the spritesheets) failed this
  // way, and only the cropped frames worked because cropping produced new bytes.
  let final = safeName(name);
  const existing = cache.byName.get(final);
  if (existing && (replace || existing.placeholder)) {
    ensureDir();
    writeFileSync(join(ASSETS_DIR, existing.name), buf);
    cache.bySha.delete(existing.sha256);
    delete existing.width; delete existing.height;
    Object.assign(existing, {
      kind, bytes: buf.length, sha256,
      ...dimensions(buf, extname(existing.name).toLowerCase()),
      placeholder: !!placeholder,
      ...(role ? { role } : {}),
      replacedAt: Date.now(),
    });
    if (!placeholder && !role) delete existing.role;
    cache.bySha.set(sha256, existing);
    cache.version = null;
    if (!defer) save(s);
    return { ok: true, item: existing, replaced: true };
  }
  // Same bytes already here under some name: reuse it rather than storing a second copy.
  const dupe = cache.bySha.get(sha256);
  if (dupe) return { ok: true, item: dupe, duplicate: true };

  // Names are the addressing scheme, so a collision must not overwrite.
  if (existing) {
    const ext = extname(final);
    const stem = final.slice(0, final.length - ext.length);
    let n = 2;
    while (cache.byName.has(`${stem}-${n}${ext}`)) n++;
    final = `${stem}-${n}${ext}`;
  }

  ensureDir();
  writeFileSync(join(ASSETS_DIR, final), buf);

  const item = {
    id: sha256.slice(0, 12),
    name: final,
    path: PUBLIC_PREFIX + final,
    kind,
    bytes: buf.length,
    sha256,
    ...dimensions(buf, extname(final).toLowerCase()),
    // Generated stand-ins are marked so the UI can show them and a later upload of the
    // same name replaces them in place.
    ...(placeholder ? { placeholder: true } : {}),
    ...(role ? { role } : {}),
    addedAt: Date.now(),
  };
  s.items.push(item);
  // Keep the indexes truthful even when the write is deferred: the next add() in the same
  // batch must see this name and hash, or it could collide with or duplicate it.
  cache.byName.set(item.name, item);
  cache.bySha.set(item.sha256, item);
  cache.version = null;
  if (!defer) save(s);
  return { ok: true, item };
}

export function remove(id) {
  const s = load();
  const it = s.items.find((i) => i.id === id || i.name === id);
  if (!it) return { ok: false, error: 'no such asset' };
  s.items = s.items.filter((i) => i !== it);
  save(s);
  try { unlinkSync(join(ASSETS_DIR, it.name)); } catch { /* manifest is the record; a missing file is fine */ }
  return { ok: true, item: it };
}

/**
 * Resolve a path a piece of GAME CODE asked for into a real file.
 *
 * This is the function the verifiers call for every intercepted request, so it is the
 * security boundary as well as the lookup: it accepts only names that are in the
 * manifest. A path that merely looks plausible is refused, which is exactly what lets the
 * verifier tell a model "you asked for assets/hero.png, which does not exist" instead of
 * silently rendering a blank screen.
 */
export function resolve(reqPath) {
  let p = String(reqPath || '').trim();
  try { p = decodeURIComponent(p); } catch { /* use it raw */ }
  p = p.split(/[?#]/)[0].replace(/\\/g, '/');
  const i = p.toLowerCase().lastIndexOf(PUBLIC_PREFIX);
  if (i >= 0) p = p.slice(i + PUBLIC_PREFIX.length);
  const name = basename(p);
  if (!name) return null;
  load();
  const it = cache.byName.get(name);
  if (!it) return null;
  const full = join(ASSETS_DIR, it.name);
  if (!existsSync(full)) return null;
  return { ...it, full, mime: MIME[extname(it.name).toLowerCase()] || 'application/octet-stream' };
}

export function mimeFor(name) {
  return MIME[extname(String(name)).toLowerCase()] || 'application/octet-stream';
}

/**
 * Find assets by words in their name. `filter` "orc idle" matches names containing both.
 * A kind word (image/audio/font/data) narrows by kind. This is what the list_assets tool
 * calls, and it exists because the library is too large to put in context.
 */
export function search(filter = '', { limit = 60 } = {}) {
  const items = load().items;
  const words = String(filter || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
  const kinds = new Set(words.filter((w) => ['image', 'audio', 'font', 'data'].includes(w)));
  const needles = words.filter((w) => !kinds.has(w));
  // Matched against the name AND the label. Icon packs ship numbered files - Franuka's
  // are 1.png..385.png, Raven's fa1.png.. - so without labels the entire icon library is
  // unsearchable: "potion" matched nothing at all across 11,000 icons.
  const hay = (i) => `${i.name} ${i.label || ''}`.toLowerCase();
  const hits = items.filter((i) => (!kinds.size || kinds.has(i.kind))
    && needles.every((w) => hay(i).includes(w)));
  // A labelled asset is a deliberate, named thing; surface those first.
  hits.sort((a, b) => (!!b.label - !!a.label) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { total: hits.length, items: hits.slice(0, limit) };
}

/** Attach a human-readable label to an asset, so it can be found by what it IS. */
export function label(nameOrId, text) {
  const s = load();
  const it = s.items.find((i) => i.name === nameOrId || i.id === nameOrId);
  if (!it) return { ok: false, error: 'no such asset' };
  const v = String(text || '').trim().slice(0, 80);
  if (v) it.label = v; else delete it.label;
  return { ok: true, item: it };
}

/** The pack each asset came from, as far as its name says: the token before the first "_". */
export function families() {
  const count = new Map();
  for (const i of load().items) {
    const fam = i.name.split('_')[0].replace(/\.[^.]+$/, '');
    count.set(fam, (count.get(fam) || 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]);
}

/**
 * The SUMMARY injected before every model call.
 *
 * Deliberately not a listing. With 12,926 files a listing is not context, it is noise
 * that costs tokens on every step. So this says what exists and how to look it up, and
 * the list_assets tool returns exact paths on demand. The wording matters as much as the
 * data: the workspace listing already has to say "never invent one", because a small
 * model will happily reference a sprite that does not exist - and an invented asset name
 * is a 404 and a blank canvas.
 */
export function contextBlock({ maxFamilies = 18 } = {}) {
  const t = totals();
  if (!t.files) return null;
  const kinds = ['image', 'audio', 'font', 'data'].filter((k) => t.byKind[k])
    .map((k) => `${t.byKind[k]} ${k}`).join(', ');
  const fams = families().slice(0, maxFamilies).map(([f, n]) => `${f}(${n})`).join(' ');
  // The example must be a path that EXISTS. A model copies examples literally, and an
  // illustrative-but-fake path in the summary would teach it the one thing this whole
  // block exists to prevent.
  const example = load().items.find((i) => i.kind === 'image');
  const ex = example ? `this.load.image('${example.name.replace(/\.[^.]+$/, '').slice(0, 24)}', '${example.path}')` : "this.load.image('key', 'assets/<exact name>')";
  return `ASSET LIBRARY: ${t.files} files served at ${PUBLIC_PREFIX} - ${kinds}.\n`
    + `Packs (name prefix, count): ${fams}\n`
    + `Look up exact paths with ACTION: list_assets FILTER: <words> (e.g. "orc attack", "walk audio", "tileset").\n`
    + `Load with the EXACT path returned, e.g. ${ex}. `
    + `Never invent an asset filename - it will 404 and render nothing.`;
}

/** Every allowed extension, for the UI's file picker and error messages. */
export function allowedExtensions() {
  return { ...KINDS };
}

/** Rebuild the manifest from what is actually on disk. For hand-dropped files. */
export function reindex() {
  ensureDir();
  const s = load();
  const known = new Set(s.items.map((i) => i.name));
  let added = 0;
  let missing = 0;
  for (const f of readdirSync(ASSETS_DIR)) {
    if (f === 'manifest.json' || f === 'manifest.json.tmp') continue;
    if (known.has(f)) continue;
    const kind = kindOf(f);
    if (!kind) continue;
    let buf;
    try {
      const st = statSync(join(ASSETS_DIR, f));
      if (!st.isFile()) continue;
      buf = readFileSync(join(ASSETS_DIR, f));
    } catch { continue; }
    const sha256 = createHash('sha256').update(buf).digest('hex');
    s.items.push({
      id: sha256.slice(0, 12), name: f, path: PUBLIC_PREFIX + f, kind,
      bytes: buf.length, sha256, ...dimensions(buf, extname(f).toLowerCase()), addedAt: Date.now(),
    });
    added++;
  }
  // Drop manifest entries whose file has gone, so resolve() never promises a missing file.
  const before = s.items.length;
  s.items = s.items.filter((i) => existsSync(join(ASSETS_DIR, i.name)));
  missing = before - s.items.length;
  if (added || missing) save(s);
  return { added, missing, total: s.items.length };
}
