// 投射物、拾取物、粒子、爆炸、地面污渍。

import { TILE, ROOM_W, ROOM_H, PICKUP_SPRITES } from './tiles.js';
import { buildTear, buildBloodShot } from './sprites.js';
import { PAL } from './palette.js';
import { norm, clamp, dist2 } from './util.js';

export const ROOM_PLAY_W = ROOM_W * TILE;
export const ROOM_PLAY_H = ROOM_H * TILE;

// 预烘焙几种尺寸的眼泪与血弹
const tearCache = new Map();
export function tearSprite(size, color) {
  // 尺寸取整：既保证精灵是整数像素，也避免浮点 size 把缓存撑爆
  size = Math.max(3, Math.round(size));
  const key = `${size}:${color}`;
  if (!tearCache.has(key)) {
    tearCache.set(key, color === 'blood'
      ? buildBloodShot(size)
      : buildTear(size, color === 'gold' ? '#ffe694' : PAL.tear,
                        color === 'gold' ? '#b08a18' : PAL.tearDark));
  }
  return tearCache.get(key);
}

let nextId = 1;

export class Projectile {
  constructor(o) {
    this.id = nextId++;
    this.x = o.x; this.y = o.y;
    this.vx = o.vx; this.vy = o.vy;
    this.damage = o.damage;
    this.friendly = !!o.friendly;
    this.r = o.r || 5;
    this.life = o.life !== undefined ? o.life : 1.2;
    this.maxLife = this.life;
    this.pierce = !!o.pierce;
    this.homing = !!o.homing;
    this.explosive = !!o.explosive;
    this.spectral = !!o.spectral;   // 穿墙穿石
    this.arc = !!o.arc;             // 抛物线（Ipecac）
    // 碰撞一律在地面投影上算（x, y 就是地面坐标），hz 只是渲染时抬高的视觉高度。
    // 这样贴脸的敌人也打得中 —— 否则子弹会从它头顶飞过去。
    this.hz = o.hz || 0;
    this.z = 0;                      // 抛物线的真实离地高度
    this.vz = o.arc ? 150 : 0;
    this.color = o.color || (o.friendly ? 'tear' : 'blood');
    this.size = o.size || 5;
    this.sprite = tearSprite(this.size, this.color);
    this.hitSet = new Set();
    this.dead = false;
    this.laser = !!o.laser;
    this.rotation = 0;
    this.knife = !!o.knife;
  }

