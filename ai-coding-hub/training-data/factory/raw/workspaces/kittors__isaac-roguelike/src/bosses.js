// Boss：每只一套阶段化的攻击循环，血量低于一半后进入狂暴节奏。

import { BOSS_SPRITES } from './sprites.js';
import { Projectile } from './entities.js';
import { Enemy } from './enemies.js';
import { norm, clamp } from './util.js';
import { ROOM_PLAY_W, ROOM_PLAY_H } from './entities.js';

export const BOSS_DEFS = {
  monstro: { name: 'MONSTRO', hp: 250, r: 30, sprite: 'monstro', touch: 1 },
  duke:    { name: '苍蝇之王', hp: 220, r: 26, sprite: 'duke', touch: 1 },
  larry:   { name: '小拉里', hp: 200, r: 16, sprite: 'larryhead', touch: 1 },
  gemini:  { name: '双子', hp: 240, r: 24, sprite: 'geminibig', touch: 1 },
  famine:  { name: '饥荒', hp: 260, r: 28, sprite: 'famine', touch: 1 },
};

let bid = 1;

export class Boss {
  constructor(kind, x, y, level) {
    const def = BOSS_DEFS[kind] || BOSS_DEFS.monstro;
    this.id = bid++;
    this.isBoss = true;
    this.kind = kind;
    this.def = def;
    this.name = def.name;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = def.r;
    this.maxHp = Math.round(def.hp * (1 + (level - 1) * 0.22));
    this.hp = this.maxHp;
    this.touchDamage = level >= 7 ? 2 : 1;
    this.dead = false;
    this.hitFlash = 0;
    this.knockX = 0; this.knockY = 0;
    this.flying = kind === 'duke';
    this.level = level;

    this.t = 0;
    this.frame = 0;
    this.state = 'idle';
    this.stateTimer = 1.0;
    this.z = 0; this.vz = 0;
    this.spawnAnim = 0.9;
    this.segments = [];       // Larry Jr 的身体节
    this.twin = null;         // Gemini 的小个子
    this.facing = 1;
    this.scale = 1;
  }

  get enraged() { return this.hp < this.maxHp * 0.5; }
  get sprites() { return BOSS_SPRITES[this.def.sprite]; }

  hurt(amount, room, game, kb) {
    if (this.spawnAnim > 0) return;
    this.hp -= amount;
    this.hitFlash = 0.1;
    if (kb) { this.knockX += kb[0] * 0.25; this.knockY += kb[1] * 0.25; }
    room.spawnBloodSpray(this.x, this.y - 14, 4);
    if (this.hp <= 0) this.die(room, game);
  }

  die(room, game) {
    if (this.dead) return;
    this.dead = true;
    for (const s of this.segments) s.dead = true;
    if (this.twin) this.twin.dead = true;
    room.spawnBloodSpray(this.x, this.y - 14, 40);
    room.addDecal(this.x, this.y, 'blood', 22);
    room.shake(12);
    game.onBossKilled(this);
  }

  update(dt, room, game) {
    this.t += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.spawnAnim > 0) {
      this.spawnAnim -= dt;
      this.scale = 1 + Math.sin(this.spawnAnim * 12) * 0.06;
      return;
    }
    this.scale = 1;

    const p = game.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;

    switch (this.kind) {
      case 'monstro': this.monstro(dt, dx, dy, d, room, game); break;
      case 'duke': this.duke(dt, dx, dy, d, room, game); break;
      case 'larry': this.larry(dt, dx, dy, d, room, game); break;
      case 'gemini': this.gemini(dt, dx, dy, d, room, game); break;
      case 'famine': this.famine(dt, dx, dy, d, room, game); break;
    }

