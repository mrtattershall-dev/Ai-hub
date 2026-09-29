// 地形、门、障碍物、掉落物的程序化图形。

import {
  makeSprite, makeCanvas, pellipse, prect, phalf, pline, pset, shade, rgba,
} from './gfx.js';
import { PAL } from './palette.js';
import { RNG } from './util.js';

export const TILE = 26;
export const ROOM_W = 13;   // 房间可行走区域宽度（格）
export const ROOM_H = 7;    // 房间可行走区域高度（格）
export const WALL = 1;      // 四周墙体厚度（格）
export const ROOM_PX_W = (ROOM_W + WALL * 2) * TILE;  // 390
export const ROOM_PX_H = (ROOM_H + WALL * 2) * TILE;  // 234

// ---------------------------------------------------------------------------
// 房间背景：地板铺砖 + 四周墙体，整块烘焙成一张画布，每种章节缓存一份
// ---------------------------------------------------------------------------

const bgCache = new Map();

export function buildRoomBackground(chapter, variant = 0) {
  const key = `${chapter.sub}:${variant}`;
  if (bgCache.has(key)) return bgCache.get(key);

  const ctx = makeCanvas(ROOM_PX_W, ROOM_PX_H);
  const g = ctx.g;
  const rng = new RNG(1337 + variant * 91 + chapter.sub.length * 17);

  // --- 地板：石砖，每块带随机磨损斑点 ---
  for (let ty = 0; ty < ROOM_H; ty++) {
    for (let tx = 0; tx < ROOM_W; tx++) {
      const px = (tx + WALL) * TILE, py = (ty + WALL) * TILE;
      const base = rng.chance(0.5) ? chapter.floor : shade(chapter.floor, rng.range(-8, 8));
      prect(g, px, py, TILE, TILE, base);
      // 砖缝：上 / 左边缘压暗，右 / 下提亮，制造凹陷感
      prect(g, px, py, TILE, 1, shade(base, -36));
      prect(g, px, py, 1, TILE, shade(base, -36));
      prect(g, px, py + TILE - 1, TILE, 1, shade(base, 18));
      prect(g, px + TILE - 1, py, 1, TILE, shade(base, 18));
      // 磨损斑点
      const speckles = rng.range(3, 8);
      for (let i = 0; i < speckles; i++) {
        const sx = px + rng.range(2, TILE - 3), sy = py + rng.range(2, TILE - 3);
        pset(g, sx, sy, shade(base, rng.chance(0.5) ? -20 : 16));
      }
      // 偶尔一条裂缝
      if (rng.chance(0.12)) {
        const cx = px + rng.range(5, TILE - 6), cy = py + rng.range(5, TILE - 6);
        pline(g, cx, cy, cx + rng.range(-4, 4), cy + rng.range(-4, 4), shade(base, -34));
      }
    }
  }

  // --- 墙：外圈石壁，内缘有一圈厚重的暗色压边 ---
  const drawWallBlock = (px, py, w, h) => {
    prect(g, px, py, w, h, chapter.wall);
    for (let y = py; y < py + h; y += TILE) {
      for (let x = px; x < px + w; x += TILE) {
        const c = shade(chapter.wall, rng.range(-10, 10));
        prect(g, x, y, Math.min(TILE, px + w - x), Math.min(TILE, py + h - y), c);
        prect(g, x, y, Math.min(TILE, px + w - x), 1, shade(c, -22));
        prect(g, x, y, 1, Math.min(TILE, py + h - y), shade(c, -22));
        for (let i = 0; i < 5; i++) {
          pset(g, x + rng.range(1, TILE - 2), y + rng.range(1, TILE - 2), shade(c, rng.chance(0.5) ? -16 : 14));
        }
      }
    }
  };
  drawWallBlock(0, 0, ROOM_PX_W, TILE);
  drawWallBlock(0, ROOM_PX_H - TILE, ROOM_PX_W, TILE);
  drawWallBlock(0, TILE, TILE, ROOM_PX_H - TILE * 2);
  drawWallBlock(ROOM_PX_W - TILE, TILE, TILE, ROOM_PX_H - TILE * 2);

  // 墙的内缘：一圈深色阴影投在地板上，营造房间的纵深
  const inX = TILE, inY = TILE, inW = ROOM_W * TILE, inH = ROOM_H * TILE;
  g.fillStyle = PAL.ink;
  g.fillRect(inX - 2, inY - 2, inW + 4, 2);
  g.fillRect(inX - 2, inY + inH, inW + 4, 2);
  g.fillRect(inX - 2, inY, 2, inH);
  g.fillRect(inX + inW, inY, 2, inH);
  for (let i = 0; i < 7; i++) {
    const a = 0.20 - i * 0.028;
    if (a <= 0) break;
    g.fillStyle = rgba('#000000', a);
    g.fillRect(inX, inY + i, inW, 1);
    g.fillRect(inX, inY + inH - 1 - i, inW, 1);
    g.fillRect(inX + i, inY, 1, inH);
    g.fillRect(inX + inW - 1 - i, inY, 1, inH);
  }

  bgCache.set(key, ctx);
  return ctx;
}

