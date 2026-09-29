// 楼层拓扑生成 —— 复刻原作反编译出的算法：
//   1. 房间数 = random(2) + 5 + 层数 * 2.6
//   2. 从中心格开始广度优先向外扩散，每个方向 50% 概率放弃
//   3. 若目标格已有 2 个以上邻居则跳过 —— 这条规则保证地图是一棵树（无环）
//   4. 扩散时没能生成任何新房间的格子记为「死胡同」，特殊房只放在死胡同
//   5. Boss 房放在离起点最远的死胡同；秘密房挤在邻居最多的空格里

import { RNG, DIR_VEC, DIR_OPPOSITE } from './util.js';

export const GRID_W = 9;
export const GRID_H = 8;
const START_X = 4, START_Y = 3;

export const ROOM_TYPE = {
  START: 'start',
  NORMAL: 'normal',
  BOSS: 'boss',
  TREASURE: 'treasure',
  SHOP: 'shop',
  SECRET: 'secret',
  SUPER_SECRET: 'supersecret',
  CURSE: 'curse',
  SACRIFICE: 'sacrifice',
  ARCADE: 'arcade',
  MINIBOSS: 'miniboss',
  DEVIL: 'devil',
  ANGEL: 'angel',
};

/** 各类特殊房对应的门样式 */
export const DOOR_STYLE_FOR = {
  [ROOM_TYPE.BOSS]: 'boss',
  [ROOM_TYPE.TREASURE]: 'treasure',
  [ROOM_TYPE.SHOP]: 'shop',
  [ROOM_TYPE.SECRET]: 'secret',
  [ROOM_TYPE.SUPER_SECRET]: 'secret',
  [ROOM_TYPE.CURSE]: 'curse',
  [ROOM_TYPE.SACRIFICE]: 'sacrifice',
  [ROOM_TYPE.ARCADE]: 'arcade',
  [ROOM_TYPE.DEVIL]: 'devil',
  [ROOM_TYPE.ANGEL]: 'angel',
};

export class RoomNode {
  constructor(x, y, type) {
    this.x = x; this.y = y;
    this.idx = y * GRID_W + x;
    this.type = type;
    this.doors = [null, null, null, null];  // 每个方向：null 或 { to, style, locked, hidden }
    this.visited = false;
    this.cleared = false;
    this.dist = 0;
    this.contents = null;   // 由 roomgen 填充
    this.entities = null;   // 运行时实体快照（离开房间时保存）
  }
}

function inBounds(x, y) {
  return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;
}

export function generateFloor(level, seed) {
  const rng = new RNG(seed);
  // 最多重试若干次，直到拿到一张死胡同数量足够的地图
  for (let attempt = 0; attempt < 60; attempt++) {
    const floor = tryGenerate(level, rng);
    if (floor) return floor;
  }
  // 兜底：放宽死胡同要求
  return tryGenerate(level, rng, true);
}

