// 道具系统。属性模型直接照搬原作：
//   每秒射击次数 = 30 / (tearDelay + 1)
//   基础值：damage 3.5 / tearDelay 10 / speed 1.0 / range 6.5 / shotSpeed 1.0 / luck 0
// 道具通过 apply() 修改属性，或挂上 flag 改变射击行为。

import { makeSprite, pellipse, prect, pline, pset, phalf, rgba } from './gfx.js';
import { PAL } from './palette.js';
import { pentagram } from './tiles.js';

export const BASE_STATS = {
  damage: 3.5,
  tearDelay: 10,
  speed: 1.0,
  range: 6.5,
  shotSpeed: 1.0,
  luck: 0,
};

const ICON = 22;

function icon(drawFn) {
  return makeSprite(ICON, ICON, drawFn, { ax: ICON / 2, ay: ICON / 2, outlineWidth: 1 });
}

// --- 各道具图标的绘制函数 ---------------------------------------------------

const eyeball = (g, cx, cy, r, iris = PAL.tearDark) => {
  pellipse(g, cx, cy, r, r, '#f4f0e4');
  pellipse(g, cx, cy, r * 0.55, r * 0.55, iris);
  pellipse(g, cx, cy, r * 0.28, r * 0.28, PAL.ink);
  pset(g, cx - r * 0.3, cy - r * 0.3, PAL.white);
};

const heartIcon = (g, cx, cy, r, color, lit) => {
  pellipse(g, cx - r * 0.5, cy - r * 0.3, r * 0.6, r * 0.6, color);
  pellipse(g, cx + r * 0.5, cy - r * 0.3, r * 0.6, r * 0.6, color);
  for (let i = 0; i <= r * 1.25; i++) {
    const w = Math.max(1, (r * 1.2 - i * 0.95) * 2);
    prect(g, cx - w / 2, cy + i * 0.78, w, 1, color);
  }
  pellipse(g, cx - r * 0.55, cy - r * 0.45, r * 0.22, r * 0.2, lit);
};

