// HUD：血量、资源、主动道具、被动道具栏、小地图、Boss 血条、提示横幅。
// 布局照抄原作：血在左上，资源在血下面，主动道具左下，小地图右上。

import { makeSprite, pellipse, prect, pline, rgba } from './gfx.js';
import { ROOM_PX_W, ROOM_PX_H } from './tiles.js';
import { PAL, CHAPTERS } from './palette.js';
import { ROOM_TYPE } from './floor.js';
import { itemIcon } from './items.js';

/** HUD 用的小心形图标：full / half / empty / soul / black */
function heartIcon(kind) {
  return makeSprite(14, 13, (g) => {
    const cx = 7, cy = 6, r = 5;
    const colors = {
      full: ['#b21f24', '#ff7a70'],
      half: ['#b21f24', '#ff7a70'],
      empty: ['#4a3038', '#6a4a52'],
      soul: ['#7fb8e8', '#e0f4ff'],
      black: ['#3c2c48', '#7a5c94'],
    }[kind];
    const [base, lit] = colors;
    const put = (color, litColor, clipRight) => {
      pellipse(g, cx - r * 0.48, cy - r * 0.3, r * 0.6, r * 0.58, color);
      pellipse(g, cx + r * 0.48, cy - r * 0.3, r * 0.6, r * 0.58, color);
      for (let i = 0; i <= r * 1.3; i++) {
        const w = Math.max(1, (r * 1.15 - i * 0.9) * 2);
        prect(g, cx - w / 2, cy + i * 0.75, w, 1, color);
      }
      pellipse(g, cx - r * 0.55, cy - r * 0.45, r * 0.22, r * 0.2, litColor);
      if (clipRight) g.clearRect(cx, 0, 14, 13);
    };
    if (kind === 'half') {
      put('#4a3038', '#6a4a52', false);   // 先画空心底
      put(base, lit, true);               // 再补左半边实心
    } else {
      put(base, lit, false);
    }
  }, { ax: 0, ay: 0, outlineWidth: 1 });
}

const ICONS = {};
function buildHudIcons() {
  ICONS.full = heartIcon('full');
  ICONS.half = heartIcon('half');
  ICONS.empty = heartIcon('empty');
  ICONS.soul = heartIcon('soul');
  ICONS.black = heartIcon('black');

  ICONS.coin = makeSprite(12, 12, (g) => {
    pellipse(g, 6, 6, 5, 5, '#c98a3a');
    pellipse(g, 6, 6, 3.4, 3.4, '#e8b060');
    pellipse(g, 6, 5.5, 1.8, 2, '#a06a20');
  }, { ax: 0, ay: 0 });

  ICONS.bomb = makeSprite(12, 13, (g) => {
    pellipse(g, 6, 8, 4.6, 4.6, '#2e2e34');
    pellipse(g, 4.5, 6.5, 1.6, 1.3, '#6a6a74');
    prect(g, 5, 2, 2, 3, '#4a4a52');
    pline(g, 6, 2, 8, 0, '#c8a060');
  }, { ax: 0, ay: 0 });

  ICONS.key = makeSprite(11, 13, (g) => {
    pellipse(g, 5, 3.5, 3, 3, PAL.gold);
    pellipse(g, 5, 3.5, 1.3, 1.3, PAL.ink);
    prect(g, 4, 6, 2, 6, PAL.gold);
    prect(g, 6, 8, 2, 1.5, PAL.gold);
    prect(g, 6, 10, 2, 1.5, PAL.gold);
  }, { ax: 0, ay: 0 });
}

export class Hud {
  constructor(renderer) {
    this.r = renderer;
    buildHudIcons();
    this.banner = null;
    this.bannerTime = 0;
    this.toast = null;
    this.toastTime = 0;
  }

  showItem(item) {
    this.banner = item;
    this.bannerTime = 2.6;
  }

  showToast(text, color = '#ffe694') {
    this.toast = { text, color };
    this.toastTime = 1.8;
  }

  update(dt) {
    if (this.bannerTime > 0) { this.bannerTime -= dt; if (this.bannerTime <= 0) this.banner = null; }
    if (this.toastTime > 0) { this.toastTime -= dt; if (this.toastTime <= 0) this.toast = null; }
  }

  draw(g, game) {
    const p = game.player;
    g.setTransform(1, 0, 0, 1, 0, 0);

    this.drawHearts(g, p);
    this.drawResources(g, p);
    this.drawActive(g, p);
    this.drawPassives(g, p);
    this.drawMinimap(g, game);
    this.drawBossBar(g, game);
    this.drawBanner(g, game);
    this.drawLevelLabel(g, game);
  }

