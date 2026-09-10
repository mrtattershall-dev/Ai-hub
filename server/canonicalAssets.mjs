/**
 * canonicalAssets.mjs - the asset VOCABULARY: names that always resolve.
 *
 *   node server/canonicalAssets.mjs            # generate any that are missing
 *   node server/canonicalAssets.mjs --force    # regenerate placeholders (never real art)
 *
 * WHY
 * ---
 * A model trained on this library learns asset NAMES. Trained on 13k idiosyncratic pack
 * names (`orc_orc1_idle_with_shadow_2.png`) it learns nothing transferable and invents
 * names at inference - a 404 and a blank canvas. Trained on a small stable vocabulary
 * (`assets/player.png`, `assets/coin.png`, `assets/jump.wav`) it can write games that
 * verify, PROVIDED those names exist in every library the code will ever run against.
 *
 * So the vocabulary is guaranteed: any canonical name that is missing gets a generated
 * placeholder - a readable pixel-art stand-in or a synthesised sound - and is marked
 * `placeholder: true` in the manifest. Uploading a real file under the same name replaces
 * it in place (assets.add with the name of a placeholder overwrites rather than suffixing),
 * so art can arrive later without retraining or touching a line of game code.
 *
 * The set covers what the Phaser eval asks for (runner, shooter, breakout, platformer,
 * snake, defence, particles, UI, scenes, timer) plus the general 2D basics.
 */
import { deflateSync } from 'zlib';
import { fileURLToPath } from 'url';
import * as assets from './assets.js';

// ── tiny PNG encoder (RGBA) ─────────────────────────────────────────────────────
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
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(c) {
  const { w, h, px } = c;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── a minimal pixel canvas ──────────────────────────────────────────────────────
function canvas(w, h) {
  const px = Buffer.alloc(w * h * 4);
  const set = (x, y, [r, g, b, a = 255]) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    if (a >= 255) { px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; return; }
    const da = px[i + 3] / 255, sa = a / 255, oa = sa + da * (1 - sa);
    if (oa <= 0) return;
    px[i] = (r * sa + px[i] * da * (1 - sa)) / oa;
    px[i + 1] = (g * sa + px[i + 1] * da * (1 - sa)) / oa;
    px[i + 2] = (b * sa + px[i + 2] * da * (1 - sa)) / oa;
    px[i + 3] = oa * 255;
  };
  const c = {
    w, h, px, set,
    rect(x, y, rw, rh, col) { for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) set(i, j, col); return c; },
    frame(x, y, rw, rh, col) { c.rect(x, y, rw, 1, col); c.rect(x, y + rh - 1, rw, 1, col); c.rect(x, y, 1, rh, col); c.rect(x + rw - 1, y, 1, rh, col); return c; },
    circle(cx, cy, r, col) { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r) set(cx + i, cy + j, col); return c; },
    ring(cx, cy, r, col) { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const d = i * i + j * j; if (d <= r * r && d > (r - 1.2) * (r - 1.2)) set(cx + i, cy + j, col); } return c; },
    soft(cx, cy, r, [cr, cg, cb]) { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const d = Math.sqrt(i * i + j * j) / r; if (d <= 1) set(cx + i, cy + j, [cr, cg, cb, Math.round(255 * (1 - d) * (1 - d))]); } return c; },
    tri(x0, y0, x1, y1, x2, y2, col) {       // filled triangle by scanline
      const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
      const edge = (ax, ay, bx, by, y) => (by === ay ? null : ax + ((y - ay) * (bx - ax)) / (by - ay));
      for (let y = minY; y <= maxY; y++) {
        const xs = [];
        for (const [ax, ay, bx, by] of [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]]) {
          if ((y >= Math.min(ay, by)) && (y <= Math.max(ay, by))) { const e = edge(ax, ay, bx, by, y); if (e !== null) xs.push(e); }
        }
        if (xs.length >= 2) { const a = Math.min(...xs), b = Math.max(...xs); for (let x = Math.round(a); x <= Math.round(b); x++) set(x, y, col); }
      }
      return c;
    },
    vgrad(top, bot) { for (let y = 0; y < h; y++) { const t = y / (h - 1); const col = top.map((v, i) => Math.round(v + (bot[i] - v) * t)); for (let x = 0; x < w; x++) set(x, y, col); } return c; },
    noise(col, density, seed = 1) { let s = seed; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rnd() < density) set(x, y, col); return c; },
    png() { return encodePNG(c); },
  };
  return c;
}

