/**
 * loop.js — fixed-timestep game loop with render interpolation.
 *
 * Simulation runs at a constant rate (CONFIG.sim.hz) regardless of display
 * refresh. We accumulate real elapsed time and consume it in fixed slices, so
 * physics is deterministic and frame-rate independent. Rendering happens once
 * per animation frame with an `alpha` factor describing how far we are between
 * the last two simulation steps, which callers can use to interpolate visuals
 * and avoid jitter on high-refresh displays.
 *
 * @module engine/loop
 */

import { CONFIG } from "../config.js";

export class GameLoop {
  /**
   * @param {(dt:number)=>void} update  fixed-step simulation
   * @param {(alpha:number)=>void} render  per-frame draw
   */
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.running = false;
    this._accumulator = 0;
    this._last = 0;
    this._raf = 0;
    this.fps = 0;
    this._fpsSamples = [];
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  _tick(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._tick);

    let frameTime = (now - this._last) / 1000;
    this._last = now;
    // Clamp huge gaps (alt-tab) so we never run hundreds of catch-up steps.
    if (frameTime > CONFIG.sim.maxFrameTime) frameTime = CONFIG.sim.maxFrameTime;

    this._accumulator += frameTime;
    const dt = CONFIG.sim.dt;
    let steps = 0;
    while (this._accumulator >= dt && steps < 8) {
      this.update(dt);
      this._accumulator -= dt;
      steps++;
    }

    const alpha = this._accumulator / dt;
    this.render(alpha);

    this._trackFps(frameTime);
  }

  _trackFps(frameTime) {
    this._fpsSamples.push(frameTime);
    if (this._fpsSamples.length > 30) this._fpsSamples.shift();
    const avg = this._fpsSamples.reduce((a, b) => a + b, 0) / this._fpsSamples.length;
    this.fps = avg > 0 ? Math.round(1 / avg) : 0;
  }
}
