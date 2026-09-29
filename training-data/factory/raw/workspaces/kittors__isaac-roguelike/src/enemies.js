// 敌人：数据表 + 行为机。
// 血量单位与原作一致 —— 玩家的心按「半颗」计数，普通敌人接触伤害为 1（半颗心），
// 进入子宫（第 4 章）之后翻倍。

import { ENEMY_SPRITES } from './sprites.js';
import { Projectile } from './entities.js';
import { norm } from './util.js';
import { ROOM_PLAY_W, ROOM_PLAY_H } from './entities.js';

/**
 * behavior 说明：
 *   chase      直线追踪
 *   wander     无规则乱飞（苍蝇）
 *   dart       盯上玩家后直线加速撞过来
 *   hover      缓慢靠近并定期射击
 *   turret     原地不动，玩家进入范围就射击
 *   charge     锁定同一行 / 列后高速冲刺，撞墙后眩晕
 *   hop        蓄力—跳跃—落地的循环
 *   flee       躲着玩家走，死后炸出苍蝇
 *   shell      缩进壳里无敌，定期探头三连射
 *   diagonal   45° 对角线弹射，撞墙反弹
 */
export const ENEMY_DEFS = {
  fly:            { hp: 3,  speed: 62,  r: 7,  behavior: 'wander',  flying: true,  sprite: 'fly', fps: 14 },
  attackfly:      { hp: 5,  speed: 118, r: 7,  behavior: 'dart',    flying: true,  sprite: 'attackfly', fps: 16 },
  pooter:         { hp: 10, speed: 34,  r: 9,  behavior: 'hover',   flying: true,  sprite: 'pooter', fps: 12,
                    shoot: { interval: 1.8, speed: 150, damage: 1, size: 5 } },
  boomfly:        { hp: 10, speed: 118, r: 9,  behavior: 'diagonal', flying: true, sprite: 'boomfly', fps: 16,
                    deathExplode: true },
  gaper:          { hp: 10, speed: 46,  r: 9,  behavior: 'chase',   sprite: 'gaper', fps: 6 },
  frowninggaper:  { hp: 14, speed: 72,  r: 9,  behavior: 'chase',   sprite: 'frowninggaper', fps: 8,
                    deathBurst: { count: 6, speed: 130, damage: 1 } },
  horf:           { hp: 8,  speed: 0,   r: 9,  behavior: 'turret',  sprite: 'horf', fps: 4,
                    shoot: { interval: 1.5, speed: 190, damage: 1, size: 6, range: 200 } },
  clotty:         { hp: 12, speed: 0,   r: 9,  behavior: 'turret',  sprite: 'clotty', fps: 3,
                    shoot: { interval: 2.0, speed: 160, damage: 1, size: 5, pattern: 'cross' } },
  charger:        { hp: 14, speed: 42,  r: 9,  behavior: 'charge',  sprite: 'charger', fps: 8, chargeSpeed: 320 },
  spider:         { hp: 6,  speed: 100, r: 7,  behavior: 'hop',     sprite: 'spider', fps: 10, hopRange: 70 },
  trite:          { hp: 8,  speed: 190, r: 7,  behavior: 'hop',     sprite: 'trite', fps: 10, hopRange: 130, flying: true },
  mulligan:       { hp: 10, speed: 40,  r: 9,  behavior: 'flee',    sprite: 'mulligan', fps: 6,
                    deathFlies: 3 },
  host:           { hp: 12, speed: 0,   r: 10, behavior: 'shell',   sprite: 'host', fps: 2,
                    shoot: { interval: 2.4, speed: 175, damage: 1, size: 5, spread: 3 } },
  dip:            { hp: 4,  speed: 34,  r: 6,  behavior: 'chase',   sprite: 'dip', fps: 5 },
  sucker:         { hp: 10, speed: 30,  r: 8,  behavior: 'hover',   flying: true, sprite: 'sucker', fps: 4,
                    shoot: { interval: 2.6, speed: 210, damage: 1, size: 8 } },
};

export const CHAMPION_TINTS = [
  { color: '#e8c04a', name: 'yellow', hpMul: 2.0, drop: 'penny' },
  { color: '#4a8ae8', name: 'blue',   hpMul: 1.2, drop: 'soulheart', speedMul: 1.4 },
  { color: '#e84a4a', name: 'red',    hpMul: 1.8, drop: 'heart' },
  { color: '#8a4ae8', name: 'purple', hpMul: 1.5, drop: 'bomb' },
];

let eid = 1;

