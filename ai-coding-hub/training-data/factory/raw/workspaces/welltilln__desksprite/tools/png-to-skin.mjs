#!/usr/bin/env node
// png-to-skin.mjs — authoring converter: draw a sprite pose as a small PNG,
// convert it into a desksprite skin JSON. Zero npm deps (Node built-ins only).
//
// The walking desk-pet character is called a "sprite". This tool turns ONE PNG
// (one pose) into a complete, immediately-loadable skin. Because a skin has
// several poses (idle / held / walk frames), the artist runs this once per pose
// PNG and assembles the frames BY HAND (paste each --frame-only rows array into
// the right slot of one skin JSON).
//
// See --help for the full workflow.

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { basename, extname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ── PNG decoder (inlined, zero-dep) ───────────────────────────────────────────
// Supports: non-interlaced, 8-bit depth, colour type 6 (RGBA) and 2 (RGB).
// Rejects (clear error): interlaced (Adam7), bit depth != 8, palette-indexed
// (type 3), grayscale (types 0/4). Concatenates multiple IDAT chunks.

const PNG_SIG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

/**
 * Paeth predictor (PNG filter type 4). a=left, b=up, c=upper-left.
 * @param {number} a @param {number} b @param {number} c @returns {number}
 */
function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Decode an 8-bit non-interlaced RGB/RGBA PNG buffer to raw pixels.
 * @param {Buffer} buf raw PNG file bytes
 * @returns {{width:number, height:number, channels:number, pixels:Buffer}}
 */
function decodePng(buf) {
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== PNG_SIG[i]) throw new Error('Not a PNG file (bad signature). Expected an 8-bit RGB/RGBA PNG.');
  }
  let pos = 8;
  let ihdr = null;
  const idatParts = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const dataStart = pos + 8;
    const data = buf.subarray(dataStart, dataStart + len);
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === 'IDAT') {
      idatParts.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
    pos = dataStart + len + 4; // skip data + 4-byte CRC
  }
  if (!ihdr) throw new Error('Invalid PNG: no IHDR chunk found.');

  // ── Reject unsupported variants with clear messages ──
  if (ihdr.interlace !== 0) {
    throw new Error('Unsupported PNG: interlaced (Adam7) images are not supported. Re-export without interlacing.');
  }
  if (ihdr.bitDepth !== 8) {
    throw new Error(`Unsupported PNG: bit depth ${ihdr.bitDepth} — only 8-bit depth is supported. Re-export as 8-bit.`);
  }
  if (ihdr.colorType === 3) {
    throw new Error('Unsupported PNG: palette-indexed (colour type 3) is not supported. Re-export as RGB or RGBA (truecolour).');
  }
  if (ihdr.colorType === 0 || ihdr.colorType === 4) {
    throw new Error('Unsupported PNG: grayscale (colour type ' + ihdr.colorType + ') is not supported. Re-export as RGB or RGBA (truecolour).');
  }
  if (ihdr.colorType !== 2 && ihdr.colorType !== 6) {
    throw new Error('Unsupported PNG: colour type ' + ihdr.colorType + ' is not supported. Only RGB (2) and RGBA (6) are supported.');
  }
  if (idatParts.length === 0) throw new Error('Invalid PNG: no IDAT (image data) chunks found.');

  const channels = ihdr.colorType === 6 ? 4 : 3;
  const { width, height } = ihdr;
  const bpp = channels; // bytes per pixel (8-bit depth)
  const stride = width * bpp;

  // Inflate the concatenated IDAT stream → filtered scanlines.
  const raw = inflateSync(Buffer.concat(idatParts));
  const expected = height * (stride + 1);
  if (raw.length < expected) {
    throw new Error(`Invalid PNG: decompressed data too short (${raw.length} < ${expected}).`);
  }

  // ── Unfilter all 5 scanline filter types ──
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filterType = raw[y * (stride + 1)];
    const rowStart = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const rawVal = raw[rowStart + x];
      const left = x >= bpp ? out[y * stride + x - bpp] : 0;
      const up = y > 0 ? out[(y - 1) * stride + x] : 0;
      const upperLeft = (x >= bpp && y > 0) ? out[(y - 1) * stride + x - bpp] : 0;
      let recon;
      if (filterType === 0) {           // None
        recon = rawVal;
      } else if (filterType === 1) {    // Sub
        recon = rawVal + left;
      } else if (filterType === 2) {    // Up
        recon = rawVal + up;
      } else if (filterType === 3) {    // Average (floor of (left+up)/2)
        recon = rawVal + ((left + up) >> 1);
      } else if (filterType === 4) {    // Paeth
        recon = rawVal + paethPredictor(left, up, upperLeft);
      } else {
        throw new Error(`Invalid PNG: unknown scanline filter type ${filterType} on row ${y}.`);
      }
      out[y * stride + x] = recon & 0xFF;
    }
  }
  return { width, height, channels, pixels: out };
}

// ── Pixel grid → skin frame rows + palette ─────────────────────────────────────
// Fixed readable palette-char sequence (excludes '.' and space, which are the
// transparent marker). Letters then digits.
const PALETTE_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ALPHA_THRESHOLD = 128; // alpha < 128 → transparent

/**
 * Convert decoded pixels to skin frame rows + a palette (char → "#RRGGBB"|null).
 * @param {{width:number,height:number,channels:number,pixels:Buffer}} img
 * @returns {{rows:string[], palette:Record<string,string|null>}}
 */