// palette
const INK = [24, 20, 37];
const SKIN = [255, 205, 160];
const BLUE = [70, 120, 220], BLUE_D = [40, 70, 150];
const RED = [220, 60, 60], RED_D = [140, 30, 30];
const GREEN = [80, 190, 90], GREEN_D = [40, 120, 50];
const YELLOW = [250, 210, 60], YELLOW_D = [190, 140, 20];
const PURPLE = [150, 80, 200], PURPLE_D = [90, 40, 130];
const GREY = [130, 135, 150], GREY_D = [80, 85, 100], GREY_L = [190, 195, 210];
const BROWN = [140, 95, 60], BROWN_D = [90, 55, 30];
const WHITE = [245, 245, 250];
const CYAN = [90, 220, 240];
const ORANGE = [240, 140, 50], ORANGE_D = [170, 90, 20];

function humanoid(c, x, y, body, bodyD, { legShift = 0, size = 32 } = {}) {
  const s = size / 32;
  // legs
  c.rect(x + 10 * s + legShift, y + 24 * s, 4 * s, 6 * s, bodyD).rect(x + 18 * s - legShift, y + 24 * s, 4 * s, 6 * s, bodyD);
  // body
  c.rect(x + 9 * s, y + 13 * s, 14 * s, 12 * s, body).frame(x + 9 * s, y + 13 * s, 14 * s, 12 * s, INK);
  // arms
  c.rect(x + 6 * s, y + 14 * s, 3 * s, 8 * s, body).rect(x + 23 * s, y + 14 * s, 3 * s, 8 * s, body);
  // head
  c.circle(x + 16 * s, y + 8 * s, 6 * s, SKIN).ring(x + 16 * s, y + 8 * s, 6 * s, INK);
  // eyes
  c.rect(x + 13 * s, y + 7 * s, 2 * s, 2 * s, INK).rect(x + 18 * s, y + 7 * s, 2 * s, 2 * s, INK);
  return c;
}

