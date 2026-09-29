// 玩家角色。操作沿用原作：WASD 移动，方向键射击，两者互相独立 ——
// 身体朝移动方向、脑袋朝射击方向，这是以撒手感的根基。

import { buildIsaac } from './sprites.js';
import { Projectile, Laser, Bomb, ROOM_PLAY_W, ROOM_PLAY_H } from './entities.js';
import { computeStats, tearsPerSecond } from './items.js';
import { norm, clamp, vecToDir, DIR } from './util.js';

const BASE_MOVE = 132;      // speed 1.0 时的移动速度（像素/秒）
const BASE_TEAR_SPEED = 250;

export class Player {
  constructor(game) {
    this.game = game;
    this.sprites = buildIsaac();

    this.x = ROOM_PLAY_W / 2;
    this.y = ROOM_PLAY_H / 2;
    this.vx = 0; this.vy = 0;
    this.r = 9;

    // 生命：以「半颗心」为单位
    this.maxHearts = 6;
    this.redHearts = 6;
    this.soulHearts = 0;
    this.extraLives = 0;

    this.coins = 0;
    this.bombs = 1;
    this.keys = 1;

    this.items = [];
    this.ownedIds = new Set();
    this.activeItem = null;
    this.activeCharge = 0;
    this.buffs = [];
    this.flags = {};
    this.stats = computeStats([], []);

    this.fireTimer = 0;
    this.chargeTime = 0;       // Brimstone 蓄力
    this.invuln = 0;
    this.hurtFlash = 0;
    this.dead = false;

    this.moveDir = DIR.DOWN;
    this.headDir = DIR.DOWN;
    this.walkPhase = 0;
    this.headBob = 0;
    this.t = 0;
    this.tearOffset = 0;       // 多连发时左右交替的偏移
  }

  get totalHearts() { return this.redHearts + this.soulHearts; }

  recomputeStats() {
    this.stats = computeStats(this.items, this.buffs);
    this.flags = {};
    for (const it of this.items) {
      if (it.flags) Object.assign(this.flags, it.flags);
    }
  }

  addItem(item) {
    if (item.hpUp) this.maxHearts += item.hpUp * 2;
    if (item.heal) this.heal(item.heal);
    if (item.flags?.deadCat) {
      this.maxHearts = 2; this.redHearts = 2; this.extraLives += 8;
    }
    this.items.push(item);
    this.ownedIds.add(item.id);
    this.recomputeStats();
    this.game.audio.play('powerup');
    this.game.showItemBanner(item);
  }

  setActiveItem(item) {
    this.activeItem = item;
    this.activeCharge = item.charge;   // 拿到时是满的
    this.ownedIds.add(item.id);
  }

  addBuff(stat, amount, duration) {
    this.buffs.push({ stat, amount, time: duration, room: true });
    this.recomputeStats();
  }

  heal(halfHearts) {
    this.redHearts = Math.min(this.maxHearts, this.redHearts + halfHearts);
  }

  addSoulHearts(n) {
    this.soulHearts = Math.min(12, this.soulHearts + n);
  }

  hurt(amount, source) {
    if (this.invuln > 0 || this.dead) return false;
    let dmg = amount;
    if (this.flags.wafer) dmg = Math.max(1, Math.ceil(dmg / 2));

    if (this.soulHearts > 0) {
      const take = Math.min(this.soulHearts, dmg);
      this.soulHearts -= take;
      dmg -= take;
    }
    if (dmg > 0) {
      this.redHearts -= dmg;
      this.game.tookRedDamageThisFloor = true;   // 本层掉过红心，恶魔房概率会降低
    }

    this.invuln = 1.0;
    this.hurtFlash = 0.35;
    this.game.audio.play('hurt');
    this.game.room.shake(6);
    this.game.room.spawnBloodSpray(this.x, this.y - 10, 8);

    // 被打时会被击退
    if (source) {
      const [kx, ky] = norm(this.x - source.x, this.y - source.y, 220);
      this.vx += kx; this.vy += ky;
    }

    if (this.redHearts <= 0 && this.soulHearts <= 0) {
      if (this.extraLives > 0) {
        this.extraLives--;
        this.redHearts = Math.max(2, this.maxHearts);
        this.invuln = 2.0;
        this.game.audio.play('revive');
      } else {
        this.dead = true;
        this.game.onPlayerDied();
      }
    }
    return true;
  }

  update(dt, input, room, game) {
    this.t += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.fireTimer > 0) this.fireTimer -= dt;

    // 房间限定的临时增益
    for (const b of this.buffs) b.time -= dt;
    if (this.buffs.some((b) => b.time <= 0)) {
      this.buffs = this.buffs.filter((b) => b.time > 0);
      this.recomputeStats();
    }

    // --- 移动 ---
    const [ix, iy] = input.moveVector();
    const targetSpeed = BASE_MOVE * this.stats.speed * (room.slowFactorAt(this.x, this.y));
    const accel = (ix || iy) ? 16 : 11;
    this.vx += (ix * targetSpeed - this.vx) * accel * dt;
    this.vy += (iy * targetSpeed - this.vy) * accel * dt;
    if (Math.abs(this.vx) < 1.5) this.vx = 0;
    if (Math.abs(this.vy) < 1.5) this.vy = 0;

    room.moveEntity(this, this.vx * dt, this.vy * dt);
    this.x = clamp(this.x, this.r, ROOM_PLAY_W - this.r);
    this.y = clamp(this.y, this.r, ROOM_PLAY_H - this.r);