// --- 道具表 -----------------------------------------------------------------
// quality: 0-4，用于抽取权重；tags 用于分池
export const ITEMS = [
  {
    id: 'sad_onion', name: '悲伤洋葱', desc: '射速提升',
    quality: 1, pool: ['treasure', 'shop'],
    icon: () => icon((g) => {
      pellipse(g, 11, 13, 7, 7, '#e8d8a0');
      pellipse(g, 11, 13, 4, 6, '#f4ecc8');
      pline(g, 11, 6, 11, 2, '#7aa24a');
      pline(g, 11, 5, 14, 2, '#7aa24a');
      pellipse(g, 8, 12, 1.2, 1.6, PAL.ink);
      pellipse(g, 14, 12, 1.2, 1.6, PAL.ink);
      prect(g, 7, 15, 2, 3, PAL.tear);
      prect(g, 13, 15, 2, 3, PAL.tear);
    }),
    apply: (s) => { s.tearDelay -= 1; },
  },
  {
    id: 'inner_eye', name: '内在之眼', desc: '三连发，射速下降',
    quality: 3, pool: ['treasure'],
    icon: () => icon((g) => {
      eyeball(g, 11, 11, 8, '#b04a8a');
      pline(g, 3, 11, 19, 11, rgba(PAL.ink, 0.35));
    }),
    apply: (s) => { s.tearDelay += 3; },
    flags: { multiShot: 3 },
  },
  {
    id: 'twenty_twenty', name: '20/20', desc: '双连发',
    quality: 3, pool: ['treasure', 'shop'],
    icon: () => icon((g) => {
      eyeball(g, 7, 11, 5.5);
      eyeball(g, 15, 11, 5.5);
    }),
    flags: { multiShot: 2 },
  },
  {
    id: 'mutant_spider', name: '变异蜘蛛', desc: '四连发，伤害下降',
    quality: 4, pool: ['treasure'],
    icon: () => icon((g) => {
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
        pline(g, 11, 12, 11 + s * (7 + i), 16 - i * 3, PAL.ink);
      }
      pellipse(g, 11, 11, 7, 6, '#4a4258');
      pellipse(g, 8, 9, 1.6, 2, PAL.blood);
      pellipse(g, 14, 9, 1.6, 2, PAL.blood);
    }),
    apply: (s) => { s.damage *= 0.6; },
    flags: { multiShot: 4 },
  },
  {
    id: 'magic_mushroom', name: '魔法蘑菇', desc: '全属性提升，上限 +1',
    quality: 4, pool: ['treasure'],
    icon: () => icon((g) => {
      prect(g, 8, 12, 6, 8, '#f0e4c8');
      phalf(g, 11, 12, 9, 8, '#e04a4a', 'top');
      for (const [x, y] of [[6, 9], [11, 6], [16, 10], [8, 12]]) {
        pellipse(g, x, y, 2, 1.6, '#f8f0e0');
      }
    }),
    apply: (s) => { s.damage += 1; s.speed += 0.3; s.range += 1.5; },
    hpUp: 1, heal: 2,
  },
  {
    id: 'crickets_head', name: '蟋蟀之头', desc: '伤害 ×1.5',
    quality: 4, pool: ['treasure'],
    icon: () => icon((g) => {
      pellipse(g, 11, 12, 8, 7, '#7c9a3a');
      pellipse(g, 8, 10, 2, 2.4, PAL.blood);
      pellipse(g, 14, 10, 2, 2.4, PAL.blood);
      pline(g, 6, 6, 9, 3, PAL.ink);
      pline(g, 16, 6, 13, 3, PAL.ink);
      prect(g, 8, 15, 6, 2, PAL.bloodDark);
    }),
    apply: (s) => { s.damage = s.damage * 1.5; },
  },
  {
    id: 'number_one', name: '一号', desc: '射速大幅提升，射程下降',
    quality: 2, pool: ['treasure', 'shop'],
    icon: () => icon((g) => {
      pellipse(g, 11, 13, 7, 7, '#f0e070');
      prect(g, 9, 5, 4, 8, '#f8f0a0');
      pline(g, 11, 3, 11, 6, PAL.tear);
      pset(g, 11, 2, PAL.tearLit);
    }),
    apply: (s) => { s.tearDelay -= 3; s.range -= 2.5; },
  },
  {
    id: 'brimstone', name: '硫磺火', desc: '蓄力后发射血焰激光',
    quality: 4, pool: ['devil'],
    icon: () => icon((g) => {
      pellipse(g, 11, 11, 8, 8, '#3a1a1a');
      pellipse(g, 11, 11, 5, 5, PAL.blood);
      pellipse(g, 11, 11, 2.5, 2.5, '#ff6a4a');
      pline(g, 4, 4, 7, 7, PAL.blood);
      pline(g, 18, 4, 15, 7, PAL.blood);
    }),
    apply: (s) => { s.damage *= 1.6; s.tearDelay += 12; },
    flags: { brimstone: true },
  },
  {
    id: 'polyphemus', name: '独眼巨人', desc: '巨型单发，伤害翻倍',
    quality: 4, pool: ['treasure'],
    icon: () => icon((g) => {
      eyeball(g, 11, 11, 9, '#c85a3a');
      prect(g, 3, 3, 4, 3, PAL.blood);
    }),
    apply: (s) => { s.damage = s.damage * 2 + 1; s.tearDelay += 5; },
    flags: { bigTear: true, pierce: true },
  },
  {
    id: 'technology', name: '科技', desc: '眼泪变成瞬发激光',
    quality: 4, pool: ['treasure'],
    icon: () => icon((g) => {
      prect(g, 2, 9, 18, 5, PAL.metal);
      prect(g, 2, 9, 18, 2, PAL.metalLit);
      pellipse(g, 6, 11, 2.5, 2.5, '#ff4a4a');
      pellipse(g, 16, 11, 2.5, 2.5, '#ff4a4a');
      pline(g, 18, 11, 21, 11, '#ff8a4a');
    }),
    apply: (s) => { s.damage *= 0.9; },
    flags: { laser: true, pierce: true },
  },
  {
    id: 'spoon_bender', name: '弯勺人', desc: '眼泪追踪敌人',
    quality: 3, pool: ['treasure', 'shop'],
    icon: () => icon((g) => {
      pellipse(g, 8, 6, 3.5, 4, PAL.metalLit);
      pline(g, 9, 10, 13, 18, PAL.metal);
      pline(g, 10, 10, 14, 18, PAL.metalLit);
      pellipse(g, 15, 8, 2, 2, '#c86ad8');
      pellipse(g, 5, 14, 2, 2, '#c86ad8');
    }),
    flags: { homing: true },
  },
  {
    id: 'cupids_arrow', name: '丘比特之箭', desc: '眼泪穿透敌人',
    quality: 2, pool: ['treasure', 'shop'],
    icon: () => icon((g) => {
      pline(g, 3, 18, 18, 4, '#c8a060');
      pline(g, 18, 4, 14, 5, PAL.metalLit);
      pline(g, 18, 4, 17, 8, PAL.metalLit);
      heartIcon(g, 7, 8, 4, PAL.blood, '#ff8a80');
    }),
    flags: { pierce: true },
  },
  {
    id: 'sacred_heart', name: '圣心', desc: '追踪 + 伤害大幅提升',
    quality: 4, pool: ['angel'],
    icon: () => icon((g) => {
      heartIcon(g, 11, 11, 7, '#e04a5a', '#ffb0b0');
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        pset(g, 11 + Math.cos(a) * 10, 11 + Math.sin(a) * 10, rgba('#fff0a0', 0.9));
      }
    }),
    apply: (s) => { s.damage = s.damage * 2.3; s.tearDelay += 2; },
    flags: { homing: true },
    heal: 2,
  },
  {
    id: 'ipecac', name: '吐根糖浆', desc: '发射抛物线爆炸弹',
    quality: 3, pool: ['treasure'],
    icon: () => icon((g) => {
      prect(g, 7, 6, 8, 13, '#6a9a4a');
      prect(g, 8, 3, 6, 4, '#4a6a3a');
      pellipse(g, 11, 12, 3, 4, '#a8d878');
      pset(g, 10, 10, PAL.white);
    }),
    apply: (s) => { s.damage += 40; s.tearDelay += 10; s.shotSpeed *= 0.75; },
    flags: { explosive: true, arc: true },
  },
  { id: 'lunch', name: '午餐', desc: '生命上限 +1', quality: 0, pool: ['treasure', 'shop'],
    icon: () => icon((g) => {
      pellipse(g, 11, 13, 8, 5, '#c8a060');
      pellipse(g, 11, 10, 7, 4, '#e8c890');
      prect(g, 5, 12, 12, 2, '#8a4a3a');
    }),
    hpUp: 1, heal: 2 },
  { id: 'dinner', name: '晚餐', desc: '生命上限 +1', quality: 0, pool: ['treasure', 'shop'],
    icon: () => icon((g) => {
      pellipse(g, 11, 13, 9, 5, '#d8d0c0');
      pellipse(g, 11, 11, 5, 3.5, '#a05a3a');
      pline(g, 3, 8, 3, 18, PAL.metal);
    }),
    hpUp: 1, heal: 2 },
  {
    id: 'pentagram', name: '五芒星', desc: '伤害 +1',
    quality: 2, pool: ['devil', 'treasure'],
    icon: () => icon((g) => {
      pellipse(g, 11, 11, 9, 9, '#3a2a3a');
      pentagram(g, 11, 11, 8, '#e8c04a');
    }),
    apply: (s) => { s.damage += 1; },
  },
  {
    id: 'blood_martyr', name: '殉道者之血', desc: '伤害 +1',
    quality: 2, pool: ['treasure', 'shop'],
    icon: () => icon((g) => {
      prect(g, 9, 3, 4, 16, '#d8d0b0');
      prect(g, 4, 8, 14, 4, '#d8d0b0');
      prect(g, 9, 12, 4, 6, PAL.blood);
      pset(g, 11, 19, PAL.bloodDark);
    }),
    apply: (s) => { s.damage += 1; },
  },
  {
    id: 'steven', name: '史蒂文', desc: '伤害 +1',
    quality: 1, pool: ['treasure'],
    icon: () => icon((g) => {
      pellipse(g, 11, 12, 8, 8, PAL.skin);
      pellipse(g, 8, 10, 2, 2.4, PAL.ink);
      pellipse(g, 14, 10, 2, 2.4, PAL.ink);
      pline(g, 7, 16, 15, 16, PAL.ink);
      pline(g, 6, 5, 16, 5, PAL.ink);
    }),
    apply: (s) => { s.damage += 1; },
  },
  {
    id: 'halo', name: '光环', desc: '全属性小幅提升，上限 +1',
    quality: 4, pool: ['angel'],
    icon: () => icon((g) => {
      pellipse(g, 11, 11, 9, 5, '#f8e070');
      pellipse(g, 11, 11, 6, 2.6, '#2a2418');
      pellipse(g, 11, 11, 9, 5, rgba('#fff0a0', 0.2));
    }),
    apply: (s) => { s.damage += 0.5; s.speed += 0.1; s.range += 1; s.tearDelay -= 0.5; },
    hpUp: 1, heal: 2,
  },
  {
    id: 'speed_ball', name: '速度球', desc: '移速与弹速提升',
    quality: 2, pool: ['treasure', 'shop'],
    icon: () => icon((g) => {
      pellipse(g, 11, 11, 8, 8, '#4a7ad8');
      pellipse(g, 11, 11, 4, 4, '#a0d0f8');
      pline(g, 2, 6, 8, 6, rgba(PAL.white, 0.7));
      pline(g, 1, 10, 6, 10, rgba(PAL.white, 0.5));
    }),
    apply: (s) => { s.speed += 0.3; s.shotSpeed += 0.3; },
  },
  {
    id: 'belt', name: '皮带', desc: '移速提升',
    quality: 1, pool: ['treasure', 'shop'],
    icon: () => icon((g) => {
      prect(g, 2, 8, 18, 6, '#5a3a24');
      prect(g, 8, 6, 7, 10, PAL.gold);
      prect(g, 10, 8, 3, 6, '#5a3a24');
    }),
    apply: (s) => { s.speed += 0.3; },
  },
  {
    id: 'roid_rage', name: '类固醇狂怒', desc: '移速与射程提升',
    quality: 1, pool: ['treasure', 'shop'],
    icon: () => icon((g) => {
      prect(g, 6, 5, 10, 14, '#d8a848');
      prect(g, 8, 3, 6, 3, '#f0d078');
      prect(g, 7, 9, 8, 6, '#c85a3a');
    }),
    apply: (s) => { s.speed += 0.3; s.range += 1.5; },
  },
  {
    id: 'my_reflection', name: '我的倒影', desc: '射程与伤害提升',
    quality: 2, pool: ['treasure'],
    icon: () => icon((g) => {
      pellipse(g, 11, 11, 8, 9, '#c8d8e8');
      pellipse(g, 11, 11, 6, 7, '#8ab0d0');
      pline(g, 7, 6, 14, 15, rgba(PAL.white, 0.8));
      pline(g, 9, 5, 15, 12, rgba(PAL.white, 0.5));
    }),
    apply: (s) => { s.range += 2.5; s.damage += 0.5; },
  },
  {
    id: 'compass', name: '指南针', desc: '在地图上显示特殊房间',
    quality: 1, pool: ['treasure', 'shop'],
    icon: () => icon((g) => {
      pellipse(g, 11, 11, 9, 9, PAL.gold);
      pellipse(g, 11, 11, 7, 7, '#f0ecd8');
      pline(g, 11, 11, 15, 6, PAL.blood);
      pline(g, 11, 11, 7, 16, PAL.metalDark);
      pset(g, 11, 11, PAL.ink);
    }),
    flags: { compass: true },
  },
  {
    id: 'dead_cat', name: '死猫', desc: '生命上限归 1，获得 9 条命',
    quality: 4, pool: ['devil'],
    icon: () => icon((g) => {
      pellipse(g, 11, 13, 8, 7, '#3a3a44');
      pline(g, 5, 8, 7, 3, '#3a3a44');
      pline(g, 17, 8, 15, 3, '#3a3a44');
      pset(g, 8, 12, '#f0e060');
      pset(g, 14, 12, '#f0e060');
      pline(g, 4, 12, 8, 13, PAL.white);
      pline(g, 14, 13, 18, 12, PAL.white);
    }),
    flags: { deadCat: true },
  },
  {
    id: 'wafer', name: '圣饼', desc: '所有伤害减半',
    quality: 4, pool: ['angel'],
    icon: () => icon((g) => {
      pellipse(g, 11, 11, 9, 9, '#f0ecd8');
      pellipse(g, 11, 11, 7, 7, '#e0d8be');
      prect(g, 10, 6, 2, 10, '#c0b898');
      prect(g, 6, 10, 10, 2, '#c0b898');
    }),
    flags: { wafer: true },
  },
  {
    id: 'moms_knife', name: '妈妈的刀', desc: '发射高速穿透飞刀',
    quality: 4, pool: ['devil'],
    icon: () => icon((g) => {
      pline(g, 4, 18, 17, 5, PAL.metalLit);
      pline(g, 5, 19, 18, 6, PAL.metal);
      prect(g, 2, 16, 5, 4, '#5a3a24');
      pellipse(g, 15, 6, 2, 2, PAL.blood);
    }),
    apply: (s) => { s.damage *= 1.4; s.shotSpeed += 0.8; s.range += 3; },
    flags: { pierce: true, knife: true },
  },
];

