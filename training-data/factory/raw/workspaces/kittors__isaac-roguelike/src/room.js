// 房间运行时：实体容器、格子碰撞、清房判定、门与掉落。

import { TILE, ROOM_W, ROOM_H } from './tiles.js';
import { ROOM_PLAY_W, ROOM_PLAY_H, Pickup, Explosion, Particle, Decal } from './entities.js';
import { Enemy } from './enemies.js';
import { Boss } from './bosses.js';
import { ROOM_TYPE } from './floor.js';
import { rollItem } from './items.js';
import { PAL } from './palette.js';
import { norm, clamp, dist } from './util.js';

/** 障碍物的物理属性表 */
const OBSTACLE_PROPS = {
  rock:   { blocksMove: true,  blocksShots: true,  hp: Infinity, breakable: true },
  block:  { blocksMove: true,  blocksShots: true,  hp: Infinity, breakable: false },
  poop:   { blocksMove: true,  blocksShots: true,  hp: 12,       breakable: true },
  spikes: { blocksMove: false, blocksShots: false, hurts: 1 },
  pit:    { blocksMove: true,  blocksShots: false, flyable: true },
  fire:   { blocksMove: true,  blocksShots: true,  hp: 24, breakable: true, hurts: 1, contact: true },
  tnt:    { blocksMove: true,  blocksShots: true,  hp: 8, breakable: true, explodes: true },
  web:    { blocksMove: false, blocksShots: false, slow: 0.45 },
};

export class Obstacle {
  constructor(kind, tx, ty) {
    const p = OBSTACLE_PROPS[kind] || OBSTACLE_PROPS.rock;
    this.kind = kind;
    this.tx = tx; this.ty = ty;
    this.x = tx * TILE + TILE / 2;
    this.y = ty * TILE + TILE / 2;
    this.props = p;
    this.blocksMove = p.blocksMove;
    this.blocksShots = p.blocksShots;
    this.hp = p.hp === undefined ? Infinity : p.hp;
    this.stage = 0;          // 便便的破损阶段
    this.dead = false;
    this.shake = 0;
  }
  get spriteKey() {
    if (this.kind === 'poop') return `poop${Math.min(2, this.stage)}`;
    if (this.kind === 'fire') return `fire${0}`;   // 帧由渲染层按时间选
    return this.kind;
  }
}

export class Room {
  constructor(node, floor, game, rng) {
    this.node = node;
    this.floor = floor;
    this.level = floor.level;
    this.game = game;
    this.type = node.type;

    this.enemies = [];
    this.boss = null;
    this.projectiles = [];
    this.lasers = [];
    this.pickups = [];
    this.bombs = [];
    this.explosions = [];
    this.particles = [];
    this.decals = [];
    this.texts = [];
    this.shopItems = [];
    this.machines = [];

    this.grid = Array.from({ length: ROOM_H }, () => new Array(ROOM_W).fill(null));
    this.obstacles = [];

    this.shakeAmount = 0;
    this.doorOpenAnim = 0;
    this.bgVariant = (node.idx * 7) % 4;
    this.rng = rng;

    this.build(node.contents);
    this.cleared = node.cleared;
    if (this.cleared) this.openDoors();
  }

