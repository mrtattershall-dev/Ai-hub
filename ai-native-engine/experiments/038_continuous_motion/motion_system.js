'use strict';
// =============================================================================
// RD-023 apparatus — the UNGATED continuous-motion layer.
// N entities with x,y,vx,vy in plain Float64Arrays OUTSIDE the engine's gated
// pools (that is the point: these writes never touch submit()). Index-aligned
// 1:1 with engine entity indices (uuid[i] <-> motion slot i) — chosen over a
// uuid map because the bench spawns once and never deletes, and index math is
// the cheapest honest representation of "a fast layer beside the engine".
// Deterministic init (no Math.random — project rule: reproducible runs).
// =============================================================================

const WORLD = 1000; // world is a WORLD x WORLD box; entities bounce off walls

function createMotion(n) {
  const x = new Float64Array(n), y = new Float64Array(n);
  const vx = new Float64Array(n), vy = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = (i * 37) % WORLD; y[i] = (i * 61) % WORLD;
    vx[i] = 20 + (i % 7) * 15;              // all move right at varied speeds
    vy[i] = ((i % 5) - 2) * 10;
  }
  return {
    n, x, y, vx, vy, WORLD,
    integrate(dt) {                          // Euler + wall bounce — arm A
      for (let i = 0; i < n; i++) {
        x[i] += vx[i] * dt; y[i] += vy[i] * dt;
        if (x[i] < 0) { x[i] = 0; vx[i] = -vx[i]; } else if (x[i] > WORLD) { x[i] = WORLD; vx[i] = -vx[i]; }
        if (y[i] < 0) { y[i] = 0; vy[i] = -vy[i]; } else if (y[i] > WORLD) { y[i] = WORLD; vy[i] = -vy[i]; }
      }
    },
    // arm B: AABB pair detection via sort-and-sweep on x (naive n^2 would make
    // the bench measure a physics-implementation question, not the architecture).
    collisions(half = 2) {
      const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => x[a] - x[b]);
      const pairs = [];
      for (let a = 0; a < n; a++) {
        const i = order[a];
        for (let b = a + 1; b < n; b++) {
          const j = order[b];
          if (x[j] - x[i] > 2 * half) break;
          if (Math.abs(y[i] - y[j]) <= 2 * half) pairs.push([i, j]);
        }
      }
      return pairs;
    },
    // checkpoint line: indices that crossed x=line this frame (moving right)
    crossings(line, prevX) {
      const hit = [];
      for (let i = 0; i < n; i++) if (prevX[i] < line && x[i] >= line) hit.push(i);
      return hit;
    },
  };
}

module.exports = { createMotion, WORLD };

if (require.main === module) { // smoke: deterministic, moves, bounces, detects
  const m = createMotion(100);
  const x0 = m.x.slice();
  for (let f = 0; f < 600; f++) m.integrate(1 / 60);
  let moved = 0; for (let i = 0; i < m.n; i++) if (m.x[i] !== x0[i]) moved++;
  const inBounds = [...m.x, ...m.y].every((v) => v >= 0 && v <= WORLD);
  console.log(`moved ${moved}/100, inBounds ${inBounds}, collisions@r2 ${m.collisions(2).length}`);
  if (moved !== 100 || !inBounds) { console.error('FAIL'); process.exit(1); }
  console.log('ALL PASS — motion_system smoke');
}