export class Enemy {
  constructor(kind, x, y, level, opts = {}) {
    const def = ENEMY_DEFS[kind] || ENEMY_DEFS.gaper;
    this.id = eid++;
    this.kind = kind;
    this.def = def;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = def.r;
    this.flying = !!def.flying;

    // 血量随层数增长
    const scale = 1 + (level - 1) * 0.17;
    this.maxHp = Math.round(def.hp * scale * (opts.miniboss ? 3.2 : 1));
    this.champion = opts.champion ? CHAMPION_TINTS[(Math.random() * CHAMPION_TINTS.length) | 0] : null;
    if (this.champion) this.maxHp = Math.round(this.maxHp * this.champion.hpMul);
    this.hp = this.maxHp;

    this.speed = def.speed * (this.champion?.speedMul || 1) * (opts.miniboss ? 1.15 : 1);
    this.miniboss = !!opts.miniboss;
    this.scaleUp = opts.miniboss ? 1.35 : 1;

    this.touchDamage = level >= 7 ? 2 : 1;   // 子宫之后接触伤害翻倍
    this.dead = false;
    this.hitFlash = 0;
    this.knockX = 0; this.knockY = 0;

    // 行为状态
    this.t = Math.random() * 5;
    this.shootTimer = (def.shoot?.interval || 2) * (0.4 + Math.random() * 0.8);
    this.state = 'idle';
    this.stateTimer = 0;
    this.frame = 0;
    this.facing = 1;
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.chargeDir = [0, 0];
    this.z = 0; this.vz = 0;
    this.spawnAnim = 0.35;   // 出生时的浮现动画
  }

  get sprites() { return ENEMY_SPRITES[this.def.sprite] || ENEMY_SPRITES.gaper; }

  hurt(amount, room, game, kb) {
    if (this.spawnAnim > 0) return;
    this.hp -= amount;
    this.hitFlash = 0.12;
    if (kb) { this.knockX += kb[0]; this.knockY += kb[1]; }
    room.spawnBloodSpray(this.x, this.y - 8, 3);
    if (this.hp <= 0) this.die(room, game);
  }

  die(room, game) {
    if (this.dead) return;
    this.dead = true;
    room.spawnBloodSpray(this.x, this.y - 8, 14);
    room.addDecal(this.x, this.y, 'blood', 9);
    game.audio.play('splat');

    const def = this.def;
    if (def.deathExplode) {
      room.spawnExplosion(this.x, this.y, 30, false, game, { radius: 48, breakRocks: true });
    }
    if (def.deathFlies) {
      for (let i = 0; i < def.deathFlies; i++) {
        const a = (i / def.deathFlies) * Math.PI * 2;
        const e = new Enemy('fly', this.x + Math.cos(a) * 14, this.y + Math.sin(a) * 14, room.level);
        e.spawnAnim = 0.15;
        room.enemies.push(e);
      }
    }
    if (def.deathBurst) {
      for (let i = 0; i < def.deathBurst.count; i++) {
        const a = (i / def.deathBurst.count) * Math.PI * 2;
        room.projectiles.push(new Projectile({
          x: this.x, y: this.y,
          vx: Math.cos(a) * def.deathBurst.speed,
          vy: Math.sin(a) * def.deathBurst.speed,
          damage: def.deathBurst.damage, friendly: false, size: 5, life: 1.4, hz: 10,
        }));
      }
    }
    // 冠军怪必掉，普通怪按概率
    if (this.champion) room.dropPickup(this.x, this.y, this.champion.drop);
    else if (this.miniboss) {
      room.dropPickup(this.x, this.y, 'heart');
      room.dropPickup(this.x + 20, this.y, 'penny');
    }
  }

  update(dt, room, game) {
    this.t += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.spawnAnim > 0) { this.spawnAnim -= dt; return; }

    const p = game.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;

    switch (this.def.behavior) {
      case 'chase': this.doChase(dt, dx, dy, d); break;
      case 'wander': this.doWander(dt, dx, dy, d); break;
      case 'dart': this.doDart(dt, dx, dy, d); break;
      case 'hover': this.doHover(dt, dx, dy, d, room, game); break;
      case 'turret': this.doTurret(dt, dx, dy, d, room, game); break;
      case 'charge': this.doCharge(dt, dx, dy, d, room, game); break;
      case 'hop': this.doHop(dt, dx, dy, d); break;
      case 'flee': this.doFlee(dt, dx, dy, d); break;
      case 'shell': this.doShell(dt, dx, dy, d, room, game); break;
      case 'diagonal': this.doDiagonal(dt, room); break;
      default: this.doChase(dt, dx, dy, d);
    }

