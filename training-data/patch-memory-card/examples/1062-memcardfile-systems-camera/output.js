/**
 * camera.js — smooth follow camera with look-ahead and screen shake.
 *
 * Implements the GDD's camera philosophy: dramatic but readable. The camera
 * eases toward the target (critically-damped feel via `approach`-style lerp),
 * leads slightly in the direction of travel so the player can see where they
 * are going, and clamps to the level bounds so we never show the void. Shake is
 * additive and decays on its own, layered on top of the resolved position.
 *
 * @module systems/camera
 */

import { clamp, lerp } from "../engine/mathx.js";
import { CONFIG } from "../config.js";

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.w = CONFIG.view.width;
    this.h = CONFIG.view.height;
    this.lookAhead = 90;     // px ahead in the direction of motion
    this.stiffness = 7;      // higher = snappier follow
    this.bounds = { x: 0, y: 0, w: Infinity, h: Infinity };
    this._shake = 0;
    this._shakeX = 0;
    this._shakeY = 0;
  }

  setBounds(x, y, w, h) {
    this.bounds = { x, y, w, h };
  }

  /** Snap instantly to a target (used on scene/room entry). */
  snapTo(target) {
    this.x = this._clampX(target.x + target.w / 2 - this.w / 2);
    this.y = this._clampY(target.y + target.h / 2 - this.h / 2);
  }

  /** Add a shake impulse (e.g. on heavy hits / landings). */
  shake(amount) {
    this._shake = Math.max(this._shake, amount);
  }

  /**
   * @param {{x,y,w,h,vx,facing}} target the player
   * @param {number} dt
   */
  follow(target, dt) {
    const aheadX = (target.facing ?? 1) * this.lookAhead;
    const desiredX = target.x + target.w / 2 - this.w / 2 + aheadX;
    const desiredY = target.y + target.h / 2 - this.h / 2 - 40; // bias upward

    const t = 1 - Math.exp(-this.stiffness * dt); // framerate-independent lerp
    this.x = this._clampX(lerp(this.x, desiredX, t));
    this.y = this._clampY(lerp(this.y, desiredY, t));

    // Decay shake and resolve an offset applied at render time.
    if (this._shake > 0.01) {
      this._shake *= Math.exp(-9 * dt);
      this._shakeX = (Math.random() * 2 - 1) * this._shake;
      this._shakeY = (Math.random() * 2 - 1) * this._shake;
    } else {
      this._shake = this._shakeX = this._shakeY = 0;
    }
  }

  _clampX(x) {
    const max = Math.max(this.bounds.x, this.bounds.x + this.bounds.w - this.w);
    return clamp(x, this.bounds.x, max);
  }

  _clampY(y) {
    const max = Math.max(this.bounds.y, this.bounds.y + this.bounds.h - this.h);
    return clamp(y, this.bounds.y, max);
  }

  /** The position renderers should subtract, including shake. */
  get renderX() {
    return Math.round(this.x + this._shakeX);
  }

  get renderY() {
    return Math.round(this.y + this._shakeY);
  }
}
