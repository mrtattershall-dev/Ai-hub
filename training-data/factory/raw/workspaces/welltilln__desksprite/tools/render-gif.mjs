#!/usr/bin/env node
// render-gif.mjs — the README demo GIF, drawn straight from the skin data.
// No screen recorder, no headless browser, no npm deps — we composite the
// sprites' own walk frames onto a clean white strip and hand-roll a GIF89a
// (LZW and all). Two sprites stroll past each other; it loops forever.
//
// The little walking character is a "sprite". Everything here is Node built-ins.

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const { frameToGrid, resolveSkin } = require(join(here, '..', 'desksprite.js'));

// ── Scene constants (locked by the design decisions) ────────────────────────
const WIDTH = 560, HEIGHT = 120;   // logical canvas
const CELL = 4;                    // each grid cell → 4×4 px
const GROUND_Y = 116;              // sprites' feet sit here
const FRAMES = 48;                 // total animation frames
const DELAY_CS = 6;                // per-frame delay in centiseconds
const BLUE_SPEED = 6;              // blue-boy: left → right, px/frame
const CAT_SPEED = 8;               // cat: right → left, px/frame (a brisk 1.35× nod)
const WALK_TICKS = 2;              // swap walk frame every 2 ticks

// ── Palette builder ─────────────────────────────────────────────────────────
// Index 0 is always pure white (the background). After that, every distinct
// sprite colour gets its own index. The GIF global colour table wants entries
// as [r,g,b]; #fff-style shorthand and #rrggbb both appear in the skins.
function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Collect a global palette: white first, then each unique sprite colour.
 * @param {Array<Array<Array<string|null>>>} grids resolved colour grids
 * @returns {{indexOf: Map<string, number>, table: number[][]}}
 */
function buildPalette(grids) {
  const indexOf = new Map();
  const table = [[255, 255, 255]];   // index 0 = white background
  indexOf.set('#ffffff', 0);
  for (const grid of grids) {
    for (const row of grid) {
      for (const cell of row) {
        if (!cell) continue;
        const key = cell.toLowerCase();
        if (indexOf.has(key)) continue;
        indexOf.set(key, table.length);
        table.push(hexToRgb(cell));
      }
    }
  }
  return { indexOf, table };
}

// ── Sprite compositing ───────────────────────────────────────────────────────
/**
 * Stamp a colour grid onto the indexed bitmap at (ox, oy), ×CELL scaled.
 * `flip` mirrors columns so a leftward walker faces the way it moves.
 * Cells off-canvas are simply skipped, so a sprite can walk off either edge.
 * @param {Uint8Array} bmp @param {Array<Array<string|null>>} grid
 * @param {number} ox @param {number} oy @param {Map<string,number>} indexOf
 * @param {boolean} flip @returns {void}
 */
function stamp(bmp, grid, ox, oy, indexOf, flip) {
  const gh = grid.length, gw = grid[0].length;
  for (let gy = 0; gy < gh; gy++) {
    const row = grid[gy];
    for (let gx = 0; gx < gw; gx++) {
      const srcX = flip ? gw - 1 - gx : gx;
      const cell = row[srcX];
      if (!cell) continue;                        // transparent — leave the white through
      const idx = indexOf.get(cell.toLowerCase());
      const px0 = ox + gx * CELL, py0 = oy + gy * CELL;
      for (let dy = 0; dy < CELL; dy++) {
        const py = py0 + dy;
        if (py < 0 || py >= HEIGHT) continue;
        const rowBase = py * WIDTH;
        for (let dx = 0; dx < CELL; dx++) {
          const px = px0 + dx;
          if (px < 0 || px >= WIDTH) continue;
          bmp[rowBase + px] = idx;
        }
      }
    }
  }
}

// ── LZW compression (the GIF variant) ────────────────────────────────────────
// Classic pitfalls, each handled below:
//   • emit CLEAR first, EOI last
//   • minimum code size = max(2, ceil(log2(paletteSize)))
//   • grow the code width AFTER the dict size crosses (1 << width)
//   • cap the dict at 4096, then emit CLEAR and reset the dict + width
//   • pack codes LSB-first, split into ≤255-byte sub-blocks
/**
 * @param {Uint8Array} indices palette indices, row-major, WIDTH*HEIGHT long
 * @param {number} minCodeSize LZW minimum code size (≥2)
 * @returns {number[]} the packed sub-block stream (lengths + data + 0x00)
 */
