/**
 * projectile.js — lightweight bullets for the player's burst and turret fire.
 *
 * A projectile carries an `owner` ("player" | "enemy") that decides whose side
 * it can hit. It despawns on impact, on hitting terrain, or when its lifetime
 * expires. Player projectiles use the same `hurt()` contract as melee so all
 * damage flows through one path.
 *
 * @module entities/projectile
 */

import { aabb } from "../engine/mathx.js";

export class Projectile {
  constructor(opts) {
    this.x = opts.x;
    this.y = opts.y;
    this.vx = opts.vx;
    this.vy = opts.vy ?? 0;
    this.damage = opts.damage;
    this.owner = opts.owner;        // "player" | "enemy"
    this.color = opts.color ?? "#fff";
    this.r = opts.radius ?? 6;
    this.life = opts.life ?? 2.2;
    this.pierce = opts.pierce ?? false;
    this.alive = true;
  }

  get aabb() {
    return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 };
  }

  update(dt, world) {
    this.life -= dt;
    if (this.life <= 0) { this.alive = false; return; }
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Terrain blocks projectiles (ignores one-way platforms).
    for (const s of world.solids) {
      if (s.oneWay) continue;
      if (aabb(this.aabb, s)) { this._impact(world); return; }
    }

    if (this.owner === "player") {
      for (const e of world.enemies) {
        if (!e.alive) continue;
        if (aabb(this.aabb, e.aabb)) {
          const dmg = e.hurt(this.damage, Math.sign(this.vx) * 120, 0, "light");
          if (dmg !== false) {
            world.particles.hitSpark(this.x, this.y, this.color, 8);
            world.player.addStyle(4);
            if (!this.pierce) { this._impact(world); return; }
          }
        }
      }
    } else {
      if (aabb(this.aabb, world.player.aabb)) {
        if (world.player.takeDamage(this.damage, Math.sign(this.vx) * 240)) {
          this._impact(world);
          return;
        }
      }
    }
  }

  _impact(world) {
    this.alive = false;
    world.particles.hitSpark(this.x, this.y, this.color, 6);
  }

  render(ctx, cam) {
    if (!this.alive) return;
    const x = this.x - cam.x;
    const y = this.y - cam.y;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(x, y, this.r, 0, Math.PI * 2);
    ctx.fill();
    // Glow trail.
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(x - Math.sign(this.vx) * 6, y, this.r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