function tryGenerate(level, rng, relaxed = false) {
  const target = Math.floor(rng.int(2) + 5 + level * 2.6);
  /** @type {Map<number, RoomNode>} */
  const grid = new Map();
  const start = new RoomNode(START_X, START_Y, ROOM_TYPE.START);
  grid.set(start.idx, start);

  const queue = [start];
  let count = 1;

  while (queue.length) {
    const cell = queue.shift();

    for (let d = 0; d < 4; d++) {
      if (count >= target) break;
      const nx = cell.x + DIR_VEC[d][0], ny = cell.y + DIR_VEC[d][1];
      if (!inBounds(nx, ny)) continue;
      const nidx = ny * GRID_W + nx;
      if (grid.has(nidx)) continue;
      if (countNeighbors(grid, nx, ny) > 1) continue;   // 已有 2+ 邻居 → 会形成环，跳过
      if (rng.chance(0.5)) continue;                     // 50% 随机放弃

      const room = new RoomNode(nx, ny, ROOM_TYPE.NORMAL);
      room.dist = cell.dist + 1;
      grid.set(nidx, room);
      queue.push(room);
      count++;
    }
  }

  // 房间太少或死胡同不够放特殊房，这张图作废
  if (count < target) return null;

  // 死胡同 = 只有一个邻居的房间（起始房除外）。特殊房必须是死胡同，
  // 这样它们才只有一个入口 —— 原作的宝箱房 / 商店 / Boss 房都符合这一点。
  const deadEnds = [...grid.values()].filter(
    (r) => r !== start && countNeighbors(grid, r.x, r.y) === 1
  );
  const needed = relaxed ? 2 : 4;
  if (deadEnds.length < needed) return null;

  // --- 分配特殊房 ---
  // Boss 房：离起点最远的死胡同（同距离则取后生成的）
  deadEnds.sort((a, b) => a.dist - b.dist);
  const boss = deadEnds.pop();
  boss.type = ROOM_TYPE.BOSS;

  // 其余特殊房从剩下的死胡同里随机抽，越靠后的越远离起点
  rng.shuffle(deadEnds);
  const pool = deadEnds.slice();
  const take = () => pool.pop() || null;

  const assign = (type) => {
    const r = take();
    if (r) r.type = type;
    return r;
  };

  // 宝箱房：前三章必定生成
  const treasure = level <= 6 ? assign(ROOM_TYPE.TREASURE) : (rng.chance(0.5) ? assign(ROOM_TYPE.TREASURE) : null);
  // 商店：前三章必定生成
  const shop = level <= 6 ? assign(ROOM_TYPE.SHOP) : (rng.chance(0.5) ? assign(ROOM_TYPE.SHOP) : null);
  // 诅咒房：1/2 概率
  if (rng.chance(0.5)) assign(ROOM_TYPE.CURSE);
  // 献祭房：1/7 概率
  if (rng.chance(1 / 7)) assign(ROOM_TYPE.SACRIFICE);
  // 街机房：只在每章第二层
  if (level % 2 === 0 && rng.chance(0.35)) assign(ROOM_TYPE.ARCADE);
  // 迷你 Boss：1/4 概率，首层额外 1/3
  if (rng.chance(level === 1 ? 0.5 : 0.25)) assign(ROOM_TYPE.MINIBOSS);

  // --- 连门：所有相邻的房间之间互相开门 ---
  for (const room of grid.values()) {
    for (let d = 0; d < 4; d++) {
      const nx = room.x + DIR_VEC[d][0], ny = room.y + DIR_VEC[d][1];
      if (!inBounds(nx, ny)) continue;
      const nb = grid.get(ny * GRID_W + nx);
      if (!nb) continue;
      room.doors[d] = { to: nb, style: doorStyleBetween(room, nb), locked: false, hidden: false };
    }
  }

  // 商店与宝箱房的门在原作里是需要钥匙 / 特殊样式的
  if (shop) lockDoorsTo(shop, true);
  if (treasure) lockDoorsTo(treasure, false);

  // --- 秘密房：塞进邻居最多的空格，必须炸墙才能进 ---
  const secret = placeSecretRoom(grid, rng, ROOM_TYPE.SECRET, 3);
  const superSecret = placeSecretRoom(grid, rng, ROOM_TYPE.SUPER_SECRET, 1, boss);

  const rooms = [...grid.values()];
  // 重算到起点的真实距离（BFS 距离，用于小地图与难度缩放）
  recomputeDistances(start);

  return {
    level, seed: rng.s, grid, rooms, start, boss,
    w: GRID_W, h: GRID_H,
    secret, superSecret,
  };
}

function countNeighbors(grid, x, y) {
  let n = 0;
  for (let d = 0; d < 4; d++) {
    const nx = x + DIR_VEC[d][0], ny = y + DIR_VEC[d][1];
    if (!inBounds(nx, ny)) continue;
    if (grid.has(ny * GRID_W + nx)) n++;
  }
  return n;
}

function doorStyleBetween(a, b) {
  // 门的外观取决于「更特殊」的那一侧
  const special = DOOR_STYLE_FOR[b.type] || DOOR_STYLE_FOR[a.type];
  return special || 'normal';
}

function lockDoorsTo(room, locked) {
  for (let d = 0; d < 4; d++) {
    const door = room.doors[d];
    if (!door) continue;
    door.locked = locked;
    const back = door.to.doors[DIR_OPPOSITE[d]];
    if (back) back.locked = locked;
  }
}

