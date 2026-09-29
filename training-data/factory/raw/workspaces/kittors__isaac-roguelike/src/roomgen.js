// 房间内容生成：障碍物布局 + 敌人投放 + 特殊房陈设。
// 原作用的是成千上万个手工房间池，这里用「手工模板 + 对称程序化生成 + 变异」
// 来逼近那种「每个房间都像被设计过」的手感，同时保留 roguelike 的随机性。

import { ROOM_W, ROOM_H } from './tiles.js';
import { ROOM_TYPE } from './floor.js';

// 模板图例：
//   .空  #石头  P便便  X金属块  ^尖刺  O坑  F火盆  T炸药  W蛛网
//   e 普通敌人位   E 强力敌人位
const TEMPLATES = [
  // 空旷 —— 纯敌人房
  [
    '.............',
    '..e.......e..',
    '.............',
    '.....e.e.....',
    '.............',
    '..e.......e..',
    '.............',
  ],
  // 四角石堆
  [
    '.##.......##.',
    '.#.e.....e.#.',
    '.............',
    '....#.e.#....',
    '.............',
    '.#.e.....e.#.',
    '.##.......##.',
  ],
  // 中央石环
  [
    '.............',
    '...#######...',
    '...#..e..#...',
    '...#.e.e.#...',
    '...#..e..#...',
    '...#######...',
    '.............',
  ],
  // 纵向柱廊
  [
    '..#..#.#..#..',
    '..#e.#.#.e#..',
    '..#..#.#..#..',
    '.............',
    '..#..#.#..#..',
    '..#e.#.#.e#..',
    '..#..#.#..#..',
  ],
  // 深坑房：飞行敌人优势
  [
    '.OOO.....OOO.',
    '.OOO..e..OOO.',
    '.............',
    '...e..E..e...',
    '.............',
    '.OOO..e..OOO.',
    '.OOO.....OOO.',
  ],
  // 尖刺走廊
  [
    '..^^^...^^^..',
    '.....e.e.....',
    '..#.......#..',
    '.............',
    '..#.......#..',
    '.....e.e.....',
    '..^^^...^^^..',
  ],
  // 便便花园
  [
    '.P.P.....P.P.',
    '..e.......e..',
    '.P....P....P.',
    '......E......',
    '.P....P....P.',
    '..e.......e..',
    '.P.P.....P.P.',
  ],
  // 火盆祭坛
  [
    '.............',
    '..F.......F..',
    '.....###.....',
    '..e..#E#..e..',
    '.....###.....',
    '..F.......F..',
    '.............',
  ],
  // 对角石带
  [
    '####.....####',
    '...#..e..#...',
    '....#...#....',
    '..e..E.E..e..',
    '....#...#....',
    '...#..e..#...',
    '####.....####',
  ],
  // 炸药堆
  [
    '.............',
    '..T.T...T.T..',
    '.............',
    '...e..E..e...',
    '.............',
    '..T.T...T.T..',
    '.............',
  ],
  // 蜘蛛巢
  [
    'W...........W',
    '...e.....e...',
    '..W.......W..',
    '......E......',
    '..W.......W..',
    '...e.....e...',
    'W...........W',
  ],
  // 金属牢笼
  [
    '.............',
    '..XX.....XX..',
    '..X.e...e.X..',
    '......E......',
    '..X.e...e.X..',
    '..XX.....XX..',
    '.............',
  ],
  // 河道（横向坑）
  [
    '.............',
    '..e.......e..',
    '.OOOOOOOOOOO.',
    '......E......',
    '.OOOOOOOOOOO.',
    '..e.......e..',
    '.............',
  ],
  // 棋盘
  [
    '.#.#.....#.#.',
    '#.e.#...#.e.#',
    '.#.#.....#.#.',
    '......E......',
    '.#.#.....#.#.',
    '#.e.#...#.e.#',
    '.#.#.....#.#.',
  ],
];

const CHAR_TO_OBSTACLE = {
  '#': 'rock',
  'P': 'poop',
  'X': 'block',
  '^': 'spikes',
  'O': 'pit',
  'F': 'fire',
  'T': 'tnt',
  'W': 'web',
};

// 各层敌人池：越深越危险
const ENEMY_POOLS = [
  // 第 1-2 层
  { w: 1, list: ['fly', 'fly', 'attackfly', 'gaper', 'pooter', 'horf', 'clotty', 'spider', 'dip'] },
  // 第 3-4 层
  { w: 1, list: ['attackfly', 'gaper', 'frowninggaper', 'pooter', 'boomfly', 'charger', 'spider', 'trite', 'mulligan', 'host', 'clotty', 'sucker'] },
  // 第 5 层及以后
  { w: 1, list: ['frowninggaper', 'boomfly', 'charger', 'trite', 'host', 'sucker', 'mulligan', 'attackfly', 'clotty'] },
];