  drawHearts(g, p) {
    const perRow = 6;
    const containers = Math.ceil(p.maxHearts / 2);
    let drawn = 0;
    // 红心容器
    for (let i = 0; i < containers; i++) {
      const filled = p.redHearts - i * 2;
      const kind = filled >= 2 ? 'full' : filled === 1 ? 'half' : 'empty';
      const x = 5 + (drawn % perRow) * 13;
      const y = 5 + Math.floor(drawn / perRow) * 12;
      g.drawImage(ICONS[kind].canvas, x, y);
      drawn++;
    }
    // 魂心（半颗为单位，两个半颗画一整颗）
    const soulFull = Math.floor(p.soulHearts / 2), soulHalf = p.soulHearts % 2;
    for (let i = 0; i < soulFull; i++) {
      const x = 5 + (drawn % perRow) * 13, y = 5 + Math.floor(drawn / perRow) * 12;
      g.drawImage(ICONS.soul.canvas, x, y);
      drawn++;
    }
    if (soulHalf) {
      const x = 5 + (drawn % perRow) * 13, y = 5 + Math.floor(drawn / perRow) * 12;
      g.save();
      g.beginPath(); g.rect(x, y, 7, 13); g.clip();
      g.drawImage(ICONS.soul.canvas, x, y);
      g.restore();
      drawn++;
    }
    this.heartRows = Math.ceil(drawn / perRow) || 1;
  }

  drawResources(g, p) {
    const y = 5 + this.heartRows * 12 + 2;
    const item = (icon, value, ix) => {
      const x = 5 + ix * 30;
      g.drawImage(icon.canvas, x, y);
      this.r.text(g, `${value}`, x + 14, y + 7, '#f0e8d8', 'left', 9);
    };
    item(ICONS.coin, p.coins, 0);
    item(ICONS.bomb, p.bombs, 1);
    item(ICONS.key, p.keys, 2);
  }

  drawActive(g, p) {
    if (!p.activeItem) return;
    const x = 5, y = ROOM_PX_H - 32;
    // 外框
    g.fillStyle = rgba('#000000', 0.5);
    g.fillRect(x, y, 27, 27);
    g.strokeStyle = rgba('#f0e8d8', 0.55);
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y + 0.5, 26, 26);

    const ic = itemIcon(p.activeItem);
    const ready = p.activeCharge >= p.activeItem.charge;
    g.save();
    if (!ready) g.globalAlpha = 0.45;
    g.drawImage(ic.canvas, x + 3, y + 3);
    g.restore();

