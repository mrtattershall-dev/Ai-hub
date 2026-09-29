// test-render-gif.mjs — build the demo GIF, then prove it's a real, non-empty
// GIF89a with our sprites actually standing on the ground line. Zero deps.
//
// We run render-gif.mjs as a subprocess (it writes docs/demo.gif), parse the
// container with a minimal block walker, and — because "it parsed" is not the
// same as "a sprite is visible" — round-trip frame 0 through a tiny LZW decoder
// and eyeball the pixels: mostly white, with ink down where the feet go.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

execFileSync(process.execPath, ['tools/render-gif.mjs'], { stdio: 'inherit' });
const buf = readFileSync('docs/demo.gif');
if (buf.subarray(0, 6).toString('latin1') !== 'GIF89a') throw new Error('not a GIF89a');
const w = buf.readUInt16LE(6), h = buf.readUInt16LE(8);
if (w !== 560 || h !== 120) throw new Error(`unexpected dims ${w}x${h}`);

// Walk the blocks, counting image descriptors (0x2C) between GCT and trailer.
const gctSize = 1 << ((buf[10] & 0x07) + 1);        // global colour table entries
let pos = 13 + 3 * gctSize;                          // header(6)+LSD(7)+GCT
let frames = 0;
// Remember frame 0's image-data span so the decoder below can replay it.
let firstImgDataStart = -1, firstImgMinCode = -1, firstImgW = 0, firstImgH = 0;
while (pos < buf.length && buf[pos] !== 0x3B) {
  if (buf[pos] === 0x2C) {
    // image descriptor: 0x2C, x(2), y(2), w(2), h(2), packed(1)
    const iw = buf.readUInt16LE(pos + 5), ih = buf.readUInt16LE(pos + 7);
    frames++;
    pos += 10;
    const packed = buf[pos - 1];
    const min = (packed & 0x80) ? 3 * (1 << ((packed & 0x07) + 1)) : 0;   // local colour table
    pos += min;
    const minCode = buf[pos];                          // LZW minimum code size byte
    pos += 1;                                          // now at first sub-block length
    if (firstImgDataStart === -1) {
      firstImgDataStart = pos; firstImgMinCode = minCode; firstImgW = iw; firstImgH = ih;
    }
    while (buf[pos] !== 0) pos += buf[pos] + 1;        // skip sub-blocks
    pos++;                                             // skip the 0x00 terminator
  } else if (buf[pos] === 0x21) {                       // extension
    pos += 2;                                          // 0x21, label
    while (buf[pos] !== 0) pos += buf[pos] + 1;
    pos++;
  } else {
    throw new Error('unknown block 0x' + buf[pos].toString(16) + ' @' + pos);
  }
}
if (frames < 24) throw new Error('too few frames: ' + frames);

// ── Round-trip guard: decode frame 0 and look at it ─────────────────────────
// Reassemble frame 0's LZW stream from its sub-blocks, then run a minimal GIF
// LZW decoder (the exact inverse of the encoder) and check the pixel picture.
function readSubBlocks(start) {
  const bytes = [];
  let p = start;
  while (buf[p] !== 0) {
    const len = buf[p]; p++;
    for (let i = 0; i < len; i++) bytes.push(buf[p + i]);
    p += len;
  }
  return Uint8Array.from(bytes);
}

function lzwDecode(data, minCodeSize, pixelCount) {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let dict = [];
  const resetDict = () => {
    dict = [];
    for (let i = 0; i < clear; i++) dict.push([i]);
    dict.push(null);   // CLEAR slot
    dict.push(null);   // EOI slot
    codeSize = minCodeSize + 1;
  };
  resetDict();

  const out = new Uint8Array(pixelCount);
  let outPos = 0;
  let bitBuf = 0, bitCnt = 0, dp = 0;
  const readCode = () => {
    while (bitCnt < codeSize) {
      if (dp >= data.length) return eoi;               // ran dry → stop cleanly
      bitBuf |= data[dp++] << bitCnt;
      bitCnt += 8;
    }
    const code = bitBuf & ((1 << codeSize) - 1);
    bitBuf >>= codeSize; bitCnt -= codeSize;
    return code;
  };

  let prev = null;
  for (;;) {
    const code = readCode();
    if (code === eoi) break;
    if (code === clear) { resetDict(); prev = null; continue; }
    let entry;
    if (code < dict.length && dict[code]) {
      entry = dict[code];
    } else if (code === dict.length && prev) {
      entry = prev.concat(prev[0]);                    // K-W-K special case
    } else {
      throw new Error('bad LZW code ' + code);
    }
    for (let i = 0; i < entry.length; i++) out[outPos++] = entry[i];
    if (prev) {
      dict.push(prev.concat(entry[0]));
      if (dict.length === (1 << codeSize) && codeSize < 12) codeSize++;
    }
    prev = entry;
  }
  return out;
}

const stream = readSubBlocks(firstImgDataStart);
const pixels = lzwDecode(stream, firstImgMinCode, firstImgW * firstImgH);

let white = 0;
for (let i = 0; i < pixels.length; i++) if (pixels[i] === 0) white++;
const whiteFrac = white / pixels.length;
if (whiteFrac < 0.95) throw new Error(`frame 0 not mostly white: ${(whiteFrac * 100).toFixed(1)}%`);

// A sprite must actually be drawn on the ground: non-white ink in the bottom 60 rows.
let inkLow = 0;
for (let y = firstImgH - 60; y < firstImgH; y++) {
  for (let x = 0; x < firstImgW; x++) {
    if (pixels[y * firstImgW + x] !== 0) inkLow++;
  }
}
if (inkLow < 1) throw new Error('no sprite ink in the bottom 60 rows of frame 0');

if (!existsSync('docs/demo.gif')) throw new Error('docs/demo.gif missing');
console.log(`GIF OK — ${w}x${h}, ${frames} frames, ${(buf.length / 1024).toFixed(1)} KB`);
console.log(`round-trip frame 0 — ${(whiteFrac * 100).toFixed(1)}% white, ${inkLow} ink px in bottom 60 rows`);