const ELITE_BY_DEPTH = [
  ['mulligan', 'horf', 'clotty'],
  ['charger', 'host', 'boomfly', 'mulligan'],
  ['charger', 'host', 'sucker', 'frowninggaper'],
];

function poolForLevel(level) {
  if (level <= 2) return ENEMY_POOLS[0];
  if (level <= 4) return ENEMY_POOLS[1];
  return ENEMY_POOLS[2];
}
function elitesForLevel(level) {
  if (level <= 2) return ELITE_BY_DEPTH[0];
  if (level <= 4) return ELITE_BY_DEPTH[1];
  return ELITE_BY_DEPTH[2];
}

/** 门口及其内侧一格必须保持畅通，否则玩家会被卡在门里 */
function carveDoorways(cells, room) {
  const clear = (x, y) => {
    if (x >= 0 && x < ROOM_W && y >= 0 && y < ROOM_H) cells[y][x] = '.';
  };
  const mx = (ROOM_W - 1) / 2 | 0, my = (ROOM_H - 1) / 2 | 0;
  for (let d = 0; d < 4; d++) {
    if (!room.doors[d]) continue;
    if (d === 0) { clear(mx, 0); clear(mx, 1); clear(mx - 1, 0); clear(mx + 1, 0); }
    if (d === 2) { clear(mx, ROOM_H - 1); clear(mx, ROOM_H - 2); clear(mx - 1, ROOM_H - 1); clear(mx + 1, ROOM_H - 1); }
    if (d === 3) { clear(0, my); clear(1, my); clear(0, my - 1); clear(0, my + 1); }
    if (d === 1) { clear(ROOM_W - 1, my); clear(ROOM_W - 2, my); clear(ROOM_W - 1, my - 1); clear(ROOM_W - 1, my + 1); }
  }
}

/** 洪水填充，把与门口不连通的障碍打掉，避免出现走不到的角落 */
function ensureConnectivity(cells) {
  const solid = (c) => c === '#' || c === 'X' || c === 'P' || c === 'F' || c === 'T';
  const cx = (ROOM_W - 1) / 2 | 0, cy = (ROOM_H - 1) / 2 | 0;
  const seen = Array.from({ length: ROOM_H }, () => new Array(ROOM_W).fill(false));
  const q = [[cx, cy]];
  seen[cy][cx] = true;
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= ROOM_W || ny < 0 || ny >= ROOM_H) continue;
      if (seen[ny][nx] || solid(cells[ny][nx])) continue;
      seen[ny][nx] = true;
      q.push([nx, ny]);
    }
  }
  // 把孤立区域的障碍清掉（只清一层，够打通即可）
  for (let y = 0; y < ROOM_H; y++) {
    for (let x = 0; x < ROOM_W; x++) {
      if (seen[y][x] || !solid(cells[y][x])) continue;
      // 若它挨着已连通区域，打掉它就能连上
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= ROOM_W || ny < 0 || ny >= ROOM_H) continue;
        if (seen[ny][nx]) { cells[y][x] = '.'; break; }
      }
    }
  }
}