function lzwEncode(indices, minCodeSize) {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;

  // Bit packer → 255-byte sub-blocks, LSB-first.
  const out = [];
  let block = [];
  const flushBlock = () => {
    if (block.length === 0) return;
    out.push(block.length, ...block);
    block = [];
  };
  let bitBuf = 0, bitCnt = 0;
  const writeCode = (code, width) => {
    bitBuf |= code << bitCnt;
    bitCnt += width;
    while (bitCnt >= 8) {
      block.push(bitBuf & 0xff);
      bitBuf >>= 8; bitCnt -= 8;
      if (block.length === 255) flushBlock();
    }
  };

  let dict = new Map();
  let nextCode, codeSize;
  const resetDict = () => {
    dict = new Map();
    for (let i = 0; i < clear; i++) dict.set(String(i), i);
    nextCode = clear + 2;               // reserve CLEAR and EOI
    codeSize = minCodeSize + 1;
  };
  resetDict();

  writeCode(clear, codeSize);           // CLEAR first

  let prefix = String(indices[0]);
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const combined = prefix + ',' + k;
    if (dict.has(combined)) {
      prefix = combined;
    } else {
      writeCode(dict.get(prefix), codeSize);
      if (nextCode < 4096) {
        dict.set(combined, nextCode);
        // grow width AFTER the dict size crosses the current ceiling
        if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++;
        nextCode++;
      } else {
        // dict full → CLEAR and start fresh (width resets too)
        writeCode(clear, codeSize);
        resetDict();
      }
      prefix = String(k);
    }
  }
  writeCode(dict.get(prefix), codeSize);   // last prefix
  writeCode(eoi, codeSize);                // EOI last
  if (bitCnt > 0) block.push(bitBuf & 0xff);
  flushBlock();
  out.push(0x00);                          // block terminator
  return out;
}

// ── GIF89a container ─────────────────────────────────────────────────────────
function u16(n) { return [n & 0xff, (n >> 8) & 0xff]; }

/**
 * Assemble a looping animated GIF from indexed frames + a colour table.
 * @param {Uint8Array[]} frames each WIDTH*HEIGHT palette indices
 * @param {{width:number,height:number,palette:number[][],delayCs:number}} opts
 * @returns {Buffer}
 */
export function renderGif(frames, opts) {
  const { width, height, palette, delayCs } = opts;
  // Global colour table size must be a power of two, ≥ 2 entries.
  let gctBits = 1;
  while ((1 << gctBits) < palette.length) gctBits++;
  const gctSize = 1 << gctBits;
  const minCodeSize = Math.max(2, gctBits);

  const bytes = [];
  const push = (...b) => bytes.push(...b);

  // Header + logical screen descriptor
  push(...[...'GIF89a'].map(c => c.charCodeAt(0)));
  push(...u16(width), ...u16(height));
  push(0x80 | ((gctBits - 1) & 0x07));   // GCT flag + colour resolution bits
  push(0x00);                            // background colour index (white)
  push(0x00);                            // pixel aspect ratio

  // Global colour table (padded up to gctSize)
  for (let i = 0; i < gctSize; i++) {
    const c = palette[i] || [0, 0, 0];
    push(c[0], c[1], c[2]);
  }

  // NETSCAPE2.0 application extension → loop forever
  push(0x21, 0xff, 0x0b);
  push(...[...'NETSCAPE2.0'].map(c => c.charCodeAt(0)));
  push(0x03, 0x01, 0x00, 0x00, 0x00);    // sub-block: loop count 0 = infinite

  for (const frame of frames) {
    // Graphic control extension: disposal=1 (leave in place), no transparency.
    push(0x21, 0xf9, 0x04, 0x04, ...u16(delayCs), 0x00, 0x00);
    // Image descriptor: full-frame, no local colour table.
    push(0x2c, ...u16(0), ...u16(0), ...u16(width), ...u16(height), 0x00);
    push(minCodeSize);
    push(...lzwEncode(frame, minCodeSize));
  }

  push(0x3b);   // trailer
  return Buffer.from(bytes);
}