// ── the vocabulary ──────────────────────────────────────────────────────────────
const IMAGES = [
  ['player.png', 32, 32, 'the player character', (c) => humanoid(c, 0, 0, BLUE, BLUE_D)],
  ['player_sheet.png', 128, 32, '4-frame player walk spritesheet, 32x32 frames', (c) => { for (let f = 0; f < 4; f++) humanoid(c, f * 32, 0, BLUE, BLUE_D, { legShift: [0, 2, 0, -2][f] }); return c; }],
  ['enemy.png', 32, 32, 'a basic enemy', (c) => { humanoid(c, 0, 0, RED, RED_D); return c.rect(12, 6, 3, 1, INK).rect(18, 6, 3, 1, INK); }],
  ['npc.png', 32, 32, 'a friendly non-player character', (c) => humanoid(c, 0, 0, GREEN, GREEN_D)],
  ['boss.png', 64, 64, 'a large boss enemy', (c) => humanoid(c, 0, 0, PURPLE, PURPLE_D, { size: 64 })],
  ['coin.png', 16, 16, 'a collectible coin', (c) => c.circle(8, 8, 6, YELLOW).ring(8, 8, 6, YELLOW_D).rect(7, 5, 2, 6, YELLOW_D)],
  ['gem.png', 16, 16, 'a collectible gem', (c) => c.tri(8, 1, 14, 7, 2, 7, CYAN).tri(2, 7, 14, 7, 8, 15, [40, 170, 200]).frame(2, 7, 13, 1, WHITE)],
  ['star.png', 16, 16, 'a collectible star', (c) => c.tri(8, 0, 11, 6, 5, 6, YELLOW).tri(0, 6, 16, 6, 8, 10, YELLOW).tri(3, 15, 8, 9, 6, 6, YELLOW).tri(13, 15, 8, 9, 10, 6, YELLOW)],
  ['heart.png', 16, 16, 'a heart / life', (c) => c.circle(5, 5, 4, RED).circle(11, 5, 4, RED).tri(1, 7, 15, 7, 8, 15, RED)],
  ['key.png', 16, 16, 'a key', (c) => c.ring(5, 5, 4, YELLOW).rect(8, 4, 7, 3, YELLOW).rect(12, 7, 2, 3, YELLOW)],
  ['ball.png', 16, 16, 'a ball (pong / breakout)', (c) => c.circle(8, 8, 7, WHITE).ring(8, 8, 7, GREY_D).circle(6, 6, 2, [255, 255, 255])],
  ['paddle.png', 96, 16, 'a paddle', (c) => c.rect(0, 0, 96, 16, GREY_L).frame(0, 0, 96, 16, INK).rect(4, 4, 88, 3, WHITE)],
  ['brick.png', 48, 16, 'a breakable brick', (c) => c.rect(0, 0, 48, 16, ORANGE).frame(0, 0, 48, 16, ORANGE_D).rect(3, 3, 42, 2, [255, 190, 110])],
  ['ship.png', 32, 32, 'a spaceship, nose up', (c) => c.tri(16, 1, 28, 30, 4, 30, GREY_L).tri(16, 8, 22, 28, 10, 28, BLUE).rect(14, 30, 4, 2, ORANGE)],
  ['bullet.png', 8, 8, 'a bullet / projectile', (c) => c.rect(2, 0, 4, 8, YELLOW).rect(3, 1, 2, 6, WHITE)],
  ['asteroid.png', 32, 32, 'an asteroid / rock enemy', (c) => c.circle(16, 16, 14, GREY).ring(16, 16, 14, GREY_D).circle(10, 12, 3, GREY_D).circle(20, 20, 4, GREY_D)],
  ['alien.png', 32, 32, 'an alien invader', (c) => c.rect(6, 10, 20, 12, GREEN).rect(2, 14, 4, 8, GREEN).rect(26, 14, 4, 8, GREEN).rect(10, 22, 4, 6, GREEN).rect(18, 22, 4, 6, GREEN).rect(10, 13, 3, 3, INK).rect(19, 13, 3, 3, INK)],
  ['platform.png', 96, 16, 'a floating platform', (c) => c.rect(0, 0, 96, 16, BROWN).rect(0, 0, 96, 4, GREEN).frame(0, 0, 96, 16, BROWN_D)],
  ['ground.png', 32, 32, 'a ground tile (grass on dirt)', (c) => c.rect(0, 0, 32, 32, BROWN).rect(0, 0, 32, 6, GREEN).noise(BROWN_D, 0.08, 7)],
  ['wall.png', 32, 32, 'a wall / brick tile', (c) => { c.rect(0, 0, 32, 32, GREY_D); for (let r = 0; r < 4; r++) for (let i = 0; i < 2; i++) c.rect(i * 16 + (r % 2) * 8 - 8 + 1, r * 8 + 1, 14, 6, GREY); return c; }],
  ['spike.png', 32, 32, 'spikes (hazard)', (c) => { for (let i = 0; i < 4; i++) c.tri(i * 8 + 4, 4, i * 8 + 8, 32, i * 8, 32, GREY_L); return c; }],
  ['door.png', 32, 48, 'a door', (c) => c.rect(2, 0, 28, 48, BROWN).frame(2, 0, 28, 48, BROWN_D).circle(24, 26, 2, YELLOW)],
  ['ladder.png', 32, 32, 'a ladder tile', (c) => { c.rect(6, 0, 3, 32, BROWN).rect(23, 0, 3, 32, BROWN); for (let y = 3; y < 32; y += 8) c.rect(6, y, 20, 2, BROWN_D); return c; }],
  ['tree.png', 32, 48, 'a tree', (c) => c.rect(13, 28, 6, 20, BROWN).circle(16, 18, 13, GREEN).circle(10, 24, 8, GREEN_D).circle(22, 24, 8, GREEN_D)],
  ['rock.png', 32, 32, 'a rock', (c) => c.circle(16, 20, 11, GREY).circle(12, 16, 5, GREY_L).ring(16, 20, 11, GREY_D)],
  ['bush.png', 32, 16, 'a bush', (c) => c.circle(8, 10, 6, GREEN).circle(16, 8, 7, GREEN).circle(24, 10, 6, GREEN_D)],
  ['particle.png', 16, 16, 'a soft round particle', (c) => c.soft(8, 8, 7, WHITE)],
  ['spark.png', 8, 8, 'a bright spark particle', (c) => c.soft(4, 4, 3, YELLOW).rect(3, 3, 2, 2, WHITE)],
  ['smoke.png', 32, 32, 'a smoke puff', (c) => c.soft(16, 16, 14, GREY)],
  ['button.png', 96, 32, 'a UI button', (c) => c.rect(0, 0, 96, 32, BLUE).frame(0, 0, 96, 32, BLUE_D).rect(4, 4, 88, 3, [120, 170, 255])],
  ['panel.png', 128, 96, 'a UI panel / dialog background', (c) => c.rect(0, 0, 128, 96, [40, 44, 60]).frame(0, 0, 128, 96, GREY_L).frame(2, 2, 124, 92, GREY_D)],
  ['healthbar_bg.png', 100, 12, 'health bar background', (c) => c.rect(0, 0, 100, 12, [30, 30, 40]).frame(0, 0, 100, 12, GREY_L)],
  ['healthbar_fill.png', 100, 12, 'health bar fill (crop its width)', (c) => c.rect(0, 0, 100, 12, GREEN).rect(0, 2, 100, 2, [150, 240, 150])],
  ['cursor.png', 16, 16, 'a pointer cursor', (c) => c.tri(1, 1, 1, 14, 10, 9, WHITE).tri(1, 1, 10, 9, 1, 14, WHITE).tri(2, 3, 2, 11, 7, 8, INK)],
  ['background.png', 800, 600, 'a full-screen sky gradient background', (c) => c.vgrad([30, 40, 90], [120, 170, 230]).noise([255, 255, 255, 180], 0.0015, 3)],
  ['tileset.png', 128, 128, '16 terrain tiles, 32x32: grass dirt stone water | sand wood lava snow | brick metal ice mud | path void grass-edge dirt-edge', (c) => {
    const tiles = [GREEN, BROWN, GREY, [50, 110, 220], [225, 200, 130], [170, 120, 70], [230, 90, 30], [235, 240, 250], [150, 70, 60], [120, 130, 150], [170, 220, 240], [90, 70, 50], [190, 170, 130], [15, 15, 22], GREEN, BROWN];
    tiles.forEach((col, i) => { const x = (i % 4) * 32, y = Math.floor(i / 4) * 32; c.rect(x, y, 32, 32, col); });
    c.noise([0, 0, 0, 40], 0.12, 11);
    c.rect(0, 64 + 32, 32, 6, GREEN);      // grass-edge: dirt with grass lip is tile 14 -> row 3 col 2
    return c;
  }],
];