  build(c) {
    if (!c) return;
    for (const o of c.obstacles) this.addObstacle(o.kind, o.x, o.y, o);
    // 清空过的房间不再生成任何敌人 —— 回头路上的房间必须是安全的
    if (!this.node.cleared) {
      for (const e of c.enemies) {
        this.enemies.push(new Enemy(e.kind, e.x * TILE + TILE / 2, e.y * TILE + TILE / 2, this.level, e));
      }
      if (c.boss) {
        this.boss = new Boss(c.boss.kind, c.boss.x * TILE + TILE / 2, c.boss.y * TILE + TILE / 2, this.level);
      }
    }
    for (const p of (c.pickups || [])) {
      if (p.taken) continue;
      this.pickups.push(new Pickup(p.x * TILE + TILE / 2, p.y * TILE + TILE / 2, p.kind));
    }
    // 同一房间内不允许抽到重复道具（恶魔 / 天使池很小，很容易撞车）
    const chosen = new Set(this.game.player.ownedIds);
    for (const it of (c.items || [])) {
      if (it.taken) continue;
      const item = it.item || rollItem(this.rng, it.pool || 'treasure', chosen);
      chosen.add(item.id);
      it.item = item;
      this.pickups.push(new Pickup(it.x * TILE + TILE / 2, it.y * TILE + TILE / 2, 'pedestal', {
        item, pedestal: true, price: it.price || 0, heartPrice: it.heartPrice || 0,
      }));
    }
    for (const s of (c.shop || [])) {
      if (s.taken) continue;
      if (s.kind === 'item') {
        const item = s.item || rollItem(this.rng, 'shop', chosen);
        chosen.add(item.id);
        s.item = item;
        this.pickups.push(new Pickup(s.x * TILE + TILE / 2, s.y * TILE + TILE / 2, 'pedestal', {
          item, pedestal: true, price: s.price,
        }));
      } else {
        this.pickups.push(new Pickup(s.x * TILE + TILE / 2, s.y * TILE + TILE / 2, s.kind, { price: s.price }));
      }
      this.shopItems.push(s);
    }
    for (const m of (c.machines || [])) {
      this.machines.push({ ...m, px: m.x * TILE + TILE / 2, py: m.y * TILE + TILE / 2, used: 0 });
    }
    // 通往下一层的活板门（Boss 房被清空后出现）
    if (this.type === ROOM_TYPE.BOSS && this.node.cleared && !c.trapdoorTaken) {
      this.spawnTrapdoor();
    }
  }

  addObstacle(kind, tx, ty, extra) {
    if (tx < 0 || tx >= ROOM_W || ty < 0 || ty >= ROOM_H) return null;
    if (this.grid[ty][tx]) return null;
    const o = new Obstacle(kind, tx, ty);
    if (extra?.sacrifice) o.sacrifice = true;
    this.grid[ty][tx] = o;
    this.obstacles.push(o);
    return o;
  }

  removeObstacle(o) {
    o.dead = true;
    if (this.grid[o.ty][o.tx] === o) this.grid[o.ty][o.tx] = null;
    const i = this.obstacles.indexOf(o);
    if (i >= 0) this.obstacles.splice(i, 1);
    // 从房间数据里也删掉，重进房间时不再出现
    const list = this.node.contents?.obstacles;
    if (list) {
      const j = list.findIndex((e) => e.x === o.tx && e.y === o.ty);
      if (j >= 0) list.splice(j, 1);
    }
  }

  // --- 查询 ---------------------------------------------------------------

