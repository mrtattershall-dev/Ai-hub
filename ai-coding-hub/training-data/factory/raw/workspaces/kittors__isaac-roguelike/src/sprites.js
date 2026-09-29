// 全部游戏图形在此程序化生成 —— 没有任何外部图片资源。
// 每个精灵都画在低分辨率离屏画布上，再由 makeSprite 自动加一圈粗黑描边，
// 这是《以撒的结合》视觉辨识度最高的特征。

import { makeSprite, pellipse, pcircle, prect, phalf, pline, pset, flipX, shade, rgba } from './gfx.js';
import { PAL } from './palette.js';

// ---------------------------------------------------------------------------
// 主角 ISAAC —— 大光头 + 小身体，头与身体分离渲染：
// 身体朝移动方向，头朝射击方向。这是原作最核心的视觉语法。
// ---------------------------------------------------------------------------

/** 画一颗以撒的头。dir: 0上 1右 2下 3左 */
function drawIsaacHead(g, dir, opts = {}) {
  const cx = 16, cy = 15;
  const skin = opts.skin || PAL.skin;
  const lit = opts.skinLit || PAL.skinLit;
  const dark = opts.skinDark || PAL.skinDark;

  // 头骨主体：略扁的椭圆
  pellipse(g, cx, cy, 13, 12.5, skin);
  // 下巴阴影
  phalf(g, cx, cy + 3, 12, 9, dark, 'bottom');
  pellipse(g, cx, cy - 1, 12.5, 11, skin);
  // 头顶高光
  pellipse(g, cx - 1, cy - 6, 9, 6, lit);

  if (dir === 0) {
    // 背面：只有后脑勺，画一小撮呆毛的暗影 + 脖子
    pellipse(g, cx, cy + 2, 10, 8, shade(skin, -14));
    prect(g, cx - 3, cy + 10, 6, 3, dark);
    return;
  }

  const eye = (ex, ey, rx, ry) => {
    pellipse(g, ex, ey, rx, ry, PAL.ink);
    pset(g, ex - rx + 1, ey - ry + 1, rgba(PAL.white, 0.9));
  };

  if (dir === 2) {
    // 正面：两只大黑眼 + 眼下泪痕 + 小嘴
    eye(cx - 6, cy + 1, 2.6, 4);
    eye(cx + 6, cy + 1, 2.6, 4);
    prect(g, cx - 7, cy + 5, 3, 4, PAL.tear);
    prect(g, cx + 5, cy + 5, 3, 4, PAL.tear);
    pset(g, cx - 6, cy + 9, PAL.tearDark);
    pset(g, cx + 6, cy + 9, PAL.tearDark);
    // 嘴：向下撇的一条线
    pline(g, cx - 2, cy + 9, cx + 2, cy + 9, PAL.ink);
    pset(g, cx - 3, cy + 8, PAL.ink);
    pset(g, cx + 3, cy + 8, PAL.ink);
  } else {
    // 侧面（默认朝右）：一只眼 + 鼻尖 + 泪痕
    pellipse(g, cx + 2, cy - 1, 11.5, 11.5, skin);
    pellipse(g, cx + 1, cy - 6, 8, 5, lit);
    eye(cx + 5, cy + 1, 2.4, 4);
    prect(g, cx + 4, cy + 5, 3, 4, PAL.tear);
    pset(g, cx + 5, cy + 9, PAL.tearDark);
    // 鼻子：右侧凸出的一小块
    prect(g, cx + 12, cy + 1, 2, 3, skin);
    // 耳朵
    pellipse(g, cx - 5, cy + 2, 2.5, 3, dark);
    pline(g, cx + 8, cy + 8, cx + 11, cy + 7, PAL.ink);
  }
}