// ── WAV synth ───────────────────────────────────────────────────────────────────
const SR = 22050;
function wav(samples) {
  const n = samples.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-1, Math.min(1, samples[i])) * 32767, 44 + i * 2);
  return b;
}
function synth(seconds, fn) {
  const n = Math.round(SR * seconds);
  const out = new Float32Array(n);
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };
  for (let i = 0; i < n; i++) { const t = i / SR; out[i] = fn(t, i / n, rnd) * 0.6; }
  return wav(out);
}
const sq = (p) => (Math.sin(p) >= 0 ? 1 : -1);
const tri = (p) => 2 * Math.abs(2 * ((p / (2 * Math.PI)) % 1) - 1) - 1;
let ph = 0;
const sweep = (t, f0, f1, dur, w = Math.sin) => { const f = f0 + (f1 - f0) * Math.min(1, t / dur); ph += (2 * Math.PI * f) / SR; return w(ph); };

const AUDIO = [
  ['jump.wav', 'a jump sound', () => { ph = 0; return synth(0.22, (t, u) => sweep(t, 300, 720, 0.22) * (1 - u)); }],
  ['hit.wav', 'a hit / damage sound', () => synth(0.16, (t, u, r) => (r() * 0.7 + Math.sin(2 * Math.PI * 90 * t) * 0.5) * (1 - u) * (1 - u))],
  ['pickup.wav', 'a pickup / coin sound', () => synth(0.18, (t, u) => (t < 0.09 ? Math.sin(2 * Math.PI * 880 * t) : Math.sin(2 * Math.PI * 1320 * t)) * (1 - u) * 0.9)],
  ['explosion.wav', 'an explosion', () => { let acc = 0; return synth(0.7, (t, u, r) => { acc = acc * 0.85 + r() * 0.15; return acc * 4 * (1 - u) * (1 - u); }); }],
  ['shoot.wav', 'a shoot / laser sound', () => { ph = 0; return synth(0.16, (t, u) => sweep(t, 900, 220, 0.16, sq) * (1 - u) * 0.5); }],
  ['click.wav', 'a UI click', () => synth(0.035, (t, u) => Math.sin(2 * Math.PI * 1800 * t) * (1 - u))],
  ['powerup.wav', 'a power-up', () => synth(0.45, (t, u) => { const notes = [523, 659, 784, 1047]; const f = notes[Math.min(3, Math.floor(t / 0.11))]; return tri(2 * Math.PI * f * t) * (1 - u * 0.6); })],
  ['death.wav', 'a death / game-over sound', () => { ph = 0; return synth(0.55, (t, u) => sweep(t, 400, 70, 0.55, sq) * (1 - u) * 0.5); }],
  ['music_loop.wav', 'a 4-second loopable music phrase, 120 bpm', () => synth(4.0, (t) => {
    const beat = Math.floor(t * 2) % 8;                     // eighth notes at 120bpm
    const melody = [262, 330, 392, 523, 392, 330, 294, 349][beat];
    const bass = [131, 131, 196, 196, 165, 165, 147, 175][beat];
    const env = 1 - ((t * 2) % 1) * 0.6;
    return (tri(2 * Math.PI * melody * t) * 0.35 + Math.sin(2 * Math.PI * bass * t) * 0.3) * env;
  })],
];