// ── Scene build ───────────────────────────────────────────────────────────────
/**
 * Compose the 48-frame stroll: blue-boy strides right, the cat pads left,
 * they cross near the middle, and the motion wraps for a seamless loop.
 * @returns {{frames: Uint8Array[], palette: number[][]}}
 */
export function buildScene() {
  const blue = resolveSkin('blue-boy');
  const cat = resolveSkin('cat');

  // Pre-resolve every walk frame to a colour grid once.
  const blueGrids = blue.frames.walk.map(rows => frameToGrid(rows, blue.palette));
  const catGrids = cat.frames.walk.map(rows => frameToGrid(rows, cat.palette));

  const { indexOf, table } = buildPalette([...blueGrids, ...catGrids]);

  const blueH = blue.size.h * CELL, catH = cat.size.h * CELL;
  const blueW = blue.size.w * CELL, catW = cat.size.w * CELL;
  const blueTop = GROUND_Y - blueH;   // bottom-align feet at GROUND_Y
  const catTop = GROUND_Y - catH;

  // Seamless-loop math: over 48 frames blue-boy travels 48×6=288px and the cat
  // 48×8=384px — both SHORTER than the 560px strip, so neither can march fully
  // off-canvas. A perfectly hidden wrap is therefore geometrically impossible at
  // these locked speeds. Instead we set each wrap span = its exact per-loop
  // travel, so position(frame 48) === position(frame 0) to the pixel (a flawless
  // 48-frame loop), and phase both sprites so they hug their entry edge at the
  // seam and cross in the middle — the eye reads the wrap as ordinary edge
  // traffic rather than a mid-screen jump.
  const blueSpan = FRAMES * BLUE_SPEED;   // 288 — loop closes exactly
  const catSpan = FRAMES * CAT_SPEED;     // 384
  // Phase: at frame 0 blue-boy is just off the left edge (still hidden, about to
  // stride in) while the cat is fully on-screen hugging the right — so frame 0 is
  // mostly white yet already has a sprite standing on the ground, and the two
  // meet just left of centre a bit past the midpoint of the loop.
  const blueStart = -blueW;               // hidden at frame 0, striding in from the left
  const catStart = WIDTH - catW;          // 508 — on-screen at the right, padding in

  const frames = [];
  for (let f = 0; f < FRAMES; f++) {
    const bmp = new Uint8Array(WIDTH * HEIGHT);   // 0 = white everywhere

    const walkIdx = Math.floor(f / WALK_TICKS) % 2;

    // blue-boy: left → right, not flipped (walk art faces right).
    let bx = blueStart + ((f * BLUE_SPEED) % blueSpan);
    stamp(bmp, blueGrids[walkIdx], Math.round(bx), blueTop, indexOf, false);

    // cat: right → left, flipped so it faces its direction of travel.
    let cx = catStart - ((f * CAT_SPEED) % catSpan);
    stamp(bmp, catGrids[walkIdx], Math.round(cx), catTop, indexOf, true);

    frames.push(bmp);
  }
  return { frames, palette: table };
}

/**
 * Build the scene and encode it into a GIF buffer.
 * @returns {Buffer}
 */
export function buildGif() {
  const { frames, palette } = buildScene();
  return renderGif(frames, { width: WIDTH, height: HEIGHT, palette, delayCs: DELAY_CS });
}

// Run as main → write the committed artifact.
if (import.meta.url === `file://${process.argv[1]}` ||
    fileURLToPath(import.meta.url) === process.argv[1]) {
  const gif = buildGif();
  const outPath = join(here, '..', 'docs', 'demo.gif');
  writeFileSync(outPath, gif);
  process.stdout.write(`wrote ${outPath} — ${WIDTH}x${HEIGHT}, ${FRAMES} frames, ${(gif.length / 1024).toFixed(1)} KB\n`);
}
