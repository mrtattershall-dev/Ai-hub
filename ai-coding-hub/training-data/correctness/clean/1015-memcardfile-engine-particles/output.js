/**
 * particles.js — a pooled 2D particle system for combat/pickup "juice".
 *
 * Particles are cheap, short-lived sprites with velocity, gravity, drag, and a
 * fade-out. We recycle a fixed-size pool to avoid garbage-collection hitches
 * during heavy combat — a common source of stutter in browser games.
 *
 * @module engine/particles
 */

import { rand } from "./mathx.js";

const MAX_PARTICLES = 600;

/** @typedef {{ x:number,y:number,vx:number,vy:number,life:number,maxLife:number,
 *   size:number,color:string,gravity:number,drag:number,shape:string,active:boolean }} Particle */

export class ParticleSystem {
  constructor() {
    /** @type {Particle[]} */
    this.pool = Array.from({ length: MAX_PARTICLES }, () => ({
      x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
      size: 2, color: "#fff", gravity: 0, drag: 0, shape: "square", active: false,
    }));
    this.cursor = 0;
  }

  /** Grab the next free particle slot (overwrites the oldest if saturated). */
  _next() {
    // Linear probe a few slots for a free one, else reuse round-robin.
    for (let i = 0; i < 8; i++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.pool.length;
      if (!p.active) return p;
    }
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    return p;
  }

  spawn(opts) {
    const p = this._next();
    p.x = opts.x; p.y = opts.y;
    p.vx = opts.vx ?? 0; p.vy = opts.vy ?? 0;
    p.maxLife = p.life = opts.life ?? 0.5;
    p.size = opts.size ?? 3;
    p.color = opts.color ?? "#fff";
    p.gravity = opts.gravity ?? 0;
    p.drag = opts.drag ?? 0;
    p.shape = opts.shape ?? "square";
    p.active = true;
    return p;
  }

  /** A burst of sparks at an impact point. */
  hitSpark(x, y, color = "#fff", count = 10) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(120, 420);
      this.spawn({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.18, 0.4), size: rand(2, 5),
        color, gravity: 900, drag: 4, shape: "square",
      });
    }
  }

  /** Gentle rising sparkles for collectible pickups. */
  sparkle(x, y, color = "#ffd86b", count = 12) {
    for (let i = 0; i < count; i++) {
      this.spawn({
        x: x + rand(-10, 10), y: y + rand(-10, 10),
        vx: rand(-40, 40), vy: rand(-160, -60),
        life: rand(0.4, 0.8), size: rand(2, 4),
        color, gravity: -120, drag: 1.5, shape: "diamond",
      });
    }
  }

  /** Landing/footstep dust kicked sideways. */
  dust(x, y, dir = 0, count = 6) {
    for (let i = 0; i < count; i++) {
      this.spawn({
        x, y,
        vx: rand(-60, 60) + dir * 80, vy: rand(-120, -20),
        life: rand(0.25, 0.5), size: rand(3, 6),
        color: "rgba(160,170,200,0.7)", gravity: 500, drag: 5, shape: "circle",
      });
    }
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      // Exponential drag toward zero velocity.
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  /** @param {CanvasRenderingContext2D} ctx @param {{x:number,y:number}} cam */
  render(ctx, cam) {
    for (const p of this.pool) {
      if (!p.active) continue;
      const t = p.life / p.maxLife; // 1 -> 0
      ctx.globalAlpha = Math.min(1, t * 1.4);
      ctx.fillStyle = p.color;
      const sx = p.x - cam.x;
      const sy = p.y - cam.y;
      const s = p.size * (0.4 + 0.6 * t);
      if (p.shape === "circle") {
        ctx.beginPath();
        ctx.arc(sx, sy, s, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === "diamond") {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      } else {
        ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    for (const p of this.pool) p.active = false;
  }
}