// ── data ────────────────────────────────────────────────────────────────────────
// Fantasy/RPG names. The library is entirely top-down fantasy art, so these are the names
// with real art behind them (see promoteCanonical.mjs). Placeholders here exist so the
// vocabulary is COMPLETE the moment it is defined - a name that only resolves once the
// right pack is imported is not a guarantee.
const FANTASY_IMAGES = [
  ['orc.png', 32, 32, 'an orc enemy', (c) => humanoid(c, 0, 0, GREEN_D, [30, 90, 40])],
  ['skeleton.png', 32, 32, 'a skeleton enemy', (c) => humanoid(c, 0, 0, [225, 225, 215], GREY)],
  ['gnoll.png', 32, 32, 'a gnoll enemy', (c) => humanoid(c, 0, 0, [190, 150, 90], BROWN_D)],
  ['ghost.png', 32, 32, 'a ghost enemy', (c) => c.soft(16, 14, 12, [200, 230, 255]).rect(12, 12, 3, 3, INK).rect(18, 12, 3, 3, INK)],
  ['slime.png', 32, 32, 'a slime enemy', (c) => c.circle(16, 20, 11, GREEN).ring(16, 20, 11, GREEN_D).rect(12, 17, 3, 3, INK).rect(18, 17, 3, 3, INK)],
  ['rat.png', 32, 32, 'a giant rat enemy', (c) => c.circle(14, 18, 8, GREY).circle(23, 16, 5, GREY).rect(2, 18, 8, 2, GREY_D).rect(21, 12, 2, 4, GREY_D)],
  ['golem.png', 48, 48, 'a golem enemy', (c) => humanoid(c, 0, 0, GREY, GREY_D, { size: 48 })],
  ['ent.png', 48, 48, 'an ent / treant enemy', (c) => c.rect(20, 24, 8, 24, BROWN).circle(24, 16, 14, GREEN_D)],
  ['merchant.png', 32, 32, 'a merchant NPC', (c) => humanoid(c, 0, 0, PURPLE, PURPLE_D)],
  ['blacksmith.png', 32, 32, 'a blacksmith NPC', (c) => humanoid(c, 0, 0, [120, 80, 60], BROWN_D)],
  ['alchemist.png', 32, 32, 'an alchemist NPC', (c) => humanoid(c, 0, 0, CYAN, [40, 140, 160])],
  ['fisherman.png', 32, 32, 'a fisherman NPC', (c) => humanoid(c, 0, 0, [80, 140, 190], BLUE_D)],
  ['barmaid.png', 32, 32, 'a barmaid NPC', (c) => humanoid(c, 0, 0, [220, 130, 160], [160, 70, 100])],
  ['orc_sheet.png', 128, 32, 'orc walk spritesheet, 32x32 frames', (c) => { for (let f = 0; f < 4; f++) humanoid(c, f * 32, 0, GREEN_D, [30, 90, 40], { legShift: [0, 2, 0, -2][f] }); return c; }],
  ['potion.png', 16, 16, 'a healing potion', (c) => c.rect(6, 1, 4, 3, GREY_L).rect(5, 4, 6, 2, GREY_L).circle(8, 10, 5, RED).ring(8, 10, 5, RED_D)],
  ['mana_potion.png', 16, 16, 'a mana potion', (c) => c.rect(6, 1, 4, 3, GREY_L).rect(5, 4, 6, 2, GREY_L).circle(8, 10, 5, BLUE).ring(8, 10, 5, BLUE_D)],
  ['sword.png', 16, 16, 'a sword', (c) => c.rect(7, 1, 2, 9, GREY_L).rect(5, 10, 6, 2, BROWN).rect(7, 12, 2, 3, BROWN_D)],
  ['shield.png', 16, 16, 'a shield', (c) => c.rect(3, 2, 10, 8, GREY_L).tri(3, 10, 13, 10, 8, 15, GREY_L).frame(3, 2, 10, 8, GREY_D).rect(7, 4, 2, 7, RED)],
  ['bow.png', 16, 16, 'a bow', (c) => c.ring(11, 8, 6, BROWN).rect(5, 2, 1, 12, GREY_L).rect(2, 7, 10, 1, GREY)],
  ['axe.png', 16, 16, 'an axe', (c) => c.rect(7, 3, 2, 12, BROWN).tri(9, 2, 15, 5, 9, 9, GREY_L)],
  ['staff.png', 16, 16, 'a magic staff', (c) => c.rect(7, 4, 2, 11, BROWN).circle(8, 3, 3, PURPLE).ring(8, 3, 3, CYAN)],
  ['armor.png', 16, 16, 'body armour', (c) => c.rect(4, 3, 8, 9, GREY_L).frame(4, 3, 8, 9, GREY_D).rect(2, 4, 2, 5, GREY).rect(12, 4, 2, 5, GREY)],
  ['helmet.png', 16, 16, 'a helmet', (c) => c.circle(8, 8, 6, GREY_L).ring(8, 8, 6, GREY_D).rect(4, 8, 8, 3, INK)],
  ['ring.png', 16, 16, 'a magic ring', (c) => c.ring(8, 10, 4, YELLOW).circle(8, 4, 2, RED)],
  ['book.png', 16, 16, 'a book / journal', (c) => c.rect(3, 3, 10, 10, BROWN).frame(3, 3, 10, 10, BROWN_D).rect(7, 3, 2, 10, YELLOW_D)],
  ['map.png', 16, 16, 'a map', (c) => c.rect(2, 3, 12, 10, [225, 205, 160]).frame(2, 3, 12, 10, BROWN_D).rect(5, 6, 6, 1, RED).rect(9, 9, 2, 2, RED)],
  ['chest.png', 16, 16, 'a treasure chest', (c) => c.rect(2, 6, 12, 8, BROWN).rect(2, 4, 12, 3, BROWN_D).rect(7, 8, 2, 3, YELLOW)],
  ['skull.png', 16, 16, 'a skull', (c) => c.circle(8, 7, 6, WHITE).rect(5, 5, 2, 3, INK).rect(9, 5, 2, 3, INK).rect(5, 12, 6, 2, WHITE).rect(7, 10, 2, 2, INK)],
  ['meat.png', 16, 16, 'food / meat', (c) => c.circle(9, 8, 5, [190, 90, 80]).rect(2, 9, 6, 2, [240, 235, 220])],
  ['log.png', 16, 16, 'a wood log resource', (c) => c.rect(1, 5, 14, 6, BROWN).ring(3, 8, 3, BROWN_D).rect(1, 5, 14, 1, [180, 130, 90])],
  ['stone_item.png', 16, 16, 'a stone resource', (c) => c.circle(8, 9, 6, GREY).circle(6, 7, 2, GREY_L).ring(8, 9, 6, GREY_D)],
];