    const moving = Math.hypot(this.vx, this.vy) > 12;
    if (moving) {
      this.moveDir = vecToDir(this.vx, this.vy);
      this.walkPhase += dt * Math.min(14, 5 + Math.hypot(this.vx, this.vy) * 0.05);
    } else {
      this.walkPhase += dt * 2;
    }

    // --- 射击 ---
    const [fx, fy] = input.fireVector();
    if (fx || fy) {
      this.headDir = vecToDir(fx, fy);
      if (this.flags.brimstone) {
        this.chargeTime += dt;
      } else if (this.fireTimer <= 0) {
        this.shoot(fx, fy, room, game);
        this.fireTimer = 1 / tearsPerSecond(this.stats.tearDelay);
      }
    } else if (this.flags.brimstone && this.chargeTime > 0) {
      // 松手放激光
      const need = 1 / tearsPerSecond(this.stats.tearDelay);
      if (this.chargeTime >= Math.min(0.55, need)) {
        this.fireBrimstone(room, game);
      }
      this.chargeTime = 0;
    }

    // 头部的轻微上下浮动，让静止时也有生气
    this.headBob = Math.sin(this.walkPhase * 1.6) * (moving ? 1.6 : 0.7);
  }

  shoot(fx, fy, room, game) {
    const s = this.stats;
    const [dx, dy] = norm(fx, fy, 1);
    const speed = BASE_TEAR_SPEED * s.shotSpeed;
    const life = clamp(s.range * 0.135, 0.25, 2.2);
    const count = this.flags.multiShot || 1;
    const size = this.flags.bigTear ? 11 : clamp(4 + s.damage * 0.5, 4, 10);

    // 出生点用地面坐标，hz 负责把它画到头的高度
    const ox = this.x + dx * 8, oy = this.y + dy * 6;
    const HZ = 16;

    if (this.flags.laser) {
      room.lasers.push(new Laser({
        x: ox, y: oy, dx, dy, length: 420, width: 6,
        damage: s.damage, friendly: true, hz: HZ,
      }));
      game.audio.play('laser');
      return;
    }

    for (let i = 0; i < count; i++) {
      // 多连发时左右微微错开，模拟原作 20/20 与内在之眼的散布
      const spreadAngle = count > 1 ? (i - (count - 1) / 2) * 0.11 : 0;
      const perp = count > 1 ? (i - (count - 1) / 2) * 5 : 0;
      const a = Math.atan2(dy, dx) + spreadAngle;
      const accuracy = (Math.random() - 0.5) * 0.03;
      room.projectiles.push(new Projectile({
        x: ox - dy * perp, y: oy + dx * perp,
        vx: Math.cos(a + accuracy) * speed + this.vx * 0.28,
        vy: Math.sin(a + accuracy) * speed + this.vy * 0.28,
        damage: s.damage, friendly: true,
        size, life,
        pierce: this.flags.pierce,
        homing: this.flags.homing,
        explosive: this.flags.explosive,
        arc: this.flags.arc,
        knife: this.flags.knife,
        color: this.flags.knife ? 'gold' : 'tear',
        r: size, hz: HZ,
      }));
    }
    game.audio.play('shoot');
  }

  fireBrimstone(room, game) {
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const [dx, dy] = dirs[this.headDir];
    room.lasers.push(new Laser({
      x: this.x, y: this.y, dx, dy, length: 500, width: 16,
      damage: this.stats.damage * 1.6, friendly: true, brimstone: true, hz: 16,
    }));
    game.audio.play('brimstone');
    room.shake(4);
  }

  /** 塔米之头：向四周射一圈 */
  burstShot(count) {
    const room = this.game.room;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      room.projectiles.push(new Projectile({
        x: this.x, y: this.y,
        vx: Math.cos(a) * BASE_TEAR_SPEED * this.stats.shotSpeed,
        vy: Math.sin(a) * BASE_TEAR_SPEED * this.stats.shotSpeed,
        damage: this.stats.damage, friendly: true,
        size: 7, life: clamp(this.stats.range * 0.135, 0.3, 2),
        pierce: this.flags.pierce, homing: this.flags.homing, hz: 16,
      }));
    }
    this.game.audio.play('shoot');
  }

  throwBomb(poison = false) {
    if (!poison && this.bombs <= 0) return false;
    if (!poison) this.bombs--;
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const [dx, dy] = dirs[this.moveDir];
    this.game.room.bombs.push(new Bomb(this.x, this.y + 4, {
      vx: dx * 60 + this.vx * 0.4, vy: dy * 60 + this.vy * 0.4,
      poison, damage: 60,
    }));
    this.game.audio.play('place');
    return true;
  }

  useActive() {
    if (!this.activeItem) return;
    if (this.activeCharge < this.activeItem.charge) return;
    const ok = this.activeItem.use(this.game);
    if (ok !== false) {
      this.activeCharge = 0;
      this.game.audio.play('use');
    }
  }

  chargeActive(n = 1) {
    if (!this.activeItem) return;
    this.activeCharge = Math.min(this.activeItem.charge, this.activeCharge + n);
  }

  /** 当前该用哪一组身体帧 */
  bodySprite() {
    const frames = (this.moveDir === DIR.LEFT || this.moveDir === DIR.RIGHT)
      ? this.sprites.bodySide : this.sprites.bodyFront;
    const f = Math.floor(this.walkPhase) % frames.length;
    return { sprite: frames[f], flip: this.moveDir === DIR.LEFT };
  }

  headSprite() {
    return this.sprites.heads[this.headDir];
  }
}