// ---------------------------------------------------------------------------
// 门 —— 先画朝上的版本，再旋转出四个方向
// ---------------------------------------------------------------------------

export const DOOR_STYLE = {
  normal:   { frame: '#6f6a5e', panel: '#8a8272', accent: '#4a463d' },
  treasure: { frame: '#d0c9a8', panel: '#e8e0bb', accent: '#9a9068', gem: PAL.gold },
  boss:     { frame: '#8a2b2b', panel: '#b23a33', accent: '#5c1616', gem: '#2a2a2a' },
  shop:     { frame: '#8a6a3a', panel: '#c39a4e', accent: '#5e4622', gem: '#f0d070' },
  secret:   { frame: '#6f6a5e', panel: '#8a8272', accent: '#4a463d' },
  curse:    { frame: '#3a2a2a', panel: '#5a3838', accent: '#241616', gem: '#c22b2b' },
  sacrifice:{ frame: '#7a7a86', panel: '#9a9aa8', accent: '#4d4d57', gem: '#c22b2b' },
  devil:    { frame: '#5c1220', panel: '#8c1f2e', accent: '#380a12', gem: '#e8c04a' },
  angel:    { frame: '#d8d2b6', panel: '#f2eecb', accent: '#a49e82', gem: '#8fd8ff' },
  arcade:   { frame: '#3a3a5a', panel: '#5252a0', accent: '#22223a', gem: '#f0d070' },
};

const DOOR_W = TILE * 2 + 8;   // 门整体宽度：门洞 2 格，两侧各留一点石框
const DOOR_H = TILE + 4;
const JAMB = 6;                // 侧边石框厚度

/**
 * 朝上的门（嵌在上墙里）。画布的下边缘贴着房间内侧。
 * open=true 时门板收进两侧的框里，露出后面的黑暗通道。
 */