const DATA = [
  ['level.json', 'a 25x19 tile grid (0 floor, 1 wall, 2 platform), 32px tiles, with a spawn and an exit', () => {
    const W = 25, H = 19;
    const tiles = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (x === 0 || y === 0 || x === W - 1 || y === H - 1 ? 1 : 0)));
    for (let x = 5; x < 10; x++) tiles[13][x] = 2;
    for (let x = 12; x < 17; x++) tiles[10][x] = 2;
    for (let x = 18; x < 22; x++) tiles[7][x] = 2;
    return Buffer.from(JSON.stringify({ width: W, height: H, tileSize: 32, legend: { 0: 'floor', 1: 'wall', 2: 'platform' }, spawn: { x: 2, y: 17 }, exit: { x: 22, y: 6 }, tiles }, null, 0));
  }],
];

export const CANON = [
  ...IMAGES.map(([name, w, h, role]) => ({ name, kind: 'image', w, h, role })),
  ...FANTASY_IMAGES.map(([name, w, h, role]) => ({ name, kind: 'image', w, h, role })),
  ...AUDIO.map(([name, role]) => ({ name, kind: 'audio', role })),
  ...DATA.map(([name, role]) => ({ name, kind: 'data', role })),
];
export const CANON_NAMES = CANON.map((c) => c.name);