/** 画以撒的身体。frame 用于走路动画，front=true 为正/背面朝向 */
function drawIsaacBody(g, frame, front, opts = {}) {
  const cx = 11, base = 15;
  const skin = opts.skin || PAL.skin;
  const dark = opts.skinDark || PAL.skinDark;
  // 走路时两腿交替前后摆
  const swing = [0, 1, 0, -1][frame];

  // 腿
  prect(g, cx - 5, base - 4 + Math.max(0, swing), 4, 4 - Math.abs(swing), skin);
  prect(g, cx + 1, base - 4 + Math.max(0, -swing), 4, 4 - Math.abs(swing), skin);

  // 躯干：小小的一团
  pellipse(g, cx, base - 6, 7, 5, skin);
  phalf(g, cx, base - 4, 6.5, 4, dark, 'bottom');

  // 手臂：两侧的小圆，走路时上下摆动
  if (front) {
    pellipse(g, cx - 8, base - 7 - swing, 2.5, 3, skin);
    pellipse(g, cx + 8, base - 7 + swing, 2.5, 3, skin);
  } else {
    pellipse(g, cx + 6, base - 7 + swing, 2.5, 3, skin);
  }
}

export function buildIsaac(opts = {}) {
  const heads = [];
  for (let d = 0; d < 4; d++) {
    const sp = makeSprite(32, 30, (g) => drawIsaacHead(g, d === 3 ? 1 : d, opts), {
      ax: 16, ay: 26,
    });
    heads.push(d === 3 ? wrapFlip(sp, 16, 26) : sp);
  }
  const bodyFront = [], bodySide = [];
  for (let f = 0; f < 4; f++) {
    bodyFront.push(makeSprite(22, 16, (g) => drawIsaacBody(g, f, true, opts), { ax: 11, ay: 15 }));
    bodySide.push(makeSprite(22, 16, (g) => drawIsaacBody(g, f, false, opts), { ax: 11, ay: 15 }));
  }
  return { heads, bodyFront, bodySide };
}

// flipX 返回的是原始 canvas 包装，补上精灵字段
function wrapFlip(sp, ax, ay) {
  const f = flipX(sp);
  return { canvas: f.canvas, w: f.w, h: f.h, ax, ay };
}

// ---------------------------------------------------------------------------
// 眼泪 / 弹幕
// ---------------------------------------------------------------------------

/** 以撒的眼泪：一颗上尖下圆的水滴，左上一点高光，底部一圈薄阴影 */
export function buildTear(size, color = PAL.tear, dark = PAL.tearDark) {
  const s = Math.max(4, size);
  const w = s * 2 + 4, h = s * 2 + 8;
  return makeSprite(w, h, (g) => {
    const cx = w / 2, cy = h / 2 + 2;
    // 圆润的水滴身
    pellipse(g, cx, cy, s, s, color);
    // 顶部收成尖：越往上越窄
    const tip = s * 1.15;
    for (let i = 0; i <= tip; i++) {
      const t = i / tip;
      const ww = Math.max(1, Math.round(s * 1.35 * (1 - t) * (1 - t * 0.55)));
      prect(g, Math.round(cx - ww / 2), Math.round(cy - s - i + 1), ww, 1, color);
    }
    // 底部薄薄一层暗色，只压最下面一点，别让水滴看起来像分层的球。
    // 半径要留在主体圆内，否则描边会在最下方戳出一个孤立的黑点。
    phalf(g, cx, cy + s * 0.46, s * 0.86, s * 0.4, dark, 'bottom');
    // 高光：左上一小点
    pellipse(g, cx - s * 0.36, cy - s * 0.42, s * 0.24, s * 0.28, PAL.tearLit);
  }, { ax: w / 2, ay: h / 2 + 2 });
}

/** 敌人的血弹 */
export function buildBloodShot(size) {
  const w = size * 2 + 4, h = size * 2 + 4;
  return makeSprite(w, h, (g) => {
    const c = w / 2;
    pcircle(g, c, c, size, PAL.blood);
    phalf(g, c, c, size - 0.5, size - 0.5, PAL.bloodDark, 'bottom');
    pellipse(g, c - size * 0.3, c - size * 0.35, size * 0.35, size * 0.3, PAL.bloodLit);
  }, { ax: w / 2, ay: h / 2 });
}