function drawDoorUp(g, style, open, w, h) {
  const s = DOOR_STYLE[style] || DOOR_STYLE.normal;
  const cx = w / 2;
  const holeX = JAMB, holeW = w - JAMB * 2;

  // 门洞：始终是暗的，门板盖在上面
  prect(g, holeX, 0, holeW, h, '#120a06');

  // 两侧石框
  prect(g, 0, 0, JAMB, h, s.frame);
  prect(g, w - JAMB, 0, JAMB, h, s.frame);
  prect(g, 0, 0, JAMB, 2, shade(s.frame, 22));
  prect(g, w - JAMB, 0, JAMB, 2, shade(s.frame, 22));
  prect(g, JAMB - 1, 0, 1, h, shade(s.frame, -28));
  prect(g, w - JAMB, 0, 1, h, shade(s.frame, -28));
  // 门框内侧的门槛
  prect(g, 0, h - 3, w, 3, shade(s.frame, -18));

  if (open) {
    // 敞开：通道向房间内渐亮，门板贴在两侧
    for (let i = 0; i < 8; i++) {
      prect(g, holeX, h - 4 - i, holeW, 1, rgba('#000000', 0.09 * (8 - i)));
    }
    prect(g, holeX, 1, 4, h - 5, s.panel);
    prect(g, holeX + holeW - 4, 1, 4, h - 5, s.panel);
    prect(g, holeX, 1, 4, 2, shade(s.panel, 20));
    prect(g, holeX + holeW - 4, 1, 4, 2, shade(s.panel, 20));
    return;
  }

  // 关闭：两扇对开门板 + 中缝 + 铆钉
  prect(g, holeX, 1, holeW, h - 4, s.panel);
  prect(g, holeX, 1, holeW / 2 - 1, h - 4, shade(s.panel, 9));
  prect(g, holeX, 1, holeW, 2, shade(s.panel, 20));
  prect(g, cx - 1, 1, 2, h - 4, s.accent);
  for (let i = 0; i < 3; i++) {
    pset(g, holeX + 2, 6 + i * 7, s.accent);
    pset(g, holeX + holeW - 3, 6 + i * 7, s.accent);
  }

  // 门中央的标记
  if (!s.gem) return;
  const my = h * 0.46;
  if (style === 'boss') {
    // Boss 门：骷髅头
    pellipse(g, cx, my, 7, 6.5, '#e8e2d0');
    pellipse(g, cx - 3, my - 1, 2, 2.4, PAL.ink);
    pellipse(g, cx + 3, my - 1, 2, 2.4, PAL.ink);
    prect(g, cx - 3, my + 4, 6, 3, PAL.ink);
    pset(g, cx, my + 2, PAL.ink);
  } else if (style === 'devil') {
    pentagram(g, cx, my, 7, s.gem);
  } else if (style === 'angel') {
    prect(g, cx - 1.5, my - 8, 3, 15, s.gem);
    prect(g, cx - 6, my - 3, 12, 3, s.gem);
  } else {
    pellipse(g, cx, my, 4.5, 4.5, s.gem);
    pellipse(g, cx - 1.5, my - 1.5, 1.8, 1.8, PAL.white);
  }
}

function pentagram(g, cx, cy, r, color) {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5 + Math.PI;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  for (let i = 0; i < 5; i++) {
    const p = pts[i], q = pts[(i + 2) % 5];
    pline(g, p[0], p[1], q[0], q[1], color);
  }
}

const doorCache = new Map();

/** 取得某方向、某样式、开 / 关状态的门精灵。dir: 0上 1右 2下 3左 */
export function getDoorSprite(style, dir, open) {
  const key = `${style}:${dir}:${open ? 1 : 0}`;
  if (doorCache.has(key)) return doorCache.get(key);

  const base = makeSprite(DOOR_W, DOOR_H, (g) => drawDoorUp(g, style, open, DOOR_W, DOOR_H), {
    ax: DOOR_W / 2, ay: DOOR_H, outline: false,
  });

  let sp;
  if (dir === 0) {
    sp = base;
  } else {
    // 旋转：上→右→下→左，各 90°
    const rot = dir; // 0..3
    const swap = rot % 2 === 1;
    const w = swap ? DOOR_H : DOOR_W, h = swap ? DOOR_W : DOOR_H;
    const c = makeCanvas(w, h);
    c.g.translate(w / 2, h / 2);
    c.g.rotate((rot * Math.PI) / 2);
    c.g.drawImage(base.canvas, -DOOR_W / 2, -DOOR_H / 2);
    // 锚点：门贴着墙的那条边的中点
    const ax = swap ? (dir === 1 ? 0 : w) : w / 2;
    const ay = swap ? h / 2 : (dir === 2 ? 0 : h);
    sp = { canvas: c.canvas, w, h, ax, ay };
  }
  doorCache.set(key, sp);
  return sp;
}

// ---------------------------------------------------------------------------
// 障碍物
// ---------------------------------------------------------------------------

export const OBSTACLE_SPRITES = {};

function regObs(name, drawFn, opts = {}) {
  const w = opts.w || TILE, h = opts.h || TILE + 6;
  OBSTACLE_SPRITES[name] = makeSprite(w, h, drawFn, {
    ax: w / 2,
    ay: opts.ay !== undefined ? opts.ay : h - 3,
    outline: opts.outline,
  });
  return OBSTACLE_SPRITES[name];
}