  update(dt, room, game) {
    if (this.arc) {
      this.vz -= 420 * dt;
      this.z += this.vz * dt;
      if (this.z <= 0 && this.vz < 0) { this.explode(room, game); return; }
    }
    if (this.homing) {
      const t = room.nearestTarget(this.x, this.y, this.friendly, 200);
      if (t) {
        const [hx, hy] = norm(t.x - this.x, t.y - this.y, 1);
        const sp = Math.hypot(this.vx, this.vy);
        this.vx += hx * sp * 5.5 * dt;
        this.vy += hy * sp * 5.5 * dt;
        const [nx, ny] = norm(this.vx, this.vy, sp);
        this.vx = nx; this.vy = ny;
      }
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += dt * 14;

    this.life -= dt;
    if (this.life <= 0) { this.expire(room, game); return; }

    // 撞墙
    const pad = this.r * 0.5;
    if (this.x < pad || this.x > ROOM_PLAY_W - pad || this.y < pad || this.y > ROOM_PLAY_H - pad) {
      if (!this.spectral) { this.expire(room, game); return; }
    }
    // 撞障碍（抛物线弹道在空中时飞过障碍）
    if (!this.spectral && (!this.arc || this.z < 12)) {
      const ob = room.obstacleAt(this.x, this.y);
      if (ob && ob.blocksShots) {
        if (this.explosive) this.explode(room, game);
        else {
          room.addDecal(this.x, this.y, this.friendly ? 'tear' : 'blood', this.size);
          room.hitObstacle(ob, this.damage, game);
          this.dead = true;
        }
        return;
      }
    }
  }

  expire(room, game) {
    if (this.explosive) { this.explode(room, game); return; }
    room.addDecal(this.x, this.y, this.friendly ? 'tear' : 'blood', this.size);
    room.spawnSplash(this.x, this.y, this.friendly ? PAL.tear : PAL.blood);
    this.dead = true;
  }

  explode(room, game) {
    this.dead = true;
    room.spawnExplosion(this.x, this.y, this.damage, this.friendly, game, { poison: this.poison });
  }

  onHit(room, game) {
    room.spawnSplash(this.x, this.y, this.friendly ? PAL.tear : PAL.blood);
    if (this.explosive) { this.explode(room, game); return; }
    if (!this.pierce) {
      room.addDecal(this.x, this.y, this.friendly ? 'tear' : 'blood', this.size);
      this.dead = true;
    }
  }
}

/** 激光：瞬时的一条射线，只存在几帧 */
export class Laser {
  constructor(o) {
    this.x = o.x; this.y = o.y;
    this.hz = o.hz || 0;
    this.dx = o.dx; this.dy = o.dy;
    this.length = o.length;
    this.width = o.width || 8;
    this.damage = o.damage;
    this.friendly = !!o.friendly;
    this.life = 0.22;
    this.maxLife = this.life;
    this.brimstone = !!o.brimstone;
    this.dead = false;
    this.hitSet = new Set();
    this.tickTimer = 0;
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
}

export class Pickup {
  constructor(x, y, kind, opts = {}) {
    this.x = x; this.y = y;
    this.kind = kind;
    this.r = 9;
    this.bob = Math.random() * Math.PI * 2;
    this.price = opts.price || 0;
    this.heartPrice = opts.heartPrice || 0;   // 恶魔房：用半心数量标价
    this.item = opts.item || null;      // 道具对象（基座上的）
    this.pedestal = !!opts.pedestal;
    this.dead = false;
    this.pickupDelay = opts.delay || 0;
    this.vx = opts.vx || 0;
    this.vy = opts.vy || 0;
    this.z = opts.z || 0;
    this.vz = opts.vz || 0;
  }
  update(dt) {
    this.bob += dt * 3;
    if (this.pickupDelay > 0) this.pickupDelay -= dt;
    if (this.vz || this.z > 0) {
      this.vz -= 500 * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) { this.z = 0; this.vz = 0; }
    }
    if (this.vx || this.vy) {
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.vx *= 0.88; this.vy *= 0.88;
      this.x = clamp(this.x, 12, ROOM_PLAY_W - 12);
      this.y = clamp(this.y, 12, ROOM_PLAY_H - 12);
      if (Math.abs(this.vx) < 2) this.vx = 0;
      if (Math.abs(this.vy) < 2) this.vy = 0;
    }
  }
  get sprite() { return PICKUP_SPRITES[this.kind] || PICKUP_SPRITES.penny; }
}

/** 玩家扔出的炸弹 */
export class Bomb {
  constructor(x, y, opts = {}) {
    this.x = x; this.y = y;
    this.vx = opts.vx || 0; this.vy = opts.vy || 0;
    this.fuse = 1.6;
    this.r = 8;
    this.poison = !!opts.poison;
    this.damage = opts.damage || 60;
    this.friendly = opts.friendly !== false;
    this.dead = false;
    this.flash = 0;
  }
  update(dt, room, game) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.9; this.vy *= 0.9;
    this.x = clamp(this.x, 10, ROOM_PLAY_W - 10);
    this.y = clamp(this.y, 10, ROOM_PLAY_H - 10);
    this.fuse -= dt;
    this.flash += dt * (this.fuse < 0.5 ? 22 : 9);
    if (this.fuse <= 0) {
      this.dead = true;
      room.spawnExplosion(this.x, this.y, this.damage, this.friendly, game, {
        radius: 62, poison: this.poison, breakRocks: true,
      });
    }
  }
}

export class Explosion {
  constructor(x, y, radius) {
    this.x = x; this.y = y;
    this.radius = radius;
    this.life = 0.4;
    this.maxLife = this.life;
    this.dead = false;
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
}

export class Particle {
  constructor(o) {
    this.x = o.x; this.y = o.y;
    this.vx = o.vx; this.vy = o.vy;
    this.vz = o.vz || 0;
    this.z = o.z || 0;
    this.gravity = o.gravity !== undefined ? o.gravity : 380;
    this.life = o.life || 0.5;
    this.maxLife = this.life;
    this.color = o.color;
    this.size = o.size || 2;
    this.shrink = o.shrink !== false;
    this.drag = o.drag !== undefined ? o.drag : 0.9;
    this.dead = false;
    this.glow = !!o.glow;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.gravity) {
      this.vz -= this.gravity * dt;
      this.z += this.vz * dt;
      if (this.z < 0) { this.z = 0; this.vz *= -0.35; if (Math.abs(this.vz) < 12) this.vz = 0; }
    }
    const d = Math.pow(this.drag, dt * 60);
    this.vx *= d; this.vy *= d;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
}

/** 地面污渍：眼泪的水渍、敌人的血迹，永久留在房间里 */
export class Decal {
  constructor(x, y, kind, size) {
    this.x = x; this.y = y;
    this.kind = kind;
    this.size = size;
    this.seed = Math.random() * 1000;
    this.alpha = kind === 'blood' ? 0.72 : 0.4;
  }
}

/** 飘起来的伤害数字 / 提示文字 */
export class FloatText {
  constructor(x, y, text, color, opts = {}) {
    this.x = x; this.y = y;
    this.text = text;
    this.color = color;
    this.life = opts.life || 0.9;
    this.maxLife = this.life;
    this.vy = opts.vy || -34;
    this.size = opts.size || 10;
    this.dead = false;
  }
  update(dt) {
    this.y += this.vy * dt;
    this.vy *= 0.94;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
}

export { dist2 };