// ---------------------------------------------------------------------------
// 敌人
// ---------------------------------------------------------------------------

/** 通用「肉团怪」绘制：一个带高光和黑眼的球体，多数以撒杂兵都是这个结构 */
function blob(g, cx, cy, rx, ry, base, opts = {}) {
  pellipse(g, cx, cy, rx, ry, base);
  phalf(g, cx, cy + ry * 0.25, rx * 0.95, ry * 0.9, opts.dark || shade(base, -34), 'bottom');
  pellipse(g, cx, cy - ry * 0.15, rx * 0.92, ry * 0.8, base);
  pellipse(g, cx - rx * 0.3, cy - ry * 0.45, rx * 0.42, ry * 0.3, opts.lit || shade(base, 28));
}

/** 一对黑眼睛（可带流血） */
function eyes(g, cx, cy, spread, r, weeping = false) {
  for (const s of [-1, 1]) {
    pellipse(g, cx + s * spread, cy, r, r * 1.3, PAL.ink);
    pset(g, cx + s * spread - r + 1, cy - r, rgba(PAL.white, 0.75));
    if (weeping) {
      prect(g, cx + s * spread - 1, cy + r * 1.2, 2, 4, PAL.blood);
      pset(g, cx + s * spread, cy + r * 1.2 + 4, PAL.bloodDark);
    }
  }
}

/** 张开的嘴（Gaper / Monstro 的标志） */
function maw(g, cx, cy, w, h, teeth = 0) {
  pellipse(g, cx, cy, w, h, PAL.bloodDark);
  pellipse(g, cx, cy + h * 0.25, w * 0.8, h * 0.6, PAL.blood);
  for (let i = 0; i < teeth; i++) {
    const tx = cx - w + 2 + (i * (w * 2 - 4)) / Math.max(1, teeth - 1);
    prect(g, tx, cy - h + 1, 2, 3, PAL.white);
    prect(g, tx, cy + h - 4, 2, 3, PAL.white);
  }
}

/** 苍蝇翅膀：半透明的两片 */
function wings(g, cx, cy, r, phase) {
  const spread = phase ? r * 1.5 : r * 1.1;
  const lift = phase ? -1 : 1;
  for (const s of [-1, 1]) {
    pellipse(g, cx + s * spread, cy + lift, r * 0.85, r * 0.45, rgba(PAL.wing, 0.85));
  }
}

/** 敌人精灵表：每项返回 { frames:[...], ax, ay } */
export const ENEMY_SPRITES = {};

function reg(name, w, h, frameCount, drawFn, opts = {}) {
  const frames = [];
  for (let f = 0; f < frameCount; f++) {
    frames.push(makeSprite(w, h, (g) => drawFn(g, f, w, h), {
      ax: opts.ax !== undefined ? opts.ax : w / 2,
      ay: opts.ay !== undefined ? opts.ay : h - 1,
    }));
  }
  ENEMY_SPRITES[name] = frames;
  return frames;
}