/** 生成一间普通战斗房的内容 */
function genCombatRoom(room, rng, level, isMiniBoss) {
  const tpl = rng.pick(TEMPLATES);
  const cells = tpl.map((row) => row.split(''));

  // 随机镜像，让同一模板看起来不一样
  if (rng.chance(0.5)) cells.forEach((r) => r.reverse());
  if (rng.chance(0.5)) cells.reverse();

  // 变异：少量随机增删障碍
  for (let i = 0; i < 6; i++) {
    const x = rng.int(ROOM_W), y = rng.int(ROOM_H);
    if (cells[y][x] === '.' && rng.chance(0.35)) {
      cells[y][x] = rng.pick(['#', '#', '#', 'P']);
    } else if (cells[y][x] === '#' && rng.chance(0.3)) {
      cells[y][x] = '.';
    }
  }

  carveDoorways(cells, room);
  ensureConnectivity(cells);

  const obstacles = [];
  const spawnPoints = [];
  const elitePoints = [];
  for (let y = 0; y < ROOM_H; y++) {
    for (let x = 0; x < ROOM_W; x++) {
      const c = cells[y][x];
      if (c === 'e') { spawnPoints.push([x, y]); continue; }
      if (c === 'E') { elitePoints.push([x, y]); continue; }
      const kind = CHAR_TO_OBSTACLE[c];
      if (kind) obstacles.push({ kind, x, y });
    }
  }

  // 按层数和离起点的距离决定敌人数量。
  // 首层刻意压得很低 —— 原作的地下室 1 是给玩家熟悉手感的，不该一上来就围殴。
  const budget = Math.round(1.4 + level * 0.8 + Math.min(room.dist, 6) * 0.4 + rng.range(0, 1));
  const pool = poolForLevel(level).list;
  const elites = elitesForLevel(level);

  rng.shuffle(spawnPoints);
  rng.shuffle(elitePoints);
  const enemies = [];

  // 精英位优先
  for (const [x, y] of elitePoints) {
    if (enemies.length >= budget) break;
    enemies.push({ kind: rng.pick(elites), x, y, champion: rng.chance(0.08 + level * 0.01) });
  }
  // 普通位
  for (const [x, y] of spawnPoints) {
    if (enemies.length >= budget) break;
    enemies.push({ kind: rng.pick(pool), x, y, champion: rng.chance(0.05 + level * 0.01) });
  }
  // 位置不够就在空地上补
  let guard = 0;
  while (enemies.length < budget && guard++ < 80) {
    const x = rng.range(1, ROOM_W - 2), y = rng.range(1, ROOM_H - 2);
    if (cells[y][x] !== '.') continue;
    if (Math.abs(x - 6) + Math.abs(y - 3) < 2) continue;  // 别贴脸生成
    enemies.push({ kind: rng.pick(pool), x, y, champion: false });
    cells[y][x] = 'e';
  }

  if (isMiniBoss) {
    // 迷你 Boss：一只被强化的精英 + 少量随从
    enemies.length = Math.min(enemies.length, 3);
    enemies.unshift({ kind: rng.pick(elites), x: 6, y: 3, champion: true, miniboss: true });
  }

  return { obstacles, enemies, pickups: [], items: [] };
}

/** Boss 房：一只 Boss，场地基本空旷 */
const BOSS_ORDER = ['monstro', 'duke', 'larry', 'gemini', 'famine'];

function genBossRoom(room, rng, level) {
  const obstacles = [];
  // 四角零星装饰，不影响走位
  if (rng.chance(0.6)) {
    for (const [x, y] of [[1, 1], [11, 1], [1, 5], [11, 5]]) {
      if (rng.chance(0.7)) obstacles.push({ kind: rng.pick(['rock', 'poop']), x, y });
    }
  }
  const kind = BOSS_ORDER[(level - 1) % BOSS_ORDER.length];
  return {
    obstacles,
    enemies: [],
    boss: { kind, x: 6, y: 3 },
    pickups: [],
    items: [],
  };
}

function genTreasureRoom(room, rng, level) {
  return {
    obstacles: [
      { kind: 'rock', x: 3, y: 2 }, { kind: 'rock', x: 9, y: 2 },
      { kind: 'rock', x: 3, y: 4 }, { kind: 'rock', x: 9, y: 4 },
    ],
    enemies: [],
    pickups: [],
    items: [{ x: 6, y: 3, pool: 'treasure', free: true }],
  };
}

function genShop(room, rng, level) {
  const slots = [[3, 2], [6, 2], [9, 2], [3, 4], [6, 4], [9, 4]];
  rng.shuffle(slots);
  const n = rng.range(3, 4);
  const stock = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = slots[i];
    const roll = rng.next();
    if (roll < 0.35) stock.push({ x, y, kind: 'item', pool: 'shop', price: rng.pick([15, 15, 20]) });
    else if (roll < 0.55) stock.push({ x, y, kind: 'heart', price: 3 });
    else if (roll < 0.72) stock.push({ x, y, kind: 'bomb', price: 5 });
    else if (roll < 0.88) stock.push({ x, y, kind: 'key', price: 5 });
    else stock.push({ x, y, kind: 'soulheart', price: 6 });
  }
  return { obstacles: [], enemies: [], pickups: [], items: [], shop: stock };
}

function genCurseRoom(room, rng, level) {
  return {
    obstacles: [
      { kind: 'spikes', x: 4, y: 2 }, { kind: 'spikes', x: 8, y: 2 },
      { kind: 'spikes', x: 4, y: 4 }, { kind: 'spikes', x: 8, y: 4 },
      { kind: 'fire', x: 2, y: 3 }, { kind: 'fire', x: 10, y: 3 },
    ],
    enemies: [],
    pickups: [],
    // 诅咒房的道具免费，代价是进出都要挨一下尖刺
    items: [{ x: 6, y: 3, pool: 'devil', free: true }],
    curse: true,
  };
}

