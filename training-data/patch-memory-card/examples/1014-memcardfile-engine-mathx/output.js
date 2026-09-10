/**
 * mathx.js — small, dependency-free math helpers used across the engine.
 *
 * Kept as pure functions (no hidden state) so they are trivial to reason about
 * and reuse. Geometry helpers assume axis-aligned bounding boxes (AABBs)
 * described as `{ x, y, w, h }` with the origin at the top-left.
 *
 * @module engine/mathx
 */

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Linear interpolation. t is expected in [0,1] but is not clamped. */
export const lerp = (a, b, t) => a + (b - a) * t;

/** Inverse lerp: where does v sit between a and b? Returns [0,1] (unclamped). */
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));

/** Remap v from one range to another. */
export const remap = (v, inMin, inMax, outMin, outMax) =>
  lerp(outMin, outMax, invLerp(inMin, inMax, v));

/**
 * Move `current` toward `target` by at most `maxDelta`. Unlike lerp this is
 * frame-rate independent and never overshoots — ideal for friction/easing.
 */
export function approach(current, target, maxDelta) {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return target;
}

export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

/** Random float in [min, max). */
export const rand = (min, max) => min + Math.random() * (max - min);

/** Random integer in [min, max] inclusive. */
export const randInt = (min, max) => Math.floor(rand(min, max + 1));

/** Pick a random element from a non-empty array. */
export const choice = (arr) => arr[(Math.random() * arr.length) | 0];

export const distance = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

/** True when two AABBs overlap (touching edges do not count). */
export function aabb(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/** True when point (px,py) is inside AABB r. */
export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

/** Center point of an AABB. */
export const rectCenter = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/**
 * Smoothstep easing (3t^2 - 2t^3). Useful for camera and UI transitions where
 * linear motion looks robotic.
 */
export const smoothstep = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
