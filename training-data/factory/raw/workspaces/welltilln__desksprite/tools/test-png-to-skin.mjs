// Node zero-dep test for the PNG->skin authoring converter.
// Run: node tools/test-png-to-skin.mjs
//
// Strategy: hand-build tiny PNGs in-memory (zlib.deflateSync + CRC32'd chunks),
// exercising ALL FIVE scanline filter types across rows of a multi-colour RGBA
// image (plus a transparent pixel), and one RGB image. Then run the converter
// (child_process) and assert the decoded frame rows/palette are EXACTLY the
// expected pixels and that the full output passes validateSkin.

import { deflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { validateSkin } = require('../desksprite.js');
const HERE = dirname(fileURLToPath(import.meta.url));
const CONVERTER = join(HERE, 'png-to-skin.mjs');

// ── CRC32 (PNG polynomial 0xEDB88320) ─────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── PNG chunk + file builders ─────────────────────────────────────────────────
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
const SIG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

// colorType: 6 = RGBA (bpp 4), 2 = RGB (bpp 3).
// `filters` is a per-row filter-type byte (0..4). `pixels` is a Buffer of the
// UNFILTERED raw scanline bytes (h rows * w * bpp). We APPLY the requested
// filter here so the decoder must UN-filter to recover `pixels`.
function buildPng(w, h, colorType, pixels, filters) {
  const bpp = colorType === 6 ? 4 : 3;
  const stride = w * bpp;
  // Build the filtered raw stream (each row prefixed by its filter-type byte).
  const raw = Buffer.alloc(h * (stride + 1));
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  };
  for (let y = 0; y < h; y++) {
    const ft = filters[y];
    raw[y * (stride + 1)] = ft;
    for (let x = 0; x < stride; x++) {
      const cur = pixels[y * stride + x];
      const left = x >= bpp ? pixels[y * stride + x - bpp] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const ul = (x >= bpp && y > 0) ? pixels[(y - 1) * stride + x - bpp] : 0;
      let val;
      if (ft === 0) val = cur;
      else if (ft === 1) val = cur - left;
      else if (ft === 2) val = cur - up;
      else if (ft === 3) val = cur - ((left + up) >> 1);
      else if (ft === 4) val = cur - paeth(left, up, ul);
      else throw new Error('bad filter ' + ft);
      raw[y * (stride + 1) + 1 + x] = val & 0xFF;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;           // bit depth
  ihdr[9] = colorType;   // color type
  ihdr[10] = 0;          // compression
  ihdr[11] = 0;          // filter method
  ihdr[12] = 0;          // interlace (0 = none)
  const idat = deflateSync(raw);
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Build a PNG with the IDAT split into two chunks (multi-IDAT concatenation).
function buildPngMultiIdat(w, h, colorType, pixels, filters) {
  const single = buildPng(w, h, colorType, pixels, filters);
  // Re-extract the compressed IDAT payload and re-emit it as two chunks.
  // Easier: rebuild from scratch, splitting the deflate stream in half.
  const bpp = colorType === 6 ? 4 : 3;
  const stride = w * bpp;
  const raw = Buffer.alloc(h * (stride + 1));
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  };
  for (let y = 0; y < h; y++) {
    const ft = filters[y];
    raw[y * (stride + 1)] = ft;
    for (let x = 0; x < stride; x++) {
      const cur = pixels[y * stride + x];
      const left = x >= bpp ? pixels[y * stride + x - bpp] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const ul = (x >= bpp && y > 0) ? pixels[(y - 1) * stride + x - bpp] : 0;
      let val;
      if (ft === 0) val = cur;
      else if (ft === 1) val = cur - left;
      else if (ft === 2) val = cur - up;
      else if (ft === 3) val = cur - ((left + up) >> 1);
      else val = cur - paeth(left, up, ul);
      raw[y * (stride + 1) + 1 + x] = val & 0xFF;
    }
  }
  const comp = deflateSync(raw);
  const mid = Math.floor(comp.length / 2);
  const part1 = comp.subarray(0, mid);
  const part2 = comp.subarray(mid);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = colorType; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  void single;
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', part1),
    chunk('IDAT', part2),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function run(pngBuf, extraArgs = []) {
  const dir = mkdtempSync(join(tmpdir(), 'png2skin-'));
  const path = join(dir, 'testpose.png');
  writeFileSync(path, pngBuf);
  try {
    const out = execFileSync('node', [CONVERTER, path, ...extraArgs], { encoding: 'utf8' });
    return { out, dir, path };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function assert(cond, msg) { if (!cond) throw new Error('ASSERT FAIL: ' + msg); }

// ── Test 1: RGBA, 3 rows, ALL FIVE filter types, distinct colours + transparent ─
// Design a 3x3 RGBA image. We need >=5 rows to hit all 5 filters, so use 5 rows
// of a 3-wide image. Colours: red, green, blue, plus a transparent pixel.
{
  const w = 3, h = 5, bpp = 4;
  const RED = [255, 0, 0, 255];
  const GRN = [0, 255, 0, 255];
  const BLU = [0, 0, 255, 255];
  const CLR = [12, 34, 56, 0];    // alpha 0 -> transparent (colour ignored)
  const FAINT = [200, 100, 50, 100]; // alpha 100 (<128) -> transparent
  // rows (each 3 pixels):
  const grid = [
    [RED, GRN, BLU],
    [GRN, BLU, RED],
    [BLU, RED, GRN],
    [CLR, RED, FAINT],
    [RED, GRN, BLU],
  ];
  const pixels = Buffer.alloc(w * h * bpp);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let k = 0; k < 4; k++)
        pixels[(y * w + x) * bpp + k] = grid[y][x][k];
  const filters = [0, 1, 2, 3, 4]; // None, Sub, Up, Average, Paeth
  const png = buildPng(w, h, 6, pixels, filters);
  const { out } = run(png, ['--name', 'mypose']);
  const skin = JSON.parse(out);

  assert(skin.name === 'mypose', 'name from --name');
  assert(skin.size.w === 3 && skin.size.h === 5, 'size 3x5, got ' + JSON.stringify(skin.size));
  assert(skin.anchor.x === 1 && skin.anchor.y === 5, 'anchor {1,5}, got ' + JSON.stringify(skin.anchor));

  // Resolve each expected pixel to its palette char via the emitted palette.
  const colorToChar = {};
  for (const [ch, hex] of Object.entries(skin.palette)) {
    if (hex === null) continue;
    colorToChar[hex.toUpperCase()] = ch;
  }
  const hexOf = (rgba) => rgba[3] < 128 ? '.'
    : '#' + rgba.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const expectRows = grid.map(row => row.map(px => {
    const h = hexOf(px);
    return h === '.' ? '.' : colorToChar[h];
  }).join(''));

  const idle = skin.frames.idle;
  assert(JSON.stringify(idle) === JSON.stringify(expectRows),
    'idle rows mismatch\n got: ' + JSON.stringify(idle) + '\n exp: ' + JSON.stringify(expectRows));
  // idle === held === walk[0]
  assert(JSON.stringify(skin.frames.held) === JSON.stringify(expectRows), 'held == frame');
  assert(skin.frames.walk.length === 1 && JSON.stringify(skin.frames.walk[0]) === JSON.stringify(expectRows), 'walk[0] == frame');
  // palette maps '.' -> null and has exactly 3 colours (red/green/blue)
  assert(skin.palette['.'] === null, 'palette . -> null');
  const nColors = Object.values(skin.palette).filter(v => v !== null).length;
  assert(nColors === 3, 'expected 3 distinct colours, got ' + nColors);
  // validateSkin passes
  const v = validateSkin(skin);
  assert(v.ok, 'validateSkin failed: ' + v.errors.join(','));
  console.log('Test 1 (RGBA all-5-filters) OK');
}

// ── Test 2: multi-IDAT RGB image (no alpha channel) ────────────────────────────
{
  const w = 2, h = 2, bpp = 3;
  const grid = [
    [[255, 255, 255], [0, 0, 0]],
    [[0, 0, 0], [255, 255, 255]],
  ];
  const pixels = Buffer.alloc(w * h * bpp);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let k = 0; k < 3; k++)
        pixels[(y * w + x) * bpp + k] = grid[y][x][k];
  const filters = [0, 1];
  const png = buildPngMultiIdat(w, h, 2, pixels, filters);
  const { out } = run(png);   // no --name -> name from filename basename
  const skin = JSON.parse(out);
  assert(skin.name === 'testpose', 'name from filename, got ' + skin.name);
  assert(skin.size.w === 2 && skin.size.h === 2, 'RGB size');
  // RGB has no alpha -> every pixel opaque; 2 colours (white/black)
  const nColors = Object.values(skin.palette).filter(v => v !== null).length;
  assert(nColors === 2, 'RGB expected 2 colours, got ' + nColors);
  const colorToChar = {};
  for (const [ch, hex] of Object.entries(skin.palette)) if (hex) colorToChar[hex.toUpperCase()] = ch;
  const W = colorToChar['#FFFFFF'], B = colorToChar['#000000'];
  assert(W && B, 'white & black chars present');
  const expect = [W + B, B + W];
  assert(JSON.stringify(skin.frames.idle) === JSON.stringify(expect),
    'RGB rows mismatch: ' + JSON.stringify(skin.frames.idle) + ' exp ' + JSON.stringify(expect));
  assert(validateSkin(skin).ok, 'RGB validateSkin');
  console.log('Test 2 (RGB multi-IDAT) OK');
}

// ── Test 3: --frame-only prints just the rows array ────────────────────────────
{
  const w = 2, h = 1, bpp = 4;
  const pixels = Buffer.from([255, 0, 0, 255, 0, 0, 0, 0]); // red, transparent
  const png = buildPng(w, h, 6, pixels, [0]);
  const { out } = run(png, ['--frame-only']);
  const rows = JSON.parse(out);
  assert(Array.isArray(rows), 'frame-only -> array');
  assert(rows.length === 1 && rows[0].length === 2, 'frame-only shape');
  assert(rows[0][1] === '.', 'transparent pixel is .');
  assert(rows[0][0] !== '.', 'opaque pixel is not .');
  console.log('Test 3 (--frame-only) OK');
}

// ── Test 4: rejection paths (clear error messages) ─────────────────────────────
function expectFail(pngBuf, needle, label) {
  const dir = mkdtempSync(join(tmpdir(), 'png2skin-'));
  const path = join(dir, 'bad.png');
  writeFileSync(path, pngBuf);
  try {
    execFileSync('node', [CONVERTER, path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    throw new Error(label + ': expected failure but converter succeeded');
  } catch (e) {
    const msg = (e.stderr || '') + (e.stdout || '') + (e.message || '');
    assert(msg.toLowerCase().includes(needle.toLowerCase()),
      label + ': error message missing "' + needle + '"; got: ' + msg.slice(0, 300));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
function pngWith(ihdrMutate) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  ihdrMutate(ihdr);
  const idat = deflateSync(Buffer.alloc(2 * (2 * 4 + 1)));
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
expectFail(pngWith(h => { h[12] = 1; }), 'interlac', 'interlaced');
expectFail(pngWith(h => { h[8] = 16; }), 'bit depth', 'bit-depth-16');
expectFail(pngWith(h => { h[9] = 3; }), 'palette', 'palette-indexed');
expectFail(pngWith(h => { h[9] = 0; }), 'grayscale', 'grayscale');
expectFail(Buffer.from('not a png at all'), 'png', 'bad-signature');
console.log('Test 4 (rejections) OK');

// ── Test 5: palette exhaustion (too many distinct colours) ─────────────────────
{
  // 1 row of many distinct opaque colours -> exceed the palette sequence.
  // Build a wide image; each pixel a unique colour.
  const w = 200, h = 1, bpp = 4;
  const pixels = Buffer.alloc(w * h * bpp);
  for (let x = 0; x < w; x++) {
    pixels[x * 4 + 0] = x;         // r varies
    pixels[x * 4 + 1] = 255 - x;   // g varies
    pixels[x * 4 + 2] = (x * 7) & 0xFF;
    pixels[x * 4 + 3] = 255;
  }
  const png = buildPng(w, h, 6, pixels, [0]);
  expectFail(png, 'distinct colour', 'palette-exhaustion');
  console.log('Test 5 (palette exhaustion) OK');
}

console.log('\nALL PNG->SKIN TESTS PASSED');