function generate(name) {
  const img = IMAGES.find((i) => i[0] === name) || FANTASY_IMAGES.find((i) => i[0] === name);
  if (img) return img[4](canvas(img[1], img[2])).png();
  const au = AUDIO.find((a) => a[0] === name);
  if (au) return au[2]();
  const d = DATA.find((x) => x[0] === name);
  if (d) return d[2]();
  throw new Error(`not a canonical asset: ${name}`);
}

/**
 * Make sure every canonical name resolves. Missing ones get a placeholder; existing real
 * files are never touched; existing placeholders are regenerated only with force.
 */
export function ensureCanonical({ force = false, revertReal = false } = {}) {
  const have = new Map(assets.list().map((i) => [i.name, i]));
  let generated = 0, kept = 0, regenerated = 0;
  for (const c of CANON) {
    const ex = have.get(c.name);
    // `force` regenerates placeholders only. `revertReal` also overwrites promoted real
    // art - the escape hatch for "that mapping was wrong, give me the stand-in back".
    const replaceable = force && (ex?.placeholder || revertReal);
    if (ex && !replaceable) { kept++; continue; }
    const buf = generate(c.name);
    const r = assets.add({ name: c.name, dataB64: buf.toString('base64'), defer: true, placeholder: true, role: c.role, replace: !!ex });
    if (!r.ok) throw new Error(`${c.name}: ${r.error}`);
    if (ex) regenerated++; else generated++;
  }
  assets.flush();
  return { generated, kept, regenerated, total: CANON.length };
}

/** One line for the agent's context: the names it can always rely on. */
export function canonicalSummary() {
  const have = new Set(assets.list().map((i) => i.name));
  const present = CANON_NAMES.filter((n) => have.has(n));
  if (!present.length) return null;
  return `Always-available canonical names (prefer these): ${present.map((n) => 'assets/' + n).join(' ')}`;
}

// ── CLI ─────────────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1].replace(/\\/g, '/').replace(/^([a-z]):/i, (m, d) => d.toUpperCase() + ':') || process.argv[1]?.endsWith('canonicalAssets.mjs')) {
  const r = ensureCanonical({ force: process.argv.includes('--force') });
  console.log(`canonical vocabulary: ${r.total} names — ${r.generated} generated, ${r.regenerated} regenerated, ${r.kept} already present`);
  console.log(`library: ${JSON.stringify(assets.totals())}`);
}