export function buildObstacleSprites(chapter) {
  const rockBase = chapter && chapter.sub === 'DEPTHS' ? '#7c7c88' : PAL.rock;

  // 普通石头：可被炸开
  regObs('rock', (g, w, h) => {
    const cx = w / 2, cy = h - 13;
    pellipse(g, cx, cy + 3, 12, 8, shade(rockBase, -30));
    pellipse(g, cx, cy, 12, 10, rockBase);
    pellipse(g, cx - 2, cy - 3, 8, 5.5, shade(rockBase, 26));
    pline(g, cx - 5, cy + 2, cx + 1, cy - 2, shade(rockBase, -34));
    pline(g, cx + 1, cy - 2, cx + 6, cy + 3, shade(rockBase, -34));
    pset(g, cx + 5, cy - 4, shade(rockBase, 34));
  });

  // 金属块：完全无法破坏
  regObs('block', (g, w, h) => {
    const cy = h - 14;
    prect(g, 2, cy - 9, w - 4, 20, PAL.metal);
    prect(g, 2, cy - 9, w - 4, 3, PAL.metalLit);
    prect(g, 2, cy + 8, w - 4, 3, PAL.metalDark);
    for (const [x, y] of [[5, -6], [w - 8, -6], [5, 6], [w - 8, 6]]) {
      pellipse(g, x, cy + y, 1.6, 1.6, PAL.metalDark);
    }
  });

  // 便便：三段损坏状态
  for (let stage = 0; stage < 3; stage++) {
    regObs(`poop${stage}`, (g, w, h) => {
      const cx = w / 2, base = h - 5;
      const layers = 3 - stage;
      let y = base;
      for (let i = 0; i < layers; i++) {
        const r = 10 - i * 2.4;
        pellipse(g, cx + (i % 2 ? 1 : -1), y - 3, r, 4 - i * 0.5, PAL.poop);
        pellipse(g, cx + (i % 2 ? 1 : -1), y - 4.5, r * 0.85, 3 - i * 0.4, PAL.poopLit);
        y -= 5.5;
      }
      if (stage === 0) {
        // 完好的便便有两只小眼睛（原作的经典恶趣味）
        pellipse(g, cx - 3, base - 12, 1.6, 2, PAL.ink);
        pellipse(g, cx + 3, base - 12, 1.6, 2, PAL.ink);
      }
      // 苍蝇绕着飞的暗示：几个小黑点
      if (stage < 2) {
        pset(g, cx - 11, base - 17, PAL.ink);
        pset(g, cx + 10, base - 20, PAL.ink);
      }
    });
  }

  // 尖刺：踩上去扣血，不阻挡子弹
  regObs('spikes', (g, w, h) => {
    const base = h - 4;
    prect(g, 2, base - 4, w - 4, 5, shade(rockBase, -24));
    for (let i = 0; i < 4; i++) {
      const x = 4 + i * 5;
      pline(g, x, base - 4, x + 2, base - 13, PAL.metalLit);
      pline(g, x + 4, base - 4, x + 2, base - 13, PAL.metal);
      pset(g, x + 2, base - 14, PAL.white);
    }
  });

  // 无底洞：飞行单位可通过
  regObs('pit', (g, w, h) => {
    const top = h - TILE - 2;
    prect(g, 0, top, w, TILE, '#000000');
    // 洞口边缘的岩层
    prect(g, 0, top, w, 4, shade(chapter ? chapter.floorDark : PAL.floorDark, -20));
    prect(g, 0, top + 4, w, 2, '#1a1008');
    prect(g, 0, top + TILE - 3, w, 3, '#241608');
    for (let i = 0; i < 6; i++) {
      pset(g, 2 + i * 4, top + 5 + (i % 3), '#2a1a0c');
    }
  }, { ay: TILE + 2, h: TILE + 4 });

  // 火盆：持续照亮 + 阻挡，可被眼泪熄灭
  for (let f = 0; f < 3; f++) {
    regObs(`fire${f}`, (g, w, h) => {
      const cx = w / 2, base = h - 4;
      // 底座
      pellipse(g, cx, base - 2, 9, 4, '#6b5a44');
      prect(g, cx - 7, base - 8, 14, 6, '#7d6a50');
      prect(g, cx - 7, base - 8, 14, 2, '#96826a');
      // 火焰：三层，逐帧抖动
      const j = [0, 1, -1][f];
      pellipse(g, cx, base - 14 + j, 6, 8, '#e04a10');
      pellipse(g, cx, base - 15 + j, 4, 6.5, '#f08a20');
      pellipse(g, cx, base - 16 + j, 2.2, 4.5, '#ffe070');
    });
  }

  // TNT：可被引爆
  regObs('tnt', (g, w, h) => {
    const base = h - 4;
    prect(g, 3, base - 16, w - 6, 16, '#b03a2a');
    prect(g, 3, base - 16, w - 6, 3, '#d05a44');
    prect(g, 3, base - 5, w - 6, 3, '#7c2418');
    prect(g, 5, base - 11, w - 10, 5, '#e8dcc0');
    pline(g, w / 2, base - 16, w / 2 + 3, base - 21, '#6b5a44');
  });

  // 蜘蛛网：减速
  regObs('web', (g, w, h) => {
    const cx = w / 2, cy = h - 12;
    // 网丝很淡，只是让地面看起来脏，不该抢走角色的视觉重量
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      pline(g, cx, cy, cx + Math.cos(a) * 11, cy + Math.sin(a) * 8, rgba('#d8d4d0', 0.34));
    }
    for (const r of [4, 7.5, 11]) {
      for (let i = 0; i < 8; i++) {
        const a1 = (i / 8) * Math.PI * 2, a2 = ((i + 1) / 8) * Math.PI * 2;
        pline(g, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r * 0.72,
                 cx + Math.cos(a2) * r, cy + Math.sin(a2) * r * 0.72, rgba('#d8d4d0', 0.24));
      }
    }
  }, { outline: false });

  return OBSTACLE_SPRITES;
}