    this.x += this.knockX * dt; this.y += this.knockY * dt;
    this.knockX *= Math.pow(0.02, dt); this.knockY *= Math.pow(0.02, dt);
    this.x = clamp(this.x, this.r, ROOM_PLAY_W - this.r);
    this.y = clamp(this.y, this.r, ROOM_PLAY_H - this.r);
    this.facing = this.vx >= 0 ? 1 : -1;
    this.frame = Math.floor(this.t * 7) % this.sprites.length;
  }

  // --- MONSTRO：蹲下 → 起跳 → 砸地（震屏 + 溅血弹），偶尔原地喷散射 ---
  monstro(dt, dx, dy, d, room, game) {
    const fast = this.enraged ? 0.62 : 1;
    this.stateTimer -= dt;

    if (this.state === 'idle') {
      this.vx *= 0.85; this.vy *= 0.85;
      this.frameOverride = 0;
      if (this.stateTimer <= 0) {
        this.state = Math.random() < 0.45 ? 'spit' : 'jump';
        this.stateTimer = this.state === 'jump' ? 0.45 * fast : 0.5 * fast;
        this.targetX = clamp(game.player.x, 40, ROOM_PLAY_W - 40);
        this.targetY = clamp(game.player.y, 40, ROOM_PLAY_H - 40);
      }
    } else if (this.state === 'jump') {
      // 蓄力压扁 → 弹起
      this.frameOverride = 1;
      if (this.stateTimer <= 0) {
        this.state = 'air';
        this.stateTimer = 0.75 * fast;
        this.vz = 240;
        game.audio.play('jump');
      }
    } else if (this.state === 'air') {
      this.z += this.vz * dt;
      this.vz -= 340 * dt;
      // 空中平移到玩家所在位置
      const k = 3.2 * dt;
      this.x += (this.targetX - this.x) * k;
      this.y += (this.targetY - this.y) * k;
      if (this.z <= 0 && this.vz < 0) {
        this.z = 0; this.vz = 0;
        this.state = 'land'; this.stateTimer = 0.35;
        room.shake(10);
        game.audio.play('slam');
        // 落地溅出一圈血弹
        const n = this.enraged ? 12 : 8;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
          room.projectiles.push(new Projectile({
            x: this.x, y: this.y, vx: Math.cos(a) * 175, vy: Math.sin(a) * 175,
            damage: 1, friendly: false, size: 6, life: 1.5, hz: 12,
          }));
        }
        // 砸碎周围的石头
        room.breakObstaclesNear(this.x, this.y, 60, game);
      }
    } else if (this.state === 'land') {
      if (this.stateTimer <= 0) { this.state = 'idle'; this.stateTimer = 0.9 * fast; }
    } else if (this.state === 'spit') {
      this.frameOverride = 2;
      if (this.stateTimer <= 0) {
        // 朝玩家扇形吐一串血弹
        const base = Math.atan2(dy, dx);
        const n = this.enraged ? 7 : 5;
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.22;
          room.projectiles.push(new Projectile({
            x: this.x, y: this.y, vx: Math.cos(a) * 215, vy: Math.sin(a) * 215,
            damage: 1, friendly: false, size: 7, life: 1.7, hz: 14,
          }));
        }
        game.audio.play('shoot_enemy');
        this.state = 'idle'; this.stateTimer = 1.1 * fast;
      }
    }
  }

  // --- DUKE OF FLIES：慢慢飘向玩家，周期性吐出一批苍蝇 ---
  duke(dt, dx, dy, d, room, game) {
    const [nx, ny] = norm(dx, dy, 40);
    this.vx += (nx - this.vx) * 1.6 * dt;
    this.vy += (ny - this.vy) * 1.6 * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;

    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      this.stateTimer = this.enraged ? 2.0 : 3.2;
      const alive = room.enemies.filter((e) => !e.dead).length;
      const n = Math.min(this.enraged ? 5 : 3, Math.max(1, 8 - alive));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const e = new Enemy(this.enraged ? 'attackfly' : 'fly',
          this.x + Math.cos(a) * 26, this.y + Math.sin(a) * 22, this.level);
        e.spawnAnim = 0.25;
        room.enemies.push(e);
      }
      game.audio.play('buzz');
      // 狂暴后同时吐一圈弹幕
      if (this.enraged) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + this.t;
          room.projectiles.push(new Projectile({
            x: this.x, y: this.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
            damage: 1, friendly: false, size: 5, life: 1.6, hz: 12,
          }));
        }
      }
    }
  }

  // --- LARRY JR：一条会扭动的蠕虫，头部带着若干身体节 ---
  larry(dt, dx, dy, d, room, game) {
    if (!this.segments.length) {
      for (let i = 0; i < 5; i++) {
        this.segments.push({ x: this.x, y: this.y, r: 14, hist: [] });
      }
      this.history = [];
    }
    // 头部沿着正弦曲线朝玩家蜿蜒前进
    const speed = this.enraged ? 145 : 100;
    const [nx, ny] = norm(dx, dy, 1);
    const wob = Math.sin(this.t * 4.5) * 1.1;
    const ax = nx * Math.cos(wob) - ny * Math.sin(wob);
    const ay = nx * Math.sin(wob) + ny * Math.cos(wob);
    this.vx += (ax * speed - this.vx) * 3 * dt;
    this.vy += (ay * speed - this.vy) * 3 * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;

    // 撞墙就折返
    if (this.x < this.r || this.x > ROOM_PLAY_W - this.r) this.vx *= -1;
    if (this.y < this.r || this.y > ROOM_PLAY_H - this.r) this.vy *= -1;

    // 身体节跟随头部的运动轨迹
    this.history.unshift([this.x, this.y]);
    if (this.history.length > 200) this.history.length = 200;
    const gap = 11;
    this.segments.forEach((s, i) => {
      const h = this.history[Math.min(this.history.length - 1, (i + 1) * gap)];
      if (h) { s.x = h[0]; s.y = h[1]; }
    });

    this.stateTimer -= dt;
    if (this.enraged && this.stateTimer <= 0) {
      this.stateTimer = 2.2;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + this.t;
        room.projectiles.push(new Projectile({
          x: this.x, y: this.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160,
          damage: 1, friendly: false, size: 5, life: 1.5, hz: 12,
        }));
      }
    }
  }

  // --- GEMINI：大个子笨重地追，被脐带拴着的小个子高速冲刺 ---
  gemini(dt, dx, dy, d, room, game) {
    const [nx, ny] = norm(dx, dy, this.enraged ? 78 : 52);
    this.vx += (nx - this.vx) * 2 * dt;
    this.vy += (ny - this.vy) * 2 * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;

    if (!this.twin) {
      this.twin = {
        x: this.x + 40, y: this.y, vx: 0, vy: 0, r: 13,
        state: 'idle', timer: 1.2, t: 0, frame: 0, hitFlash: 0,
      };
    }
    const tw = this.twin;
    tw.t += dt;
    tw.frame = Math.floor(tw.t * 6) % BOSS_SPRITES.geminismall.length;
    tw.timer -= dt;
    const tdx = game.player.x - tw.x, tdy = game.player.y - tw.y;

    if (tw.state === 'idle') {
      // 绕着大个子转
      const a = this.t * 2.2;
      const ox = this.x + Math.cos(a) * 42, oy = this.y + Math.sin(a) * 34;
      tw.vx += ((ox - tw.x) * 4 - tw.vx) * 4 * dt;
      tw.vy += ((oy - tw.y) * 4 - tw.vy) * 4 * dt;
      if (tw.timer <= 0) { tw.state = 'lunge'; tw.timer = 0.9; game.audio.play('growl'); }
    } else {
      const [lx, ly] = norm(tdx, tdy, 300);
      tw.vx += (lx - tw.vx) * 5 * dt;
      tw.vy += (ly - tw.vy) * 5 * dt;
      if (tw.timer <= 0) { tw.state = 'idle'; tw.timer = this.enraged ? 1.0 : 1.8; }
    }
    tw.x += tw.vx * dt; tw.y += tw.vy * dt;
    // 脐带把小个子限制在一定范围内
    const cordX = tw.x - this.x, cordY = tw.y - this.y;
    const cordLen = Math.hypot(cordX, cordY);
    const maxCord = 130;
    if (cordLen > maxCord) {
      const [cx, cy] = norm(cordX, cordY, maxCord);
      tw.x = this.x + cx; tw.y = this.y + cy;
      tw.vx *= 0.4; tw.vy *= 0.4;
    }
    tw.x = clamp(tw.x, tw.r, ROOM_PLAY_W - tw.r);
    tw.y = clamp(tw.y, tw.r, ROOM_PLAY_H - tw.r);
    if (tw.hitFlash > 0) tw.hitFlash -= dt;
  }

  // --- FAMINE：横冲直撞 + 停下来射一排血弹 ---
  famine(dt, dx, dy, d, room, game) {
    this.stateTimer -= dt;
    if (this.state === 'idle') {
      this.vx *= 0.9; this.vy *= 0.9;
      if (this.stateTimer <= 0) {
        this.state = Math.random() < 0.5 ? 'dash' : 'volley';
        this.stateTimer = this.state === 'dash' ? 1.1 : 0.7;
        if (this.state === 'dash') {
          const [nx, ny] = norm(dx, dy, this.enraged ? 330 : 250);
          this.vx = nx; this.vy = ny;
          game.audio.play('growl');
        }
      }
    } else if (this.state === 'dash') {
      if (this.x <= this.r + 1 || this.x >= ROOM_PLAY_W - this.r - 1) { this.vx *= -1; room.shake(5); }
      if (this.y <= this.r + 1 || this.y >= ROOM_PLAY_H - this.r - 1) { this.vy *= -1; room.shake(5); }
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.stateTimer <= 0) { this.state = 'idle'; this.stateTimer = 0.6; }
    } else {
      this.vx *= 0.85; this.vy *= 0.85;
      if (this.stateTimer <= 0) {
        const base = Math.atan2(dy, dx);
        const n = this.enraged ? 9 : 6;
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.26;
          room.projectiles.push(new Projectile({
            x: this.x, y: this.y, vx: Math.cos(a) * 205, vy: Math.sin(a) * 205,
            damage: 1, friendly: false, size: 6, life: 1.8, hz: 14,
          }));
        }
        game.audio.play('shoot_enemy');
        this.state = 'idle'; this.stateTimer = this.enraged ? 0.5 : 1.0;
      }
    }
  }

  /** Boss 的全部可受击部位（Larry 的身体节、Gemini 的小个子也能打） */
  hitParts() {
    const parts = [{ x: this.x, y: this.y, r: this.r, main: true }];
    for (const s of this.segments) parts.push({ x: s.x, y: s.y, r: s.r, main: false });
    if (this.twin) parts.push({ x: this.twin.x, y: this.twin.y, r: this.twin.r, main: false, twin: true });
    return parts;
  }
}