// --- 主动道具 ---------------------------------------------------------------
export const ACTIVE_ITEMS = [
  {
    id: 'yum_heart', name: '美味之心', desc: '回复 1 颗心', charge: 4,
    icon: () => icon((g) => heartIcon(g, 11, 11, 8, '#e04a5a', '#ffb0b0')),
    use: (game) => { game.player.heal(2); return true; },
  },
  {
    id: 'book_belial', name: '彼列之书', desc: '本房间内伤害翻倍', charge: 3,
    icon: () => icon((g) => {
      prect(g, 3, 4, 16, 14, '#5a1a1a');
      prect(g, 5, 6, 12, 10, '#3a0f0f');
      pentagram(g, 11, 11, 4.5, PAL.gold);
    }),
    use: (game) => { game.player.addBuff('damage', 1.0, 30); return true; },
  },
  {
    id: 'tammys_head', name: '塔米之头', desc: '向四周射出一圈眼泪', charge: 2,
    icon: () => icon((g) => {
      pellipse(g, 11, 12, 8, 8, '#e8b8c0');
      pellipse(g, 8, 10, 2, 2.4, PAL.ink);
      pellipse(g, 14, 10, 2, 2.4, PAL.ink);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        pset(g, 11 + Math.cos(a) * 10, 12 + Math.sin(a) * 10, PAL.tear);
      }
    }),
    use: (game) => { game.player.burstShot(10); return true; },
  },
  {
    id: 'bobs_head', name: '鲍勃的烂头', desc: '扔出一颗毒炸弹', charge: 3,
    icon: () => icon((g) => {
      pellipse(g, 11, 12, 8, 8, '#6a8a4a');
      pellipse(g, 8, 10, 2, 2.4, PAL.ink);
      pellipse(g, 14, 10, 2, 2.4, PAL.ink);
      pline(g, 11, 4, 13, 1, '#c8a060');
      pellipse(g, 7, 16, 1.6, 1.4, '#a8c878');
    }),
    use: (game) => { game.player.throwBomb(true); return true; },
  },
  {
    id: 'd6', name: 'D6', desc: '重掷当前房间的道具', charge: 6,
    icon: () => icon((g) => {
      prect(g, 3, 3, 16, 16, '#e8e4d8');
      prect(g, 5, 5, 12, 12, '#f4f0e4');
      for (const [x, y] of [[8, 7], [14, 7], [8, 11], [14, 11], [8, 15], [14, 15]]) {
        pellipse(g, x, y, 1.4, 1.4, PAL.ink);
      }
    }),
    use: (game) => game.rerollRoomItems(),
  },
];