function genSacrificeRoom(room, rng, level) {
  return {
    obstacles: [{ kind: 'spikes', x: 6, y: 3, sacrifice: true }],
    enemies: [], pickups: [], items: [],
    sacrifice: true,
  };
}

function genArcade(room, rng, level) {
  return {
    obstacles: [],
    enemies: [], pickups: [], items: [],
    machines: [
      { x: 4, y: 3, kind: 'slot' },
      { x: 8, y: 3, kind: 'beggar' },
    ],
  };
}

function genSecretRoom(room, rng, level) {
  const pickups = [];
  const n = rng.range(2, 4);
  const slots = [[4, 2], [6, 2], [8, 2], [4, 4], [6, 4], [8, 4], [6, 3]];
  rng.shuffle(slots);
  for (let i = 0; i < n; i++) {
    const [x, y] = slots[i];
    pickups.push({
      x, y,
      kind: rng.weighted([
        { w: 3, v: 'penny' }, { w: 2, v: 'heart' }, { w: 2, v: 'bomb' },
        { w: 2, v: 'key' }, { w: 1, v: 'soulheart' }, { w: 1, v: 'chest' },
      ]).v,
    });
  }
  return { obstacles: [], enemies: [], pickups, items: [] };
}

function genSuperSecretRoom(room, rng, level) {
  return {
    obstacles: [],
    enemies: [],
    pickups: [{ x: 5, y: 3, kind: 'soulheart' }, { x: 7, y: 3, kind: 'goldchest' }],
    items: [],
  };
}

function genStartRoom(room, rng, level) {
  return { obstacles: [], enemies: [], pickups: [], items: [] };
}

/** 恶魔房：道具用心之容器购买 —— 以撒最经典的赌博决策 */
function genDevilRoom(room, rng, level) {
  const slots = [[4, 3], [8, 3], [6, 2]];
  rng.shuffle(slots);
  const n = rng.range(2, 3);
  const items = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = slots[i];
    // 大部分要价一颗心（2 个半心），偶尔出现三个半心的贵货
    items.push({ x, y, pool: 'devil', heartPrice: rng.chance(0.25) ? 3 : 2 });
  }
  return {
    obstacles: [
      { kind: 'fire', x: 1, y: 1 }, { kind: 'fire', x: 11, y: 1 },
      { kind: 'fire', x: 1, y: 5 }, { kind: 'fire', x: 11, y: 5 },
    ],
    enemies: [], pickups: [], items, devil: true,
  };
}

/** 天使房：道具免费，但一局里只要跟恶魔做过交易就再也不会出现 */
function genAngelRoom(room, rng, level) {
  return {
    obstacles: [],
    enemies: [],
    pickups: [{ x: 4, y: 4, kind: 'soulheart' }],
    items: [{ x: 6, y: 3, pool: 'angel', free: true }],
    angel: true,
  };
}

/** 房间内容的统一入口；结果缓存在 room.contents 上，重复进入时不再重掷 */
export function generateRoomContents(room, rng, level) {
  if (room.contents) return room.contents;
  let c;
  switch (room.type) {
    case ROOM_TYPE.START: c = genStartRoom(room, rng, level); break;
    case ROOM_TYPE.BOSS: c = genBossRoom(room, rng, level); break;
    case ROOM_TYPE.TREASURE: c = genTreasureRoom(room, rng, level); break;
    case ROOM_TYPE.SHOP: c = genShop(room, rng, level); break;
    case ROOM_TYPE.CURSE: c = genCurseRoom(room, rng, level); break;
    case ROOM_TYPE.SACRIFICE: c = genSacrificeRoom(room, rng, level); break;
    case ROOM_TYPE.ARCADE: c = genArcade(room, rng, level); break;
    case ROOM_TYPE.SECRET: c = genSecretRoom(room, rng, level); break;
    case ROOM_TYPE.SUPER_SECRET: c = genSuperSecretRoom(room, rng, level); break;
    case ROOM_TYPE.MINIBOSS: c = genCombatRoom(room, rng, level, true); break;
    case ROOM_TYPE.DEVIL: c = genDevilRoom(room, rng, level); break;
    case ROOM_TYPE.ANGEL: c = genAngelRoom(room, rng, level); break;
    default: c = genCombatRoom(room, rng, level, false);
  }
  room.contents = c;
  return c;
}