export function buildEnemySprites() {
  // 苍蝇：黑球 + 拍动的翅膀
  reg('fly', 20, 18, 2, (g, f) => {
    wings(g, 10, 8, 5, f);
    blob(g, 10, 9, 5, 5, PAL.fly, { lit: PAL.flyLit });
    eyes(g, 10, 8, 2, 1.4);
  }, { ay: 9 });

  // 攻击苍蝇：红色，更凶
  reg('attackfly', 20, 18, 2, (g, f) => {
    wings(g, 10, 8, 5, f);
    blob(g, 10, 9, 5.5, 5.5, PAL.blood, { lit: PAL.bloodLit });
    eyes(g, 10, 8, 2.2, 1.5);
  }, { ay: 9 });

  // Pooter：灰白胖苍蝇，会射血弹
  reg('pooter', 26, 24, 2, (g, f) => {
    wings(g, 13, 11, 7, f);
    blob(g, 13, 12, 8, 8, '#c9c2ae');
    eyes(g, 13, 11, 3, 2);
    maw(g, 13, 16, 3, 2);
  }, { ay: 13 });

  // Boom Fly：灰色，死亡爆炸
  reg('boomfly', 26, 24, 2, (g, f) => {
    wings(g, 13, 11, 7, f);
    blob(g, 13, 12, 8, 8, '#7f7f86');
    eyes(g, 13, 11, 3, 2.2, true);
  }, { ay: 13 });

  // Gaper：肉色人形，双眼流血，张着大嘴走向你
  reg('gaper', 26, 30, 2, (g, f) => {
    const bob = f;
    // 腿
    prect(g, 8, 26 - bob, 4, 4, PAL.flesh);
    prect(g, 14, 25 + bob, 4, 4, PAL.flesh);
    // 身体
    pellipse(g, 13, 22 - bob, 7, 5, PAL.flesh);
    // 头
    blob(g, 13, 13 - bob, 10, 10, PAL.flesh, { dark: PAL.fleshDark, lit: PAL.fleshLit });
    eyes(g, 13, 11 - bob, 4, 2.2, true);
    maw(g, 13, 18 - bob, 4.5, 3.5, 4);
  });

  // Frowning Gaper：更暗、更快
  reg('frowninggaper', 26, 30, 2, (g, f) => {
    const bob = f;
    prect(g, 8, 26 - bob, 4, 4, '#c98d8d');
    prect(g, 14, 25 + bob, 4, 4, '#c98d8d');
    pellipse(g, 13, 22 - bob, 7, 5, '#c98d8d');
    blob(g, 13, 13 - bob, 10, 10, '#c98d8d', { dark: '#8f5c5c' });
    eyes(g, 13, 11 - bob, 4, 2.4, true);
    pline(g, 8, 18 - bob, 18, 18 - bob, PAL.ink);
  });

  // Horf：固定在地上的肉块，靠近时喷血弹
  reg('horf', 26, 24, 2, (g, f) => {
    blob(g, 13, 14, 10, 9, PAL.flesh, { dark: PAL.fleshDark });
    eyes(g, 13, 10, 4, 2);
    maw(g, 13, 17, 5 + f * 1.5, 3 + f, 5);
  });

  // Clotty：血块，四方向喷射
  reg('clotty', 26, 24, 2, (g, f) => {
    blob(g, 13, 14 - f, 10, 8.5, PAL.blood, { lit: PAL.bloodLit, dark: PAL.bloodDark });
    eyes(g, 13, 12 - f, 4, 2.2);
    // 底部滴落的血
    prect(g, 9, 21 - f, 2, 2, PAL.bloodDark);
    prect(g, 15, 21 - f, 2, 2, PAL.bloodDark);
  });

  // Charger：红色蛆虫，看到你就冲刺
  reg('charger', 30, 20, 2, (g, f) => {
    for (let i = 0; i < 3; i++) {
      const seg = 3 - i;
      pellipse(g, 8 + i * 7, 13 + (f ? (i % 2) : -(i % 2)), 5 - i * 0.4, 4.5, shade(PAL.blood, i * 12));
    }
    pellipse(g, 22, 12, 6, 5.5, PAL.bloodLit);
    eyes(g, 23, 11, 2.5, 1.6);
    maw(g, 25, 14, 2.5, 2, 3);
  });

  // Spider：黑蜘蛛，跳跃式移动
  reg('spider', 22, 16, 2, (g, f) => {
    const lift = f ? 1 : 0;
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        pline(g, 11, 10 - lift, 11 + s * (7 + i), 13 - i + (f ? 1 : 0), PAL.ink);
      }
    }
    blob(g, 11, 9 - lift, 6, 5, '#3a3238', { lit: '#5e535c' });
    eyes(g, 11, 8 - lift, 2.5, 1.4);
  }, { ay: 13 });

  // Trite：蓝蜘蛛，跳得更远
  reg('trite', 22, 16, 2, (g, f) => {
    const lift = f ? 1 : 0;
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        pline(g, 11, 10 - lift, 11 + s * (7 + i), 13 - i + (f ? 1 : 0), PAL.ink);
      }
    }
    blob(g, 11, 9 - lift, 6.5, 5.5, '#3d5a86', { lit: '#5f81b0' });
    eyes(g, 11, 8 - lift, 2.5, 1.5);
  }, { ay: 13 });

  // Mulligan：躲着你走，死后炸出一群苍蝇
  reg('mulligan', 26, 28, 2, (g, f) => {
    prect(g, 9, 24 - f, 4, 4, '#c8b48a');
    prect(g, 14, 23 + f, 4, 4, '#c8b48a');
    pellipse(g, 13, 20 - f, 8, 6, '#c8b48a');
    blob(g, 13, 12 - f, 10, 9, '#d8c49a', { dark: '#a08a5e' });
    // 闭着的眼 + 咧开的嘴
    pline(g, 8, 11 - f, 12, 11 - f, PAL.ink);
    pline(g, 14, 11 - f, 18, 11 - f, PAL.ink);
    maw(g, 13, 16 - f, 5, 2.5, 4);
  });

  // Host：带尖刺硬壳，缩进去时无敌，探头喷三连射
  reg('host', 26, 22, 2, (g, f) => {
    if (f === 0) {
      // 缩壳：只有一个带刺的盖子
      phalf(g, 13, 17, 11, 8, '#e6e0cf', 'top');
      for (let i = 0; i < 5; i++) {
        const x = 4 + i * 4.5;
        pline(g, x, 12, x + 1, 6, '#e6e0cf');
        pset(g, x, 11, '#b8b2a2');
      }
    } else {
      blob(g, 13, 12, 8, 8, PAL.flesh, { dark: PAL.fleshDark });
      eyes(g, 13, 10, 3.5, 2);
      maw(g, 13, 15, 4, 3, 4);
      phalf(g, 13, 20, 11, 6, '#e6e0cf', 'top');
    }
  });

  // Dip：小便便怪
  reg('dip', 18, 16, 2, (g, f) => {
    pellipse(g, 9, 12 - f, 7, 4, PAL.poop);
    pellipse(g, 9, 8 - f, 5.5, 3.5, PAL.poopLit);
    pellipse(g, 9, 5 - f, 3.5, 2.5, PAL.poopLit);
    eyes(g, 9, 9 - f, 2.5, 1.4);
  }, { ay: 15 });

  // Sucker：吸血肉球，射一发大血弹
  reg('sucker', 24, 22, 2, (g, f) => {
    blob(g, 12, 12, 9, 9, '#a3527f', { lit: '#c47aa4' });
    pellipse(g, 12, 12, 4 + f, 4 + f, PAL.ink);
    pellipse(g, 12, 12, 2.5, 2.5, PAL.blood);
  }, { ay: 20 });

  return ENEMY_SPRITES;
}