// 图标惰性构建：首次访问时才画，避免启动时一次性烘焙全部
const iconCache = new Map();
export function itemIcon(item) {
  if (!iconCache.has(item.id)) iconCache.set(item.id, item.icon());
  return iconCache.get(item.id);
}

/** 按池子抽取道具，避开已拥有的 */
export function rollItem(rng, pool, owned) {
  let candidates = ITEMS.filter((it) => it.pool.includes(pool) && !owned.has(it.id));
  if (!candidates.length) candidates = ITEMS.filter((it) => !owned.has(it.id));
  if (!candidates.length) candidates = ITEMS;
  // 品质越高越稀有
  const weighted = candidates.map((it) => ({ w: Math.max(1, 5 - it.quality), v: it }));
  return rng.weighted(weighted).v;
}

export function rollActive(rng, owned) {
  const candidates = ACTIVE_ITEMS.filter((it) => !owned.has(it.id));
  return rng.pick(candidates.length ? candidates : ACTIVE_ITEMS);
}

/** 根据已拥有的道具重算属性 */
export function computeStats(items, activeBuffs) {
  const s = { ...BASE_STATS };
  for (const it of items) {
    if (it.apply) it.apply(s);
  }
  for (const b of activeBuffs) {
    if (b.stat === 'damage') s.damage += b.amount;
    if (b.stat === 'speed') s.speed += b.amount;
  }
  // 原作的上下限
  s.tearDelay = Math.max(1, s.tearDelay);
  s.damage = Math.max(0.5, s.damage);
  s.speed = Math.max(0.1, Math.min(2.0, s.speed));
  s.shotSpeed = Math.max(0.5, Math.min(2.5, s.shotSpeed));
  s.range = Math.max(2, s.range);
  return s;
}

/** 每秒射击次数 —— 原作公式 */
export const tearsPerSecond = (tearDelay) => 30 / (tearDelay + 1);
