// 渲染：地板 → 污渍 → 坑 → 门 → 阴影 → y 排序的实体 → 投射物 → 粒子 → 光照。

import { TILE, WALL, ROOM_PX_W, ROOM_PX_H,
         buildRoomBackground, getDoorSprite, OBSTACLE_SPRITES, PICKUP_SPRITES } from './tiles.js';
import { drawSprite, rgba, silhouette, flipX, tinted } from './gfx.js';
import { PAL, CHAPTERS } from './palette.js';
import { ROOM_PLAY_W, ROOM_PLAY_H } from './entities.js';
import { itemIcon } from './items.js';
import { ROOM_TYPE } from './floor.js';
import { BOSS_SPRITES } from './sprites.js';

// 受击闪白的剪影缓存
const flashCache = new WeakMap();
function flashSprite(sp) {
  if (!flashCache.has(sp)) flashCache.set(sp, silhouette(sp, '#ffffff'));
  const f = flashCache.get(sp);
  return { canvas: f.canvas, w: f.w, h: f.h, ax: sp.ax, ay: sp.ay };
}
// 冠军怪的染色版本缓存。必须预先烘焙到独立画布上 ——
// 直接在主画布用 source-atop 会把背景也一起染色。
const champCache = new WeakMap();
function championSprite(sp, color) {
  let byColor = champCache.get(sp);
  if (!byColor) { byColor = new Map(); champCache.set(sp, byColor); }
  if (!byColor.has(color)) {
    const t = tinted(sp, color, 0.5);
    byColor.set(color, { canvas: t.canvas, w: t.w, h: t.h, ax: sp.ax, ay: sp.ay });
  }
  return byColor.get(color);
}

// 水平翻转缓存
const flipCache = new WeakMap();
function flippedSprite(sp) {
  if (!flipCache.has(sp)) {
    const f = flipX(sp);
    flipCache.set(sp, { canvas: f.canvas, w: f.w, h: f.h, ax: sp.w - sp.ax, ay: sp.ay });
  }
  return flipCache.get(sp);
}