  tileAt(x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 0 || tx >= ROOM_W || ty < 0 || ty >= ROOM_H) return null;
    return this.grid[ty][tx];
  }

  obstacleAt(x, y) {
    const o = this.tileAt(x, y);
    return o && !o.dead ? o : null;
  }

  slowFactorAt(x, y) {
    const o = this.tileAt(x, y);
    return o && o.props.slow ? o.props.slow : 1;
  }

  nearestTarget(x, y, friendly, maxDist) {
    let best = null, bestD = maxDist * maxDist;
    if (friendly) {
      const check = (e) => {
        const d = (e.x - x) ** 2 + (e.y - y) ** 2;
        if (d < bestD) { bestD = d; best = e; }
      };
      for (const e of this.enemies) if (!e.dead && !e.invulnerable) check(e);
      if (this.boss && !this.boss.dead) check(this.boss);
    } else {
      const p = this.game.player;
      if ((p.x - x) ** 2 + (p.y - y) ** 2 < bestD) best = p;
    }
    return best;
  }

  /** 圆形实体的分轴移动 + 格子碰撞 */
  moveEntity(ent, dx, dy) {
    const canPass = (x, y) => {
      const o = this.obstacleAt(x, y);
      if (!o) return true;
      if (!o.blocksMove) return true;
      if (o.props.flyable && ent.flying) return true;
      return false;
    };
    const probe = (x, y) => {
      // 用实体外圈的几个采样点做碰撞，圆形近似
      const r = ent.r * 0.72;
      return canPass(x, y) && canPass(x - r, y) && canPass(x + r, y) &&
             canPass(x, y - r) && canPass(x, y + r);
    };
    if (dx !== 0) {
      const nx = ent.x + dx;
      if (probe(nx, ent.y)) ent.x = nx;
      else if (ent.vx !== undefined) ent.vx = 0;
    }
    if (dy !== 0) {
      const ny = ent.y + dy;
      if (probe(ent.x, ny)) ent.y = ny;
      else if (ent.vy !== undefined) ent.vy = 0;
    }
    ent.x = clamp(ent.x, ent.r, ROOM_PLAY_W - ent.r);
    ent.y = clamp(ent.y, ent.r, ROOM_PLAY_H - ent.r);
  }

  // --- 特效生成 -----------------------------------------------------------

  shake(amount) { this.shakeAmount = Math.max(this.shakeAmount, amount); }

  addDecal(x, y, kind, size) {
    if (this.decals.length > 90) this.decals.shift();
    this.decals.push(new Decal(x, y, kind, size));
  }

  spawnSplash(x, y, color) {
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push(new Particle({
        x, y, vx: Math.cos(a) * 55, vy: Math.sin(a) * 55,
        vz: 30 + Math.random() * 40, z: 4,
        color, size: 1 + Math.random() * 2, life: 0.3 + Math.random() * 0.2,
      }));
    }
  }

  spawnBloodSpray(x, y, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 130;
      this.particles.push(new Particle({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7,
        vz: 40 + Math.random() * 90, z: 6,
        color: Math.random() < 0.75 ? PAL.blood : PAL.bloodDark,
        size: 1 + Math.random() * 2.5, life: 0.5 + Math.random() * 0.4,
      }));
    }
  }

  spawnExplosion(x, y, damage, friendly, game, opts = {}) {
    const radius = opts.radius || 46;
    this.explosions.push(new Explosion(x, y, radius));
    this.shake(9);
    game.audio.play('explode');

    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 220;
      this.particles.push(new Particle({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7,
        vz: 60 + Math.random() * 140, z: 6,
        color: [ '#ffd060', '#ff8a20', '#e04a10', '#6a6a6a' ][(Math.random() * 4) | 0],
        size: 2 + Math.random() * 3, life: 0.4 + Math.random() * 0.5, glow: true,
      }));
    }

    // 伤害：敌人、Boss、玩家都吃
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = dist(x, y, e.x, e.y);
      if (d < radius + e.r) {
        const kb = norm(e.x - x, e.y - y, 320);
        e.hurt(damage, this, game, kb);
      }
    }
    if (this.boss && !this.boss.dead) {
      for (const part of this.boss.hitParts()) {
        if (dist(x, y, part.x, part.y) < radius + part.r) {
          this.boss.hurt(damage, this, game, norm(this.boss.x - x, this.boss.y - y, 120));
          break;
        }
      }
    }
    const p = game.player;
    if (dist(x, y, p.x, p.y) < radius + p.r) {
      p.hurt(opts.poison ? 1 : 2, { x, y });
    }

    // 炸开周围的石头
    this.breakObstaclesNear(x, y, radius, game, opts.breakRocks !== false);
    this.addDecal(x, y, 'scorch', radius * 0.5);
  }

  breakObstaclesNear(x, y, radius, game, includeRocks = true) {
    for (const o of [...this.obstacles]) {
      if (o.dead) continue;
      if (dist(x, y, o.x, o.y) > radius + TILE * 0.4) continue;
      if (o.kind === 'block') continue;
      if (o.kind === 'rock' && !includeRocks) continue;
      if (o.kind === 'tnt') { this.chainTnt(o, game); continue; }
      this.destroyObstacle(o, game);
    }
  }

  chainTnt(o, game) {
    if (o.dead) return;
    this.removeObstacle(o);
    // 稍后引爆，形成连锁
    setTimeout(() => {
      if (this.game.room === this) {
        this.spawnExplosion(o.x, o.y, 55, false, game, { radius: 58 });
      }
    }, 90);
  }

  destroyObstacle(o, game) {
    if (o.dead) return;
    const debrisColor = o.kind === 'poop' ? PAL.poop
      : o.kind === 'fire' ? '#6a5a44' : PAL.rock;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push(new Particle({
        x: o.x, y: o.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 70,
        vz: 60 + Math.random() * 90, z: 8,
        color: debrisColor, size: 2 + Math.random() * 2, life: 0.5,
      }));
    }
    game.audio.play(o.kind === 'poop' ? 'splat' : 'rockbreak');
    // 石头 / 便便里偶尔有东西
    if (this.rng.chance(o.kind === 'poop' ? 0.12 : 0.05)) {
      this.dropPickup(o.x, o.y, this.rng.pick(['penny', 'heart', 'bomb', 'key']));
    }
    this.removeObstacle(o);
  }

  hitObstacle(o, damage, game) {
    if (o.hp === Infinity) return;
    o.hp -= damage;
    o.shake = 0.12;
    if (o.kind === 'poop') o.stage = Math.min(2, Math.floor((1 - o.hp / o.props.hp) * 3));
    if (o.hp <= 0) {
      if (o.kind === 'tnt') this.spawnExplosion(o.x, o.y, 55, false, game, { radius: 58 });
      this.destroyObstacle(o, game);
    }
  }

  dropPickup(x, y, kind) {
    const a = Math.random() * Math.PI * 2;
    this.pickups.push(new Pickup(
      clamp(x, 16, ROOM_PLAY_W - 16), clamp(y, 16, ROOM_PLAY_H - 16), kind,
      { delay: 0.35, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, z: 12, vz: 60 }
    ));
  }

  spawnTrapdoor() {
    this.pickups.push(new Pickup(ROOM_PLAY_W / 2, ROOM_PLAY_H / 2 + 30, 'trapdoor', { delay: 0.8 }));
  }

  // --- 主循环 -------------------------------------------------------------

  update(dt, game) {
    const p = game.player;

    if (this.shakeAmount > 0) this.shakeAmount = Math.max(0, this.shakeAmount - dt * 34);
    if (!this.cleared) this.doorOpenAnim = 0;
    else if (this.doorOpenAnim < 1) this.doorOpenAnim = Math.min(1, this.doorOpenAnim + dt * 5);

    for (const o of this.obstacles) if (o.shake > 0) o.shake -= dt;

    // 敌人
    for (const e of this.enemies) if (!e.dead) e.update(dt, this, game);
    if (this.boss && !this.boss.dead) this.boss.update(dt, this, game);

    // 投射物
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      pr.update(dt, this, game);
      if (pr.dead) continue;
      this.projectileCollisions(pr, game);
    }
    for (const l of this.lasers) { l.update(dt); if (!l.dead) this.laserCollisions(l, game); }

    for (const b of this.bombs) if (!b.dead) b.update(dt, this, game);
    for (const e of this.explosions) e.update(dt);
    for (const pa of this.particles) pa.update(dt);
    for (const tx of this.texts) tx.update(dt);
    for (const pk of this.pickups) pk.update(dt);

    // 接触伤害与拾取
    this.contactDamage(dt, game);
    this.pickupCollisions(game);
    this.hazardDamage(dt, game);

    // 清理
    this.projectiles = this.projectiles.filter((x) => !x.dead);
    this.lasers = this.lasers.filter((x) => !x.dead);
    this.bombs = this.bombs.filter((x) => !x.dead);
    this.explosions = this.explosions.filter((x) => !x.dead);
    this.particles = this.particles.filter((x) => !x.dead);
    this.texts = this.texts.filter((x) => !x.dead);
    this.pickups = this.pickups.filter((x) => !x.dead);
    const before = this.enemies.length;
    this.enemies = this.enemies.filter((x) => !x.dead);

    // 清房判定
    if (!this.cleared && this.enemies.length === 0 && (!this.boss || this.boss.dead)) {
      this.onCleared(game);
    }
  }

  projectileCollisions(pr, game) {
    if (pr.friendly) {
      for (const e of this.enemies) {
        if (e.dead || e.invulnerable) continue;
        if (pr.hitSet.has(e.id)) continue;
        if (dist(pr.x, pr.y, e.x, e.y) > pr.r + e.r) continue;
        pr.hitSet.add(e.id);
        e.hurt(pr.damage, this, game, norm(pr.vx, pr.vy, 260));
        game.audio.play('hit');
        pr.onHit(this, game);
        if (pr.dead) return;
      }
      const b = this.boss;
      if (b && !b.dead) {
        for (const part of b.hitParts()) {
          if (pr.hitSet.has('boss' + (part.twin ? 't' : part.main ? 'm' : 's'))) continue;
          if (dist(pr.x, pr.y, part.x, part.y) > pr.r + part.r) continue;
          if (!pr.pierce) pr.hitSet.add('boss');
          b.hurt(pr.damage, this, game, norm(pr.vx, pr.vy, 100));
          game.audio.play('hit');
          pr.onHit(this, game);
          return;
        }
      }
    } else {
      const p = game.player;
      if (p.dead || p.invuln > 0) return;
      if (dist(pr.x, pr.y, p.x, p.y) > pr.r + p.r) return;
      p.hurt(pr.damage, pr);
      pr.onHit(this, game);
    }
  }

  laserCollisions(l, game) {
    // 沿射线采样做碰撞，简单可靠
    const steps = Math.ceil(l.length / 10);
    for (let i = 0; i < steps; i++) {
      const x = l.x + l.dx * i * 10, y = l.y + l.dy * i * 10;
      if (x < 0 || x > ROOM_PLAY_W || y < 0 || y > ROOM_PLAY_H) break;
      const ob = this.obstacleAt(x, y);
      if (ob && ob.blocksShots && !l.brimstone) { l.length = i * 10; break; }
      if (l.friendly) {
        for (const e of this.enemies) {
          if (e.dead || e.invulnerable || l.hitSet.has(e.id)) continue;
          if (dist(x, y, e.x, e.y) < l.width / 2 + e.r) {
            l.hitSet.add(e.id);
            e.hurt(l.damage, this, game, [l.dx * 200, l.dy * 200]);
            game.audio.play('hit');
          }
        }
        const b = this.boss;
        if (b && !b.dead && !l.hitSet.has('boss')) {
          for (const part of b.hitParts()) {
            if (dist(x, y, part.x, part.y) < l.width / 2 + part.r) {
              l.hitSet.add('boss');
              b.hurt(l.damage, this, game, [l.dx * 80, l.dy * 80]);
              break;
            }
          }
        }
      }
    }
  }

  contactDamage(dt, game) {
    const p = game.player;
    if (p.dead || p.invuln > 0) return;
    for (const e of this.enemies) {
      if (e.dead || e.spawnAnim > 0) continue;
      if (e.z > 18) continue;   // 跳在空中时打不到
      if (dist(p.x, p.y, e.x, e.y) < p.r + e.r - 2) {
        p.hurt(e.touchDamage, e);
        return;
      }
    }
    const b = this.boss;
    if (b && !b.dead && b.spawnAnim <= 0) {
      for (const part of b.hitParts()) {
        if (b.z > 25) break;
        if (dist(p.x, p.y, part.x, part.y) < p.r + part.r - 4) {
          p.hurt(b.touchDamage, b);
          return;
        }
      }
    }
  }

  hazardDamage(dt, game) {
    const p = game.player;
    if (p.dead || p.invuln > 0) return;
    const o = this.obstacleAt(p.x, p.y);
    if (o && o.props.hurts) {
      // 献祭房的尖刺给的是「奖励式」伤害
      if (o.sacrifice) game.onSacrifice(o);
      else p.hurt(o.props.hurts, o);
    }
  }

  pickupCollisions(game) {
    const p = game.player;
    for (const pk of this.pickups) {
      if (pk.dead || pk.pickupDelay > 0) continue;
      if (dist(p.x, p.y, pk.x, pk.y) > p.r + pk.r + 2) continue;
      game.tryPickup(pk);
    }
  }

  onCleared(game) {
    this.cleared = true;
    this.node.cleared = true;
    this.openDoors();
    game.audio.play('doorOpen');
    game.player.chargeActive(1);

    if (this.type === ROOM_TYPE.BOSS) {
      this.spawnTrapdoor();
      // Boss 房必掉一颗心
      this.dropPickup(ROOM_PLAY_W / 2 - 40, ROOM_PLAY_H / 2, 'heart');
      return;
    }
    if (this.type === ROOM_TYPE.MINIBOSS) {
      this.dropPickup(ROOM_PLAY_W / 2, ROOM_PLAY_H / 2, 'chest');
      return;
    }
    // 特殊房本来就没有敌人，进门即「已清空」，不该白送一份清房奖励
    if (this.type !== ROOM_TYPE.NORMAL) return;

    // 普通房的清空奖励：大概率什么都不掉，这点和原作一致
    const roll = this.rng.next();
    if (roll < 0.22) return;
    const kind = this.rng.weighted([
      { w: 22, v: 'heart' }, { w: 20, v: 'penny' }, { w: 12, v: 'bomb' },
      { w: 12, v: 'key' }, { w: 6, v: 'chest' }, { w: 4, v: 'soulheart' },
      { w: 3, v: 'pill' }, { w: 3, v: 'card' }, { w: 2, v: 'nickel' },
    ]).v;
    this.dropPickup(ROOM_PLAY_W / 2, ROOM_PLAY_H / 2, kind);
  }

  openDoors() {
    this.doorOpenAnim = 1;
  }

  /** 房间是否允许通过某个方向的门 */
  doorPassable(dir) {
    const door = this.node.doors[dir];
    if (!door) return false;
    if (door.hidden) return false;
    if (door.locked) return false;
    return this.cleared;
  }
}
