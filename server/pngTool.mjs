/**
 * pngTool.mjs - decode, crop and re-encode PNGs, with no dependencies.
 *
 *   node server/pngTool.mjs <in.png> <out.png> --frame 0 --grid 4x4
 *   node server/pngTool.mjs <in.png> <out.png> --crop x,y,w,h
 *   node server/pngTool.mjs <in.png> --info
 *
 * WHY
 * ---
 * Real art arrives as spritesheets - `2x_merchant_walk.png` is a 4x4 grid of 32x48 frames -
 * but half the canonical vocabulary is single images (`player.png`, `enemy.png`). Without a
 * decoder those slots can only ever hold generated placeholders while the real art sits
 * one crop away. puppeteer could rasterise, but spinning a browser to cut a 32x48 rectangle
 * is absurd; PNG decoding is a couple of hundred lines and zlib is already in node.
 *
 * Supports bit depth 8, colour types 0/2/3/4/6 (grey, RGB, palette, grey+alpha, RGBA),
 * non-interlaced - which is every file in the packs measured here. Anything else throws
 * rather than silently producing garbage.
 */
import { inflateSync, deflateSync } from 'zlib';
import { readFileSync, writeFileSync } from 'fs';

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Decode a PNG buffer to { w, h, px } with px as RGBA bytes. */
export function decode(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  let w = 0, h = 0, depth = 0, colour = 0, interlace = 0;
  let palette = null, trns = null;
  const idat = [];

  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; colour = data[9]; interlace = data[12];
    } else if (type === 'PLTE') palette = Buffer.from(data);
    else if (type === 'tRNS') trns = Buffer.from(data);
    else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8) throw new Error(`unsupported bit depth ${depth} (only 8)`);
  if (interlace) throw new Error('interlaced PNG not supported');
  const ch = CHANNELS[colour];
  if (!ch) throw new Error(`unsupported colour type ${colour}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(w * h * 4);
  const prev = Buffer.alloc(stride);
  const line = Buffer.alloc(stride);

  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    raw.copy(line, 0, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      else if (filter !== 0) throw new Error(`bad filter ${filter} on row ${y}`);
      line[i] = v & 0xff;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (colour === 6) { line.copy(out, o, x * 4, x * 4 + 4); }
      else if (colour === 2) { out[o] = line[x * 3]; out[o + 1] = line[x * 3 + 1]; out[o + 2] = line[x * 3 + 2]; out[o + 3] = 255; }
      else if (colour === 0) { const g = line[x]; out[o] = g; out[o + 1] = g; out[o + 2] = g; out[o + 3] = 255; }
      else if (colour === 4) { const g = line[x * 2]; out[o] = g; out[o + 1] = g; out[o + 2] = g; out[o + 3] = line[x * 2 + 1]; }
      else if (colour === 3) {
        const idx = line[x];
        out[o] = palette[idx * 3]; out[o + 1] = palette[idx * 3 + 1]; out[o + 2] = palette[idx * 3 + 2];
        out[o + 3] = trns && idx < trns.length ? trns[idx] : 255;
      }
    }
    line.copy(prev);
  }
  return { w, h, px: out };
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Encode { w, h, px } (RGBA) back to a PNG buffer. */
export function encode({ w, h, px }) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

export function crop(img, x, y, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let j = 0; j < h; j++) {
    const sy = y + j;
    if (sy < 0 || sy >= img.h) continue;
    for (let i = 0; i < w; i++) {
      const sx = x + i;
      if (sx < 0 || sx >= img.w) continue;
      img.px.copy(out, (j * w + i) * 4, (sy * img.w + sx) * 4, (sy * img.w + sx) * 4 + 4);
    }
  }
  return { w, h, px: out };
}

/** Nearest-neighbour scale. Pixel art must never be smoothed. */
export function scale(img, factor) {
  const w = Math.max(1, Math.round(img.w * factor));
  const h = Math.max(1, Math.round(img.h * factor));
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(img.h - 1, Math.floor(y / factor));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.w - 1, Math.floor(x / factor));
      img.px.copy(out, (y * w + x) * 4, (sy * img.w + sx) * 4, (sy * img.w + sx) * 4 + 4);
    }
  }
  return { w, h, px: out };
}

/** How much of the image is non-transparent - used to pick a frame that is not empty. */
export function coverage(img) {
  let n = 0;
  for (let i = 3; i < img.px.length; i += 4) if (img.px[i] > 8) n++;
  return n / (img.w * img.h);
}

/**
 * Work out the frame size of a spritesheet.
 *
 * A frame size is TOO SMALL when the sprite is clipped - its bounding box runs flush to
 * the frame edge. Measured 2026-09-09: the golem sheet cropped at 64px put the sprite hard
 * against the right and bottom edges (visibly a sliced-off golem), while at 128px it sat
 * clear of every edge. Coverage cannot tell these apart - it is scale-invariant, 9% either
 * way - so the edge test is the signal, and it needs no per-pack knowledge.
 *
 * Returns { frame, cols, rows } or null when nothing fits (e.g. non-square frames).
 */
export function detectFrame(img, candidates = [32, 48, 64, 96, 128, 192, 256]) {
  for (const f of candidates) {
    if (img.w % f || img.h % f) continue;
    const c = crop(img, 0, 0, f, f);
    const bb = bbox(c);
    if (!bb) continue;
    const clipped = bb.x === 0 || bb.y === 0 || bb.x + bb.w >= f || bb.y + bb.h >= f;
    if (!clipped) return { frame: f, cols: img.w / f, rows: img.h / f };
  }
  return null;
}

/** Tight bounding box of non-transparent pixels, or null when fully transparent. */
export function bbox(img, alphaMin = 8) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (img.px[(y * img.w + x) * 4 + 3] > alphaMin) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// ── CLI ─────────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('pngTool.mjs');
if (isMain) {
  const args = process.argv.slice(2);
  const flag = (n, d) => { const i = args.indexOf('--' + n); return i > -1 && args[i + 1] ? args[i + 1] : d; };
  const files = args.filter((a) => !a.startsWith('--') && /\.png$/i.test(a));
  const src = files[0];
  if (!src) { console.error('usage: node server/pngTool.mjs <in.png> [out.png] [--info] [--frame N --grid CxR] [--crop x,y,w,h]'); process.exit(1); }
  const img = decode(readFileSync(src));

  if (args.includes('--info') || files.length < 2) {
    const bb = bbox(img);
    console.log(`${src}\n  ${img.w}x${img.h}  coverage ${(coverage(img) * 100).toFixed(1)}%  content bbox ${bb ? `${bb.x},${bb.y} ${bb.w}x${bb.h}` : 'empty'}`);
    process.exit(0);
  }

  let out;
  const cropArg = flag('crop', null);
  if (cropArg) {
    const [x, y, w, h] = cropArg.split(',').map(Number);
    out = crop(img, x, y, w, h);
  } else {
    const [cols, rows] = String(flag('grid', '1x1')).split('x').map(Number);
    const n = Number(flag('frame', 0));
    const fw = Math.floor(img.w / cols), fh = Math.floor(img.h / rows);
    out = crop(img, (n % cols) * fw, Math.floor(n / cols) * fh, fw, fh);
  }
  const f = Number(flag('scale', 1));
  if (f !== 1) out = scale(out, f);
  writeFileSync(files[1], encode(out));
  console.log(`${files[1]}  ${out.w}x${out.h}  coverage ${(coverage(out) * 100).toFixed(1)}%`);
}