/** 角色脚下的椭圆阴影 —— 让俯视角有立体感 */
function shadow(g, x, y, rx, alpha = 0.3, ry = null) {
  g.fillStyle = rgba('#000000', alpha);
  g.beginPath();
  g.ellipse(Math.round(x), Math.round(y), rx, ry || rx * 0.42, 0, 0, Math.PI * 2);
  g.fill();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.g.imageSmoothingEnabled = false;
    this.scale = 3;
    this.time = 0;
  }

  resize() {
    const availW = window.innerWidth, availH = window.innerHeight;
    const s = Math.max(2, Math.min(Math.floor(availW / ROOM_PX_W), Math.floor(availH / ROOM_PX_H)));
    this.scale = s;
    this.canvas.width = ROOM_PX_W;
    this.canvas.height = ROOM_PX_H;
    this.canvas.style.width = `${ROOM_PX_W * s}px`;
    this.canvas.style.height = `${ROOM_PX_H * s}px`;
    this.g.imageSmoothingEnabled = false;
  }

  draw(game, dt) {
    this.time += dt;
    const g = this.g;
    const room = game.room;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, ROOM_PX_W, ROOM_PX_H);

    if (!room) return;

    // 震屏
    const sh = room.shakeAmount;
    const ox = sh ? (Math.random() - 0.5) * sh : 0;
    const oy = sh ? (Math.random() - 0.5) * sh : 0;
    g.save();
    g.translate(Math.round(ox), Math.round(oy));

    const chapter = CHAPTERS[Math.min(CHAPTERS.length - 1, Math.floor((game.level - 1) / 2))];

    // --- 背景 ---
    const bg = buildRoomBackground(chapter, room.bgVariant);
    g.drawImage(bg.canvas, 0, 0);

    // 进入房间坐标系（跳过墙的厚度）
    g.save();
    g.translate(WALL * TILE, WALL * TILE);

    this.drawDecals(g, room);
    this.drawPits(g, room);
    this.drawDoorsInner(g, game, room);
    this.drawSpecialFloor(g, game, room);

    // --- 按 y 排序统一绘制，保证前后遮挡正确 ---
    const drawables = [];
    for (const o of room.obstacles) {
      if (o.kind === 'pit' || o.kind === 'web') continue;
      drawables.push({ y: o.y, kind: 'obstacle', ref: o });
    }
    for (const e of room.enemies) if (!e.dead) drawables.push({ y: e.y, kind: 'enemy', ref: e });
    for (const p of room.pickups) drawables.push({ y: p.y, kind: 'pickup', ref: p });
    for (const b of room.bombs) drawables.push({ y: b.y, kind: 'bomb', ref: b });
    for (const m of room.machines) drawables.push({ y: m.py, kind: 'machine', ref: m });
    if (room.boss && !room.boss.dead) drawables.push({ y: room.boss.y, kind: 'boss', ref: room.boss });
    if (!game.player.dead) drawables.push({ y: game.player.y, kind: 'player', ref: game.player });

    drawables.sort((a, b) => a.y - b.y);

    // 先统一画所有阴影，避免阴影盖住别人的脚
    for (const d of drawables) this.drawShadow(g, d);
    for (const d of drawables) this.drawEntity(g, d, game, room);

    this.drawProjectiles(g, room);
    this.drawLasers(g, room);
    this.drawParticles(g, room);
    this.drawExplosions(g, room);
    this.drawTexts(g, room);

    g.restore();

    // 门画在墙上（房间坐标系之外）
    this.drawDoors(g, game, room);
    this.drawLighting(g, game, room);

    g.restore();
  }

  // --- 分层 ---------------------------------------------------------------

  drawDecals(g, room) {
    for (const d of room.decals) {
      const seed = d.seed;
      if (d.kind === 'scorch') {
        g.fillStyle = rgba('#000000', 0.35);
        g.beginPath();
        g.ellipse(d.x, d.y, d.size, d.size * 0.6, 0, 0, Math.PI * 2);
        g.fill();
        continue;
      }
      const color = d.kind === 'blood' ? PAL.bloodDark : PAL.tearDark;
      g.fillStyle = rgba(color, d.alpha);
      // 主渍 + 几点飞溅，用 seed 保证每帧一致
      g.beginPath();
      g.ellipse(d.x, d.y, d.size * 0.9, d.size * 0.55, 0, 0, Math.PI * 2);
      g.fill();
      for (let i = 0; i < 4; i++) {
        const a = ((seed * (i + 1)) % 100) / 100 * Math.PI * 2;
        const r = d.size * (0.9 + ((seed * (i + 3)) % 70) / 70);
        g.fillRect(Math.round(d.x + Math.cos(a) * r), Math.round(d.y + Math.sin(a) * r * 0.6), 2, 1);
      }
    }
  }

  drawPits(g, room) {
    for (const o of room.obstacles) {
      if (o.kind !== 'pit') continue;
      drawSprite(g, OBSTACLE_SPRITES.pit, o.x, o.y + TILE / 2);
    }
    for (const o of room.obstacles) {
      if (o.kind !== 'web') continue;
      drawSprite(g, OBSTACLE_SPRITES.web, o.x, o.y + TILE / 2);
    }
  }

  /** 特殊房间的地面标记：宝箱房的光圈、恶魔房的五芒星等 */
  drawSpecialFloor(g, game, room) {
    if (room.type === ROOM_TYPE.TREASURE) {
      const cx = ROOM_PLAY_W / 2, cy = ROOM_PLAY_H / 2;
      const pulse = 0.12 + Math.sin(this.time * 2) * 0.04;
      g.fillStyle = rgba('#ffe694', pulse);
      g.beginPath();
      g.ellipse(cx, cy + 6, 46, 26, 0, 0, Math.PI * 2);
      g.fill();
    }
    // 恶魔房：整块地面压成暗红，中央一个缓缓搏动的五芒星
    if (room.type === ROOM_TYPE.DEVIL) {
      g.fillStyle = rgba('#3a0a10', 0.55);
      g.fillRect(0, 0, ROOM_PLAY_W, ROOM_PLAY_H);
      const cx = ROOM_PLAY_W / 2, cy = ROOM_PLAY_H / 2;
      const pulse = 0.14 + Math.sin(this.time * 1.6) * 0.05;
      g.strokeStyle = rgba('#c22b2b', pulse);
      g.lineWidth = 1;
      const r = 52;
      const pts = [];
      for (let i = 0; i < 5; i++) {
        const a = Math.PI / 2 + (i * 2 * Math.PI) / 5;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.62]);
      }
      g.beginPath();
      for (let i = 0; i < 5; i++) {
        const p = pts[i], q = pts[(i + 2) % 5];
        g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]);
      }
      g.stroke();
    }
    // 天使房：柔和的白光地毯
    if (room.type === ROOM_TYPE.ANGEL) {
      const cx = ROOM_PLAY_W / 2, cy = ROOM_PLAY_H / 2;
      const glow = 0.13 + Math.sin(this.time * 1.4) * 0.04;
      g.fillStyle = rgba('#f2eecb', glow);
      g.beginPath();
      g.ellipse(cx, cy + 6, 70, 40, 0, 0, Math.PI * 2);
      g.fill();
    }
    if (room.type === ROOM_TYPE.CURSE || room.type === ROOM_TYPE.SACRIFICE) {
      const cx = ROOM_PLAY_W / 2, cy = ROOM_PLAY_H / 2;
      g.strokeStyle = rgba('#8c1f2e', 0.4);
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(cx, cy + 4, 40, 24, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }

  drawShadow(g, d) {
    const e = d.ref;
    switch (d.kind) {
      case 'player': shadow(g, e.x, e.y + 1, 9, 0.32); break;
      case 'enemy':
        if (e.spawnAnim > 0) break;
        shadow(g, e.x, e.y + 1, e.r * (e.flying ? 0.8 : 1), e.flying ? 0.2 : 0.3);
        break;
      case 'boss': shadow(g, e.x, e.y + 2, e.r * 1.15, 0.34); break;
      case 'pickup':
        if (e.kind === 'trapdoor' || e.kind === 'pedestal') break;
        shadow(g, e.x, e.y + 9, 7, 0.24);
        break;
      case 'bomb': shadow(g, e.x, e.y + 6, 7, 0.28); break;
      case 'obstacle':
        if (e.kind === 'spikes') break;
        shadow(g, e.x, e.y + TILE * 0.42, TILE * 0.42, 0.24);
        break;
      case 'machine': shadow(g, e.px, e.py + 12, 12, 0.28); break;
      default: break;
    }
  }

  drawEntity(g, d, game, room) {
    switch (d.kind) {
      case 'obstacle': this.drawObstacle(g, d.ref); break;
      case 'enemy': this.drawEnemy(g, d.ref); break;
      case 'boss': this.drawBoss(g, d.ref); break;
      case 'pickup': this.drawPickup(g, d.ref, game); break;
      case 'player': this.drawPlayer(g, d.ref); break;
      case 'bomb': this.drawBomb(g, d.ref); break;
      case 'machine': this.drawMachine(g, d.ref); break;
      default: break;
    }
  }

  drawObstacle(g, o) {
    let key = o.spriteKey;
    if (o.kind === 'fire') key = `fire${Math.floor(this.time * 9) % 3}`;
    const sp = OBSTACLE_SPRITES[key];
    if (!sp) return;
    const jitter = o.shake > 0 ? (Math.random() - 0.5) * 2 : 0;
    drawSprite(g, sp, o.x + jitter, o.y + TILE / 2);
  }

  drawEnemy(g, e) {
    const frames = e.sprites;
    const idx = e.frameOverride !== undefined && e.frameOverride !== null
      ? Math.min(e.frameOverride, frames.length - 1)
      : e.frame % frames.length;
    let sp = frames[idx];
    if (e.facing < 0) sp = flippedSprite(sp);

    const y = e.y - (e.z || 0);
    // 出生动画：从地面「浮」出来
    if (e.spawnAnim > 0) {
      const t = 1 - e.spawnAnim / 0.35;
      g.save();
      g.globalAlpha = Math.max(0, t);
      drawSprite(g, sp, e.x, y + (1 - t) * 8);
      g.restore();
      return;
    }

    drawSprite(g, e.champion ? championSprite(sp, e.champion.color) : sp, e.x, y);

    if (e.hitFlash > 0) {
      g.save();
      g.globalAlpha = Math.min(1, e.hitFlash * 7);
      drawSprite(g, flashSprite(frames[idx]), e.x, y);
      g.restore();
    }
    if (e.miniboss) {
      // 迷你 Boss 头顶一个小血条
      this.miniBar(g, e.x, y - (sp.ay + 6), e.hp / e.maxHp, 22);
    }
  }

  drawBoss(g, b) {
    const frames = b.sprites;
    const idx = b.frameOverride !== undefined && b.frameOverride !== null
      ? Math.min(b.frameOverride, frames.length - 1) : b.frame % frames.length;
    const sp = frames[idx];
    const y = b.y - (b.z || 0);

    // Larry Jr 的身体节从尾巴往头画
    if (b.kind === 'larry') {
      for (let i = b.segments.length - 1; i >= 0; i--) {
        const s = b.segments[i];
        shadow(g, s.x, s.y + 1, 12, 0.26);
        const f = (Math.floor(this.time * 7) + i) % 2;
        drawSprite(g, BOSS_SPRITES.larryseg[f], s.x, s.y + 10);
      }
    }

    g.save();
    if (b.spawnAnim > 0) g.globalAlpha = Math.min(1, 1 - b.spawnAnim / 0.9 + 0.25);
    drawSprite(g, sp, b.x, y);
    g.restore();

    if (b.hitFlash > 0) {
      g.save();
      g.globalAlpha = Math.min(1, b.hitFlash * 8);
      drawSprite(g, flashSprite(sp), b.x, y);
      g.restore();
    }

    // Gemini 的小个子与脐带
    if (b.twin) {
      const tw = b.twin;
      g.strokeStyle = PAL.fleshDark;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(b.x, b.y - 14);
      g.quadraticCurveTo((b.x + tw.x) / 2, (b.y + tw.y) / 2 + 12, tw.x, tw.y - 8);
      g.stroke();
      shadow(g, tw.x, tw.y + 1, 12, 0.3);
      const tsp = BOSS_SPRITES.geminismall[tw.frame % 2];
      drawSprite(g, tsp, tw.x, tw.y + 12);
    }
  }

  drawPlayer(g, p) {
    const y = p.y;
    // 无敌帧闪烁
    const blink = p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0;
    g.save();
    if (blink) g.globalAlpha = 0.45;

    const { sprite, flip } = p.bodySprite();
    drawSprite(g, flip ? flippedSprite(sprite) : sprite, p.x, y);

    const head = p.headSprite();
    drawSprite(g, head, p.x, y - 12 + p.headBob);

    // Brimstone 蓄力时头顶聚起血光
    if (p.chargeTime > 0.08) {
      const r = Math.min(9, p.chargeTime * 16);
      g.fillStyle = rgba('#e04a45', 0.6);
      g.beginPath();
      g.arc(p.x, y - 30 + p.headBob, r, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    if (p.hurtFlash > 0) {
      g.save();
      g.globalAlpha = Math.min(0.9, p.hurtFlash * 3);
      drawSprite(g, flashSprite(p.headSprite()), p.x, y - 12 + p.headBob);
      g.restore();
    }
  }

  drawPickup(g, pk, game) {
    const bobY = pk.kind === 'pedestal' || pk.kind === 'trapdoor'
      ? 0 : Math.sin(pk.bob) * 2;
    const y = pk.y - (pk.z || 0) + bobY;

    if (pk.kind === 'pedestal') {
      drawSprite(g, PICKUP_SPRITES.pedestal, pk.x, pk.y + 8);
      if (pk.item) {
        const ic = itemIcon(pk.item);
        // 道具悬浮在基座上，带一圈呼吸光晕
        const glow = 0.25 + Math.sin(this.time * 2.4) * 0.12;
        g.fillStyle = rgba('#ffe694', glow);
        g.beginPath();
        g.ellipse(pk.x, pk.y - 12 + Math.sin(pk.bob) * 1.5, 14, 14, 0, 0, Math.PI * 2);
        g.fill();
        drawSprite(g, ic, pk.x, pk.y - 4 + Math.sin(pk.bob) * 1.5);
      }
    } else {
      const sp = pk.sprite;
      if (sp) drawSprite(g, sp, pk.x, y);
    }

    // 商店标价
    if (pk.price > 0) {
      const affordable = game.player.coins >= pk.price;
      this.text(g, `${pk.price}`, pk.x, pk.y + 16, affordable ? '#ffe694' : '#c05050', 'center', 8);
    }
    // 恶魔房标价：直接画出要付几颗心，比数字更直观
    if (pk.heartPrice > 0) {
      const full = Math.floor(pk.heartPrice / 2), half = pk.heartPrice % 2;
      const total = full + half;
      let hx = pk.x - (total * 9) / 2 + 4;
      for (let i = 0; i < full; i++) { this.priceHeart(g, hx, pk.y + 16, false); hx += 9; }
      if (half) this.priceHeart(g, hx, pk.y + 16, true);
    }
  }

  drawBomb(g, b) {
    const sp = PICKUP_SPRITES.bomb;
    const flash = Math.sin(b.flash) > 0.3;
    drawSprite(g, sp, b.x, b.y);
    if (flash) {
      g.save();
      g.globalAlpha = 0.8;
      drawSprite(g, flashSprite(sp), b.x, b.y);
      g.restore();
    }
  }

  drawMachine(g, m) {
    const x = m.px, y = m.py;
    if (m.kind === 'slot') {
      g.fillStyle = '#8a2020'; g.fillRect(x - 11, y - 26, 22, 28);
      g.fillStyle = '#c04040'; g.fillRect(x - 11, y - 26, 22, 4);
      g.fillStyle = '#2a2a2a'; g.fillRect(x - 8, y - 20, 16, 10);
      g.fillStyle = '#f0d070';
      const sym = Math.floor(this.time * 4) % 3;
      for (let i = 0; i < 3; i++) g.fillRect(x - 7 + i * 5, y - 18 + ((sym + i) % 3), 3, 6);
      g.fillStyle = '#9aa0a8'; g.fillRect(x + 10, y - 18, 3, 8);
      this.text(g, '1¢', x, y + 10, '#e8c04a', 'center', 7);
    } else {
      // 乞丐：一个裹着破布的小人
      g.fillStyle = '#6a5a48'; g.beginPath();
      g.ellipse(x, y - 10, 10, 13, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = PAL.skin; g.beginPath();
      g.ellipse(x, y - 18, 6, 6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = PAL.ink;
      g.fillRect(x - 3, y - 19, 2, 3); g.fillRect(x + 1, y - 19, 2, 3);
      this.text(g, '1¢', x, y + 10, '#e8c04a', 'center', 7);
    }
  }

  drawProjectiles(g, room) {
    for (const pr of room.projectiles) {
      // 逻辑坐标在地面，渲染时抬到弹丸该有的高度
      const y = pr.y - pr.z - pr.hz;
      if (pr.z > 2) shadow(g, pr.x, pr.y, pr.r * 0.7, 0.22);
      if (pr.knife) {
        // 飞刀：拉长的高光条
        g.save();
        g.translate(pr.x, y);
        g.rotate(Math.atan2(pr.vy, pr.vx));
        g.fillStyle = '#e8e0c0'; g.fillRect(-9, -2, 18, 3);
        g.fillStyle = '#8a6a3a'; g.fillRect(-11, -2, 4, 3);
        g.restore();
        continue;
      }
      // 快速移动的眼泪带一点拖影
      const speed = Math.hypot(pr.vx, pr.vy);
      if (speed > 200) {
        g.save();
        g.globalAlpha = 0.28;
        drawSprite(g, pr.sprite, pr.x - pr.vx * 0.014, y - pr.vy * 0.014);
        g.restore();
      }
      drawSprite(g, pr.sprite, pr.x, y);
    }
  }

  drawLasers(g, room) {
    for (const l of room.lasers) {
      const t = l.life / l.maxLife;
      const w = l.width * (0.5 + t * 0.5);
      g.save();
      g.translate(l.x, l.y - l.hz);
      g.rotate(Math.atan2(l.dy, l.dx));
      if (l.brimstone) {
        g.fillStyle = rgba('#6d0f14', 0.85 * t);
        g.fillRect(0, -w / 2, l.length, w);
        g.fillStyle = rgba('#e04a45', 0.9 * t);
        g.fillRect(0, -w / 4, l.length, w / 2);
        g.fillStyle = rgba('#ffd0c0', t);
        g.fillRect(0, -w / 8, l.length, Math.max(1, w / 4));
      } else {
        g.fillStyle = rgba('#8fd8ff', 0.5 * t);
        g.fillRect(0, -w / 2, l.length, w);
        g.fillStyle = rgba('#ffffff', 0.95 * t);
        g.fillRect(0, -1, l.length, 2);
      }
      g.restore();
    }
  }

  drawParticles(g, room) {
    for (const p of room.particles) {
      const t = p.life / p.maxLife;
      const s = Math.max(1, Math.round(p.size * (p.shrink ? t : 1)));
      g.globalAlpha = Math.min(1, t * 1.6);
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x - s / 2), Math.round(p.y - p.z - s / 2), s, s);
    }
    g.globalAlpha = 1;
  }

  drawExplosions(g, room) {
    for (const e of room.explosions) {
      const t = 1 - e.life / e.maxLife;
      const r = e.radius * (0.35 + t * 0.9);
      g.globalAlpha = (1 - t) * 0.85;
      const grad = g.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
      grad.addColorStop(0, '#fff0c0');
      grad.addColorStop(0.4, '#ff9020');
      grad.addColorStop(0.75, '#c03010');
      grad.addColorStop(1, 'rgba(60,20,10,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(e.x, e.y, r, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
  }

  drawTexts(g, room) {
    for (const t of room.texts) {
      g.globalAlpha = Math.min(1, t.life / t.maxLife * 1.8);
      this.text(g, t.text, t.x, t.y, t.color, 'center', t.size);
      g.globalAlpha = 1;
    }
  }

  // --- 门 -----------------------------------------------------------------

  /** 门框里侧那块「地板延伸」，让门看起来是嵌在墙里的 */
  drawDoorsInner(g, game, room) {
    for (let d = 0; d < 4; d++) {
      const door = room.node.doors[d];
      if (!door || door.hidden) continue;
      const open = room.doorPassable(d);
      if (!open) continue;
      const [cx, cy] = this.doorCenter(d);
      g.fillStyle = rgba('#000000', 0.5);
      if (d === 0 || d === 2) g.fillRect(cx - TILE * 0.75, d === 0 ? -4 : ROOM_PLAY_H - 4, TILE * 1.5, 8);
      else g.fillRect(d === 3 ? -4 : ROOM_PLAY_W - 4, cy - TILE * 0.75, 8, TILE * 1.5);
    }
  }

  doorCenter(dir) {
    if (dir === 0) return [ROOM_PLAY_W / 2, 0];
    if (dir === 1) return [ROOM_PLAY_W, ROOM_PLAY_H / 2];
    if (dir === 2) return [ROOM_PLAY_W / 2, ROOM_PLAY_H];
    return [0, ROOM_PLAY_H / 2];
  }

  drawDoors(g, game, room) {
    for (let d = 0; d < 4; d++) {
      const door = room.node.doors[d];
      if (!door) continue;
      if (door.hidden && !door.revealed) continue;
      const open = room.doorPassable(d) || (door.hidden && door.revealed && room.cleared);
      const style = door.style || 'normal';
      const sp = getDoorSprite(style, d, open);
      const [cx, cy] = this.doorCenter(d);
      // 换算到画布坐标（加上墙的偏移）
      const x = cx + WALL * TILE, y = cy + WALL * TILE;
      drawSprite(g, sp, x, y);
      // 上锁的门画一把锁
      if (door.locked) {
        g.fillStyle = PAL.gold;
        g.fillRect(Math.round(x - 3), Math.round(y - (d === 0 ? 14 : d === 2 ? -8 : 3)), 6, 7);
        g.fillStyle = PAL.ink;
        g.fillRect(Math.round(x - 1), Math.round(y - (d === 0 ? 12 : d === 2 ? -10 : 1)), 2, 3);
      }
    }
  }

  // --- 光照 / 氛围 ---------------------------------------------------------

  drawLighting(g, game, room) {
    // 火盆的暖光
    for (const o of room.obstacles) {
      if (o.kind !== 'fire') continue;
      const x = o.x + WALL * TILE, y = o.y + WALL * TILE;
      const flicker = 34 + Math.sin(this.time * 11 + o.tx) * 5;
      const grad = g.createRadialGradient(x, y, 0, x, y, flicker);
      grad.addColorStop(0, 'rgba(255,190,90,0.30)');
      grad.addColorStop(1, 'rgba(255,140,40,0)');
      g.fillStyle = grad;
      g.fillRect(x - flicker, y - flicker, flicker * 2, flicker * 2);
    }

    // 暗角：四周压暗，视线聚拢到中心
    if (!this._vignette) {
      const c = document.createElement('canvas');
      c.width = ROOM_PX_W; c.height = ROOM_PX_H;
      const vg = c.getContext('2d');
      const grad = vg.createRadialGradient(
        ROOM_PX_W / 2, ROOM_PX_H / 2, ROOM_PX_H * 0.35,
        ROOM_PX_W / 2, ROOM_PX_H / 2, ROOM_PX_W * 0.72
      );
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.42)');
      vg.fillStyle = grad;
      vg.fillRect(0, 0, ROOM_PX_W, ROOM_PX_H);
      this._vignette = c;
    }
    g.drawImage(this._vignette, 0, 0);

    // 受伤时全屏泛红
    if (game.player.hurtFlash > 0) {
      g.fillStyle = rgba('#c01818', game.player.hurtFlash * 0.5);
      g.fillRect(0, 0, ROOM_PX_W, ROOM_PX_H);
    }
  }

  /** 恶魔房价签上的一颗小红心 */
  priceHeart(g, x, y, half) {
    g.fillStyle = '#b21f24';
    g.beginPath();
    g.arc(x - 2, y - 1, 2.2, 0, Math.PI * 2);
    if (!half) g.arc(x + 2, y - 1, 2.2, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(x - 4.4, y);
    g.lineTo(x + (half ? 0 : 4.4), y);
    g.lineTo(x + (half ? 0 : 0), y + 4.2);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,160,150,0.85)';
    g.fillRect(Math.round(x - 3), Math.round(y - 3), 1, 1);
  }

  miniBar(g, x, y, ratio, w) {
    g.fillStyle = rgba('#000000', 0.6);
    g.fillRect(Math.round(x - w / 2) - 1, Math.round(y) - 1, w + 2, 4);
    g.fillStyle = '#b21f24';
    g.fillRect(Math.round(x - w / 2), Math.round(y), Math.round(w * Math.max(0, ratio)), 2);
  }

  /** 统一的像素字绘制（用系统等宽字体 + 关闭平滑逼近像素感） */
  text(g, str, x, y, color, align = 'left', size = 9) {
    g.font = `${size}px "Courier New", monospace`;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.85)';
    g.fillText(str, Math.round(x) + 1, Math.round(y) + 1);
    g.fillStyle = color;
    g.fillText(str, Math.round(x), Math.round(y));
    g.textAlign = 'left';
  }
}