    // 击退衰减
    this.x += this.knockX * dt;
    this.y += this.knockY * dt;
    this.knockX *= Math.pow(0.02, dt);
    this.knockY *= Math.pow(0.02, dt);

    // 移动 + 碰撞
    room.moveEntity(this, this.vx * dt, this.vy * dt);
    if (dx !== 0) this.facing = this.vx >= 0 ? 1 : -1;

    // 敌人之间互相推开，避免重叠成一坨
    for (const o of room.enemies) {
      if (o === this || o.dead) continue;
      const ox = o.x - this.x, oy = o.y - this.y;
      const od = Math.hypot(ox, oy);
      const min = this.r + o.r;
      if (od > 0.01 && od < min) {
        const push = (min - od) / min * 60 * dt;
        const [nx, ny] = norm(ox, oy, push);
        this.x -= nx; this.y -= ny;
        o.x += nx; o.y += ny;
      }
    }

    this.frame = Math.floor(this.t * (this.def.fps || 8)) % this.sprites.length;
  }

  // --- 行为实现 -----------------------------------------------------------

  doChase(dt, dx, dy, d) {
    const [nx, ny] = norm(dx, dy, this.speed);
    this.vx += (nx - this.vx) * 6 * dt;
    this.vy += (ny - this.vy) * 6 * dt;
  }

  doWander(dt, dx, dy, d) {
    // 苍蝇：整体朝玩家漂，但叠加大量随机抖动
    this.wanderAngle += (Math.random() - 0.5) * 9 * dt;
    const wx = Math.cos(this.wanderAngle), wy = Math.sin(this.wanderAngle);
    const [tx, ty] = norm(dx, dy, 1);
    const bias = d > 150 ? 0.7 : 0.25;
    this.vx = (wx * (1 - bias) + tx * bias) * this.speed;
    this.vy = (wy * (1 - bias) + ty * bias) * this.speed;
  }

  doDart(dt, dx, dy, d) {
    // 直冲：始终以最高速朝玩家，转向很慢，所以会冲过头
    const [nx, ny] = norm(dx, dy, this.speed);
    this.vx += (nx - this.vx) * 2.2 * dt;
    this.vy += (ny - this.vy) * 2.2 * dt;
  }

  doHover(dt, dx, dy, d, room, game) {
    const target = 110;   // 维持中距离
    const dir = d > target ? 1 : -0.6;
    const [nx, ny] = norm(dx, dy, this.speed * dir);
    this.vx += (nx - this.vx) * 3 * dt;
    this.vy += (ny - this.vy) * 3 * dt;
    this.tryShoot(dt, dx, dy, d, room, game);
  }

  doTurret(dt, dx, dy, d, room, game) {
    this.vx = 0; this.vy = 0;
    this.tryShoot(dt, dx, dy, d, room, game);
  }

  doCharge(dt, dx, dy, d, room, game) {
    const s = this.def;
    if (this.state === 'idle') {
      // 缓慢游走，等待玩家进入同一行或同一列
      this.wanderAngle += (Math.random() - 0.5) * 4 * dt;
      this.vx = Math.cos(this.wanderAngle) * this.speed;
      this.vy = Math.sin(this.wanderAngle) * this.speed;
      const aligned = Math.abs(dy) < 22 || Math.abs(dx) < 22;
      if (aligned && d < 260) {
        this.state = 'windup';
        this.stateTimer = 0.42;
        this.chargeDir = Math.abs(dy) < 22 ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dy) || 1];
        game.audio.play('growl');
      }
    } else if (this.state === 'windup') {
      this.vx = -this.chargeDir[0] * 24;   // 后仰蓄力
      this.vy = -this.chargeDir[1] * 24;
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) { this.state = 'charging'; this.stateTimer = 1.6; }
    } else if (this.state === 'charging') {
      this.vx = this.chargeDir[0] * s.chargeSpeed;
      this.vy = this.chargeDir[1] * s.chargeSpeed;
      this.stateTimer -= dt;
      const hitWall =
        (this.x <= this.r + 2 && this.chargeDir[0] < 0) ||
        (this.x >= ROOM_PLAY_W - this.r - 2 && this.chargeDir[0] > 0) ||
        (this.y <= this.r + 2 && this.chargeDir[1] < 0) ||
        (this.y >= ROOM_PLAY_H - this.r - 2 && this.chargeDir[1] > 0);
      if (this.stateTimer <= 0 || hitWall) {
        this.state = 'stunned'; this.stateTimer = 0.8;
        if (hitWall) { room.shake(4); game.audio.play('thud'); }
      }
    } else {
      this.vx *= 0.85; this.vy *= 0.85;
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.state = 'idle';
    }
  }

  doHop(dt, dx, dy, d) {
    if (this.state === 'idle') {
      this.vx *= 0.8; this.vy *= 0.8;
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'hop';
        this.stateTimer = 0.32;
        const jitter = (Math.random() - 0.5) * 0.8;
        const a = Math.atan2(dy, dx) + jitter;
        this.vx = Math.cos(a) * this.speed;
        this.vy = Math.sin(a) * this.speed;
        this.vz = 90;
      }
    } else {
      this.stateTimer -= dt;
      this.vz -= 380 * dt;
      this.z = Math.max(0, this.z + this.vz * dt);
      if (this.stateTimer <= 0) {
        this.state = 'idle';
        this.stateTimer = 0.25 + Math.random() * 0.3;
        this.z = 0; this.vz = 0;
      }
    }
  }

  doFlee(dt, dx, dy, d) {
    // 躲着玩家跑，但会被墙逼到角落
    const [nx, ny] = norm(-dx, -dy, this.speed);
    const wallPushX = (this.x < 60 ? 1 : 0) - (this.x > ROOM_PLAY_W - 60 ? 1 : 0);
    const wallPushY = (this.y < 60 ? 1 : 0) - (this.y > ROOM_PLAY_H - 60 ? 1 : 0);
    this.vx += (nx + wallPushX * this.speed - this.vx) * 3 * dt;
    this.vy += (ny + wallPushY * this.speed - this.vy) * 3 * dt;
  }

  doShell(dt, dx, dy, d, room, game) {
    this.vx = 0; this.vy = 0;
    this.shootTimer -= dt;
    if (this.state === 'idle') {
      this.invulnerable = true;
      this.frameOverride = 0;
      if (this.shootTimer <= 0 && d < 240) {
        this.state = 'peek';
        this.stateTimer = 0.9;
        this.invulnerable = false;
        this.fired = false;
      }
    } else {
      this.frameOverride = 1;
      this.stateTimer -= dt;
      if (!this.fired && this.stateTimer < 0.55) {
        this.fired = true;
        this.fireSpread(dx, dy, room, this.def.shoot);
        game.audio.play('shoot_enemy');
      }
      if (this.stateTimer <= 0) {
        this.state = 'idle';
        this.invulnerable = true;
        this.shootTimer = this.def.shoot.interval;
      }
    }
  }

  doDiagonal(dt, room) {
    // Boom Fly：45° 直线飞，碰墙反弹
    if (!this.dirSet) {
      const a = (Math.floor(Math.random() * 4) * 2 + 1) * Math.PI / 4;
      this.vx = Math.cos(a) * this.speed;
      this.vy = Math.sin(a) * this.speed;
      this.dirSet = true;
    }
    if (this.x < this.r && this.vx < 0) this.vx = -this.vx;
    if (this.x > ROOM_PLAY_W - this.r && this.vx > 0) this.vx = -this.vx;
    if (this.y < this.r && this.vy < 0) this.vy = -this.vy;
    if (this.y > ROOM_PLAY_H - this.r && this.vy > 0) this.vy = -this.vy;
  }

  // --- 射击 ---------------------------------------------------------------

  tryShoot(dt, dx, dy, d, room, game) {
    const s = this.def.shoot;
    if (!s) return;
    this.shootTimer -= dt;
    if (this.shootTimer > 0) return;
    if (s.range && d > s.range) return;
    this.shootTimer = s.interval * (0.8 + Math.random() * 0.4);

    if (s.pattern === 'cross') {
      for (const [vx, vy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        room.projectiles.push(new Projectile({
          x: this.x, y: this.y, vx: vx * s.speed, vy: vy * s.speed,
          damage: s.damage, friendly: false, size: s.size, life: 1.6, hz: 10,
        }));
      }
    } else {
      const [nx, ny] = norm(dx, dy, s.speed);
      room.projectiles.push(new Projectile({
        x: this.x, y: this.y, vx: nx, vy: ny,
        damage: s.damage, friendly: false, size: s.size, life: 1.8, hz: 10,
      }));
    }
    game.audio.play('shoot_enemy');
  }

  fireSpread(dx, dy, room, s) {
    const base = Math.atan2(dy, dx);
    const n = s.spread || 3;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.32;
      room.projectiles.push(new Projectile({
        x: this.x, y: this.y,
        vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
        damage: s.damage, friendly: false, size: s.size, life: 1.8, hz: 10,
      }));
    }
  }
}