// ---------------------------------------------------------------------------
// BOSS
// ---------------------------------------------------------------------------

export const BOSS_SPRITES = {};

function regBoss(name, w, h, frames, drawFn, opts = {}) {
  const list = [];
  for (let f = 0; f < frames; f++) {
    list.push(makeSprite(w, h, (g) => drawFn(g, f, w, h), {
      ax: opts.ax !== undefined ? opts.ax : w / 2,
      ay: opts.ay !== undefined ? opts.ay : h - 1,
      outlineWidth: 1,
    }));
  }
  BOSS_SPRITES[name] = list;
  return list;
}

export function buildBossSprites() {
  // MONSTRO：一大坨肉，两只小眼睛，血盆大口
  regBoss('monstro', 76, 66, 3, (g, f) => {
    const squash = [0, 3, -2][f];
    const cy = 38 + squash;
    // 身体
    blob(g, 38, cy, 34 + squash, 26 - squash, PAL.flesh, { dark: PAL.fleshDark, lit: PAL.fleshLit });
    // 大嘴
    const mouthOpen = f === 2 ? 13 : 7;
    maw(g, 38, cy + 6, 20, mouthOpen, 8);
    // 眼睛
    eyes(g, 38, cy - 12, 12, 4, true);
    // 身上的疣
    for (const [ox, oy] of [[-22, 6], [20, 10], [-14, 16], [16, -6]]) {
      pellipse(g, 38 + ox, cy + oy, 3, 2.5, PAL.fleshDark);
    }
  });

  // DUKE OF FLIES：一个漂浮的巨大脓包，不断吐出苍蝇
  regBoss('duke', 62, 60, 3, (g, f) => {
    const bob = [0, -2, -4][f];
    blob(g, 31, 32 + bob, 27, 25, '#b9b06e', { lit: '#d6cd8e', dark: '#7e7745' });
    // 表面的苍蝇孔
    for (const [ox, oy] of [[-14, -6], [12, -10], [-8, 12], [14, 8], [0, 16]]) {
      pellipse(g, 31 + ox, 32 + bob + oy, 3.5, 3, '#6b6435');
      pellipse(g, 31 + ox, 32 + bob + oy, 2, 1.6, PAL.ink);
    }
    eyes(g, 31, 26 + bob, 9, 3.5);
    maw(g, 31, 40 + bob, 10, 4 + f, 6);
  });

  // LARRY JR：分节的巨型蠕虫，这里画单节
  regBoss('larryseg', 34, 32, 2, (g, f) => {
    blob(g, 17, 18 - f, 14, 13, '#c9d16a', { lit: '#e3ea94', dark: '#8d9440' });
  });
  regBoss('larryhead', 38, 36, 2, (g, f) => {
    blob(g, 19, 20 - f, 16, 15, '#c9d16a', { lit: '#e3ea94', dark: '#8d9440' });
    eyes(g, 19, 15 - f, 6, 3, true);
    maw(g, 19, 25 - f, 8, 4 + f * 2, 6);
  });

  // FAMINE：骑在马上的骷髅骑士（简化为骷髅头 + 马身）
  regBoss('famine', 70, 60, 3, (g, f) => {
    const bob = [0, -2, -1][f];
    // 马身
    pellipse(g, 34, 42 + bob, 26, 14, '#d8d2bc');
    prect(g, 14, 46 + bob, 5, 12, '#d8d2bc');
    prect(g, 48, 46 + bob, 5, 12, '#d8d2bc');
    // 马头
    pellipse(g, 56, 34 + bob, 10, 8, '#d8d2bc');
    pellipse(g, 58, 32 + bob, 2, 2, PAL.ink);
    // 骑手：骷髅
    pellipse(g, 28, 20 + bob, 11, 11, '#efe9d4');
    pellipse(g, 24, 19 + bob, 3, 3.5, PAL.ink);
    pellipse(g, 32, 19 + bob, 3, 3.5, PAL.ink);
    for (let i = 0; i < 4; i++) prect(g, 23 + i * 3, 26 + bob, 2, 3, PAL.ink);
    // 长柄镰刀
    pline(g, 40, 8 + bob, 44, 40 + bob, '#8a6a49');
    pline(g, 40, 8 + bob, 30, 4 + bob, PAL.metalLit);
  });

  // GEMINI：连体双胞胎，大的那个被小的用脐带拴着
  regBoss('geminibig', 56, 52, 2, (g, f) => {
    blob(g, 28, 28 - f, 24, 22, '#e0a898', { dark: '#a97264', lit: '#f6cfc0' });
    eyes(g, 28, 22 - f, 9, 3.5, true);
    maw(g, 28, 34 - f, 9, 4, 5);
  });
  regBoss('geminismall', 32, 30, 2, (g, f) => {
    blob(g, 16, 16 - f, 12, 12, '#e0a898', { dark: '#a97264' });
    eyes(g, 16, 13 - f, 5, 2.4);
    maw(g, 16, 20 - f, 5, 3, 4);
  });

  return BOSS_SPRITES;
}

export { wrapFlip };