function pixelsToFrame(img) {
  const { width, height, channels, pixels } = img;
  const colorToChar = new Map(); // "#RRGGBB" → char
  const palette = { '.': null };
  let nextCharIdx = 0;
  const rows = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = channels === 4 ? pixels[i + 3] : 255;
      if (a < ALPHA_THRESHOLD) {
        row += '.';
        continue;
      }
      const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
      let ch = colorToChar.get(hex);
      if (ch === undefined) {
        if (nextCharIdx >= PALETTE_CHARS.length) {
          throw new Error(
            `Too many distinct colours: image has more than ${PALETTE_CHARS.length} opaque colours, ` +
            `which exceeds the palette-char sequence. Reduce the sprite to <= ${PALETTE_CHARS.length} colours.`,
          );
        }
        ch = PALETTE_CHARS[nextCharIdx++];
        colorToChar.set(hex, ch);
        palette[ch] = hex;
      }
      row += ch;
    }
    rows.push(row);
  }
  return { rows, palette };
}

// ── CLI ────────────────────────────────────────────────────────────────────────
const HELP = `png-to-skin — convert a sprite pose PNG into a desksprite skin JSON

USAGE
  node tools/png-to-skin.mjs <input.png> [--name NAME] [--frame-only]

WHAT IT DOES
  Reads one PNG (one pose of the sprite) and prints, to stdout, a COMPLETE valid
  skin JSON: the decoded image becomes the single frame used for idle, held, and
  walk[0], so the output loads immediately and passes validateSkin as-is.
    size   = the image's pixel dimensions (w x h)
    anchor = { x: floor(w/2), y: h }   (bottom-centre)
    name   = --name NAME, else the input filename without its extension
  Each distinct opaque colour is auto-assigned a palette character; "." marks a
  transparent pixel.

OPTIONS
  --name NAME     Set the skin's "name" (default: input filename without extension).
  --frame-only    Print ONLY the frame's rows as a JSON string array (for pasting
                  one pose into an existing skin), instead of a full skin object.
  -h, --help      Show this help.

PNG SUPPORT
  Supported: non-interlaced, 8-bit depth, colour type 2 (RGB) or 6 (RGBA).
  Rejected (with a clear error): interlaced (Adam7), bit depth != 8,
  palette-indexed (type 3), grayscale (types 0/4).
  Transparency: alpha < 128 -> transparent ("."); alpha >= 128 -> opaque
  (colour = #RRGGBB). Partial alpha is treated as binary (pixel art is binary-alpha).

ASSEMBLE-FRAMES-BY-HAND WORKFLOW
  A skin has several poses. Run this once per pose PNG and assemble by hand:
    1. node tools/png-to-skin.mjs idle.png --name mypet > mypet.json
    2. node tools/png-to-skin.mjs walk-a.png --frame-only   # copy the array
    3. node tools/png-to-skin.mjs walk-b.png --frame-only   # copy the array
    4. Edit mypet.json: paste the walk poses into frames.walk (an array of
       frames), set frames.held to the held pose, etc. Merge palettes if the
       poses use different colours (re-run without --frame-only to see a palette).
`;

/**
 * Parse argv into options.
 * @param {string[]} argv @returns {{input?:string, name?:string, frameOnly:boolean, help:boolean}}
 */
function parseArgs(argv) {
  const opts = { input: undefined, name: undefined, frameOnly: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg === '--frame-only') opts.frameOnly = true;
    else if (arg === '--name') { opts.name = argv[++i]; }
    else if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
    else if (opts.input === undefined) opts.input = arg;
    else throw new Error(`Unexpected extra argument: ${arg}`);
  }
  return opts;
}

/**
 * Build the complete skin object from a decoded frame.
 * @param {string} name @param {string[]} rows @param {Record<string,string|null>} palette
 * @param {number} w @param {number} h @returns {object}
 */
function buildSkin(name, rows, palette, w, h) {
  return {
    name,
    palette,
    size: { w, h },
    anchor: { x: Math.floor(w / 2), y: h },
    frames: {
      idle: rows,
      held: rows,
      walk: [rows],
    },
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || opts.input === undefined) {
    // Help goes to stdout on explicit --help; to stderr when args are missing.
    if (opts.help) { process.stdout.write(HELP); return; }
    process.stderr.write(HELP);
    process.exit(2);
  }

  const buf = readFileSync(opts.input);
  const img = decodePng(buf);
  const { rows, palette } = pixelsToFrame(img);

  if (opts.frameOnly) {
    process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
    return;
  }

  const name = opts.name || basename(opts.input, extname(opts.input));
  const skin = buildSkin(name, rows, palette, img.width, img.height);

  // Validate our own output against the engine's validateSkin before printing,
  // so a malformed emit is caught here rather than downstream.
  const require = createRequire(import.meta.url);
  const here = dirname(fileURLToPath(import.meta.url));
  const { validateSkin } = require(join(here, '..', 'desksprite.js'));
  const v = validateSkin(skin);
  if (!v.ok) {
    throw new Error('Internal error: generated skin failed validateSkin: ' + v.errors.join(', '));
  }
  process.stdout.write(JSON.stringify(skin, null, 2) + '\n');
}

try {
  main();
} catch (err) {
  process.stderr.write('Error: ' + (err && err.message ? err.message : String(err)) + '\n');
  process.exit(1);
}