    // 充能条：竖直的分段格
    const segs = p.activeItem.charge;
    const bh = 25 / segs;
    for (let i = 0; i < segs; i++) {
      const filled = i < p.activeCharge;
      g.fillStyle = filled ? (ready ? '#ffe694' : '#8fd8ff') : rgba('#000000', 0.55);
      g.fillRect(x + 28, y + 25 - (i + 1) * bh + 1, 3, bh - 1);
    }
    if (ready) {
      const pulse = 0.3 + Math.sin(this.r.time * 5) * 0.2;
      g.strokeStyle = rgba('#ffe694', pulse);
      g.strokeRect(x - 0.5, y - 0.5, 28, 28);
    }
  }

  drawPassives(g, p) {
    // 右下角一排小图标，显示已获得的被动道具
    const max = 10;
    const list = p.items.slice(-max);
    list.forEach((it, i) => {
      const x = ROOM_PX_W - 16 - (list.length - 1 - i) * 15;
      const y = ROOM_PX_H - 17;
      g.save();
      g.globalAlpha = 0.9;
      g.drawImage(itemIcon(it).canvas, x - 5, y - 6, 15, 15);
      g.restore();
    });
    if (p.items.length > max) {
      this.r.text(g, `+${p.items.length - max}`, ROOM_PX_W - 16 - max * 15, ROOM_PX_H - 10, '#c8bea0', 'right', 8);
    }
  }

  // --- 小地图 -------------------------------------------------------------

  drawMinimap(g, game) {
    const floor = game.floor;
    const compass = !!game.player.flags.compass;
    const isKnown = (r) => r.visited || r.adjacentVisited ||
      (compass && r.type !== ROOM_TYPE.SECRET && r.type !== ROOM_TYPE.SUPER_SECRET);

    // 底框只贴合「已知」的那部分地图，而不是整层 ——
    // 否则探索初期会有一大块空白黑板压在房间画面上。
    const known = floor.rooms.filter(isKnown);
    if (!known.length) return;
    const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const r of known) {
      b.x0 = Math.min(b.x0, r.x); b.y0 = Math.min(b.y0, r.y);
      b.x1 = Math.max(b.x1, r.x); b.y1 = Math.max(b.y1, r.y);
    }
    const cell = 7, gap = 1;
    const w = (b.x1 - b.x0 + 1) * (cell + gap) - gap;
    const h = (b.y1 - b.y0 + 1) * (cell + gap) - gap;
    const ox = ROOM_PX_W - w - 6, oy = 6;

    g.fillStyle = rgba('#000000', 0.38);
    g.fillRect(ox - 3, oy - 3, w + 6, h + 6);

    for (const r of known) {
      const x = ox + (r.x - b.x0) * (cell + gap);
      const y = oy + (r.y - b.y0) * (cell + gap);
      const current = r === game.node;

      let fill = r.visited ? '#c8bea0' : '#6a6254';
      if (r.type === ROOM_TYPE.BOSS) fill = r.visited ? '#d06a5a' : '#7a4038';
      if (!r.visited && !compass && r.type !== ROOM_TYPE.NORMAL && r.type !== ROOM_TYPE.BOSS) fill = '#6a6254';

      g.fillStyle = fill;
      g.fillRect(x, y, cell, cell);

      // 房间类型标记
      const mark = {
        [ROOM_TYPE.BOSS]: '#2a1010',
        [ROOM_TYPE.TREASURE]: '#e8c04a',
        [ROOM_TYPE.SHOP]: '#4ad0e8',
        [ROOM_TYPE.CURSE]: '#8c1f2e',
        [ROOM_TYPE.SACRIFICE]: '#c22b2b',
        [ROOM_TYPE.ARCADE]: '#8a6ad8',
        [ROOM_TYPE.MINIBOSS]: '#e88a3a',
        [ROOM_TYPE.SECRET]: '#8a8a8a',
        [ROOM_TYPE.SUPER_SECRET]: '#8a8a8a',
        [ROOM_TYPE.START]: '#4a4a4a',
        [ROOM_TYPE.DEVIL]: '#8c1f2e',
        [ROOM_TYPE.ANGEL]: '#8fd8ff',
      }[r.type];
      if (mark && (r.visited || compass)) {
        g.fillStyle = mark;
        if (r.type === ROOM_TYPE.BOSS) {
          // Boss 房画个小骷髅
          g.fillRect(x + 2, y + 2, 4, 3);
          g.fillRect(x + 3, y + 5, 2, 1);
        } else if (r.type === ROOM_TYPE.START) {
          g.fillRect(x + 3, y + 3, 2, 2);
        } else {
          g.fillRect(x + 2, y + 2, 4, 4);
        }
      }

      if (current) {
        g.strokeStyle = '#ffffff';
        g.lineWidth = 1;
        g.strokeRect(x - 0.5, y - 0.5, cell + 1, cell + 1);
      }
    }
  }

  drawBossBar(g, game) {
    const b = game.room?.boss;
    if (!b || b.dead) return;
    const w = 150, h = 7;
    const x = (ROOM_PX_W - w) / 2, y = ROOM_PX_H - 16;
    g.fillStyle = rgba('#000000', 0.6);
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle = '#3a1010';
    g.fillRect(x, y, w, h);
    const ratio = Math.max(0, b.hp / b.maxHp);
    g.fillStyle = b.enraged ? '#e04a45' : '#b21f24';
    g.fillRect(x, y, Math.round(w * ratio), h);
    g.fillStyle = rgba('#ffffff', 0.18);
    g.fillRect(x, y, Math.round(w * ratio), 2);
    this.r.text(g, b.name, ROOM_PX_W / 2, y - 7, '#f0e8d8', 'center', 9);
  }

  drawBanner(g, game) {
    if (this.banner) {
      const t = Math.min(1, (2.6 - this.bannerTime) * 5);
      const alpha = this.bannerTime < 0.4 ? this.bannerTime / 0.4 : Math.min(1, t);
      const y = ROOM_PX_H / 2 + 44;
      g.save();
      g.globalAlpha = alpha;
      g.fillStyle = rgba('#000000', 0.62);
      g.fillRect(ROOM_PX_W / 2 - 90, y - 13, 180, 26);
      g.drawImage(itemIcon(this.banner).canvas, ROOM_PX_W / 2 - 85, y - 11);
      this.r.text(g, this.banner.name, ROOM_PX_W / 2 + 8, y - 4, '#ffe694', 'center', 10);
      this.r.text(g, this.banner.desc, ROOM_PX_W / 2 + 8, y + 6, '#c8bea0', 'center', 8);
      g.restore();
    }
    if (this.toast) {
      const alpha = Math.min(1, this.toastTime / 0.5);
      g.save();
      g.globalAlpha = alpha;
      this.r.text(g, this.toast.text, ROOM_PX_W / 2, ROOM_PX_H / 2 - 60, this.toast.color, 'center', 10);
      g.restore();
    }
  }

  drawLevelLabel(g, game) {
    const chapter = CHAPTERS[Math.min(CHAPTERS.length - 1, Math.floor((game.level - 1) / 2))];
    const sub = (game.level - 1) % 2 + 1;
    this.r.text(g, `${chapter.name} ${sub}`, ROOM_PX_W - 6, ROOM_PX_H - 26, '#c8bea0', 'right', 9);
  }
}