/**
 * 秘密房：在空格里找邻居数最多的位置。原作的做法是不断放宽条件，
 * 这里直接按邻居数排序取最优，效果等价且不需要重试 600 次。
 */
function placeSecretRoom(grid, rng, type, minNeighbors, avoid = null) {
  let candidates = [];
  // 原作会反复重试并逐步放宽条件，这里直接逐级降低邻居数要求，效果相同
  for (let req = minNeighbors; req >= 1 && !candidates.length; req--) {
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const idx = y * GRID_W + x;
        if (grid.has(idx)) continue;
        const n = countNeighbors(grid, x, y);
        if (n < req) continue;
        // 超级秘密房不能紧挨 Boss 房
        if (avoid && Math.abs(avoid.x - x) + Math.abs(avoid.y - y) <= 1) continue;
        candidates.push({ x, y, n });
      }
    }
  }
  if (!candidates.length) return null;
  const best = Math.max(...candidates.map((c) => c.n));
  const picks = candidates.filter((c) => c.n === best);
  const spot = rng.pick(picks);

  const room = new RoomNode(spot.x, spot.y, type);
  grid.set(room.idx, room);

  // 秘密房的门是「隐藏」的：墙被炸开前不显示、不可通行
  for (let d = 0; d < 4; d++) {
    const nx = spot.x + DIR_VEC[d][0], ny = spot.y + DIR_VEC[d][1];
    if (!inBounds(nx, ny)) continue;
    const nb = grid.get(ny * GRID_W + nx);
    if (!nb || nb.type === ROOM_TYPE.SECRET || nb.type === ROOM_TYPE.SUPER_SECRET) continue;
    // Boss 房必须保持单一入口，秘密房不能从背后凿进去
    if (nb.type === ROOM_TYPE.BOSS) continue;
    // 超级秘密房只有一个入口
    if (type === ROOM_TYPE.SUPER_SECRET && room.doors.some((x2) => x2)) continue;
    room.doors[d] = { to: nb, style: 'secret', locked: false, hidden: true };
    nb.doors[DIR_OPPOSITE[d]] = { to: room, style: 'secret', locked: false, hidden: true };
  }
  return room;
}

function recomputeDistances(start) {
  const seen = new Set([start.idx]);
  const q = [start];
  start.dist = 0;
  while (q.length) {
    const r = q.shift();
    for (const door of r.doors) {
      if (!door || door.hidden) continue;
      if (seen.has(door.to.idx)) continue;
      seen.add(door.to.idx);
      door.to.dist = r.dist + 1;
      q.push(door.to);
    }
  }
}

/** 供小地图使用：房间在 9x8 网格中的包围盒 */
export function floorBounds(floor) {
  let x0 = GRID_W, y0 = GRID_H, x1 = 0, y1 = 0;
  for (const r of floor.rooms) {
    x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x); y1 = Math.max(y1, r.y);
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * 打完 Boss 后动态挂上的恶魔房 / 天使房。
 * 原作里它是一个开在 Boss 房墙上的额外入口，不占用正常的楼层拓扑。
 */
export function attachDevilRoom(floor, bossNode, type) {
  // 找 Boss 房四周第一个界内且空着的格子
  for (let d = 0; d < 4; d++) {
    if (bossNode.doors[d]) continue;
    const nx = bossNode.x + DIR_VEC[d][0], ny = bossNode.y + DIR_VEC[d][1];
    if (!inBounds(nx, ny)) continue;
    if (floor.grid.has(ny * GRID_W + nx)) continue;

    const room = new RoomNode(nx, ny, type);
    room.dist = bossNode.dist + 1;
    const style = DOOR_STYLE_FOR[type];
    bossNode.doors[d] = { to: room, style, locked: false, hidden: false };
    room.doors[DIR_OPPOSITE[d]] = { to: bossNode, style, locked: false, hidden: false };

    floor.grid.set(room.idx, room);
    floor.rooms.push(room);
    return room;
  }
  return null;   // 四周都被占满，这次就不给了
}