// ---------------------------------------------------------------------------
// 掉落物 / 拾取物
// ---------------------------------------------------------------------------

export const PICKUP_SPRITES = {};

function regPickup(name, w, h, drawFn) {
  PICKUP_SPRITES[name] = makeSprite(w, h, drawFn, { ax: w / 2, ay: h / 2 });
  return PICKUP_SPRITES[name];
}

/** 心形：以撒的红心是两个圆 + 一个倒三角 */
function heartShape(g, cx, cy, r, color, lit, half = false) {
  pellipse(g, cx - r * 0.5, cy - r * 0.35, r * 0.62, r * 0.6, color);
  pellipse(g, cx + r * 0.5, cy - r * 0.35, r * 0.62, r * 0.6, color);
  for (let i = 0; i <= r * 1.3; i++) {
    const ww = Math.max(1, (r * 1.25 - i * 0.95) * 2);
    prect(g, cx - ww / 2, cy + i * 0.78, ww, 1, color);
  }
  // 高光
  pellipse(g, cx - r * 0.55, cy - r * 0.5, r * 0.26, r * 0.22, lit);
  if (half) {
    // 右半边挖空
    g.clearRect(Math.round(cx), 0, 100, 100);
  }
}

export function buildPickupSprites() {
  regPickup('heart', 22, 20, (g, w, h) => heartShape(g, w / 2, h / 2 - 2, 7, PAL.blood, '#ff8a80'));
  regPickup('halfheart', 22, 20, (g, w, h) => heartShape(g, w / 2, h / 2 - 2, 7, PAL.blood, '#ff8a80', true));
  regPickup('soulheart', 22, 20, (g, w, h) => heartShape(g, w / 2, h / 2 - 2, 7, '#7fb8e8', '#d8f0ff'));
  regPickup('blackheart', 22, 20, (g, w, h) => heartShape(g, w / 2, h / 2 - 2, 7, '#4a3550', '#8a6ea0'));
  regPickup('eternalheart', 22, 20, (g, w, h) => heartShape(g, w / 2, h / 2 - 2, 7, '#dfe8f0', '#ffffff'));

  // 硬币：正面有以撒的头像
  const coin = (color, lit, dark) => (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    pellipse(g, cx, cy, 8, 8, color);
    pellipse(g, cx, cy, 6.5, 6.5, lit);
    pellipse(g, cx, cy, 5, 5, color);
    pellipse(g, cx, cy - 1, 3, 3.4, dark);
    pset(g, cx - 1, cy - 1, PAL.ink);
    pset(g, cx + 1, cy - 1, PAL.ink);
  };
  regPickup('penny', 20, 20, coin('#c98a3a', '#e8b060', '#a06a20'));
  regPickup('nickel', 20, 20, coin('#9aa0a8', '#c8ced6', '#6c727a'));
  regPickup('dime', 20, 20, coin('#e8c04a', '#ffe694', '#b08a18'));

  // 炸弹：黑球 + 引信
  regPickup('bomb', 22, 24, (g, w, h) => {
    const cx = w / 2, cy = h / 2 + 3;
    pellipse(g, cx, cy, 8, 8, '#2e2e34');
    pellipse(g, cx - 2.5, cy - 3, 3, 2.4, '#6a6a74');
    prect(g, cx - 2, cy - 11, 4, 4, '#4a4a52');
    pline(g, cx, cy - 11, cx + 4, cy - 15, '#c8a060');
    pellipse(g, cx + 5, cy - 16, 2, 2, '#ffd060');
  });

  // 钥匙
  regPickup('key', 20, 22, (g, w, h) => {
    const cx = w / 2;
    pellipse(g, cx, 6, 5, 5, PAL.gold);
    pellipse(g, cx, 6, 2.4, 2.4, PAL.ink);
    prect(g, cx - 1.5, 10, 3, 10, PAL.gold);
    prect(g, cx + 1, 15, 4, 2, PAL.gold);
    prect(g, cx + 1, 18, 3, 2, PAL.gold);
    prect(g, cx - 1.5, 10, 1, 10, PAL.goldLit);
  });

  regPickup('goldenkey', 20, 22, (g, w, h) => {
    const cx = w / 2;
    pellipse(g, cx, 6, 5.5, 5.5, PAL.goldLit);
    pellipse(g, cx, 6, 2.4, 2.4, PAL.goldDark);
    prect(g, cx - 1.5, 10, 3, 10, PAL.goldLit);
    prect(g, cx + 1, 15, 4, 2, PAL.goldLit);
  });

  // 药丸 / 卡牌
  regPickup('pill', 20, 16, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    pellipse(g, cx - 3.5, cy, 4.5, 4.5, '#e8e0d0');
    pellipse(g, cx + 3.5, cy, 4.5, 4.5, '#d05a8a');
    prect(g, cx - 4, cy - 4.5, 8, 9, '#e8e0d0');
    prect(g, cx, cy - 4.5, 4, 9, '#d05a8a');
    prect(g, cx - 4, cy - 4, 3, 2, '#ffffff');
  });

  regPickup('card', 20, 24, (g, w, h) => {
    prect(g, 3, 2, w - 6, h - 4, '#efe8d2');
    prect(g, 5, 4, w - 10, h - 8, '#c8bea0');
    pentagram(g, w / 2, h / 2, 5, '#4a3550');
  });

  // 宝箱：关闭 / 打开
  const chest = (body, lit, dark, lock) => (g, w, h) => {
    const cy = h - 8;
    prect(g, 2, cy - 6, w - 4, 12, body);
    phalf(g, w / 2, cy - 6, (w - 4) / 2, 8, lit, 'top');
    prect(g, 2, cy - 7, w - 4, 2, dark);
    prect(g, w / 2 - 2, cy - 4, 4, 6, lock);
    pset(g, w / 2, cy - 1, PAL.ink);
  };
  regPickup('chest', 26, 24, chest('#8a6a3a', '#a8853a', '#5e4622', PAL.gold));
  regPickup('goldchest', 26, 24, chest(PAL.gold, PAL.goldLit, PAL.goldDark, '#8a6a3a'));
  regPickup('redchest', 26, 24, chest('#8a2020', '#b83a3a', '#5c1010', '#2a2a2a'));

  // 道具基座：黑色石台 + 光柱
  regPickup('pedestal', 30, 22, (g, w, h) => {
    const cy = h - 6;
    pellipse(g, w / 2, cy + 2, 12, 5, '#3a3038');
    prect(g, w / 2 - 8, cy - 6, 16, 8, '#4a4048');
    prect(g, w / 2 - 8, cy - 7, 16, 2, '#5e5260');
    pellipse(g, w / 2, cy - 7, 10, 4, '#5e5260');
  });

  // 活板门（通往下一层）
  regPickup('trapdoor', 34, 30, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    pellipse(g, cx, cy, 15, 12, '#3a2a1a');
    pellipse(g, cx, cy, 13, 10, '#000000');
    // 石框
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      pellipse(g, cx + Math.cos(a) * 14, cy + Math.sin(a) * 11, 2.5, 2.2, '#7c6a52');
    }
  });

  return PICKUP_SPRITES;
}

export { pentagram };
