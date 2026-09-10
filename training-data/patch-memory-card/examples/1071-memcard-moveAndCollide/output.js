export function moveAndCollide(body, solids, dt) {
  body.grounded = false;
  body.hitCeiling = false;
  body.touchingWall = false;
  body.wallDir = 0;

  // --- X axis ---
  body.x += body.vx * dt;
  for (const s of solids) {
    if (s.oneWay) continue; // one-way platforms never block horizontal motion
    if (!overlap(body, s)) continue;
    if (body.vx > 0) {
      body.x = s.x - body.w;
      body.touchingWall = true;
      body.wallDir = 1;
    } else if (body.vx < 0) {
      body.x = s.x + s.w;
      body.touchingWall = true;
      body.wallDir = -1;
    }
    body.vx = 0;
  }

  // --- Y axis ---
  const prevBottom = body.y + body.h; // before vertical move (for one-way test)
  body.y += body.vy * dt;
  for (const s of solids) {
    if (!overlap(body, s)) continue;
    if (s.oneWay) {
      // Only land on top, only when descending and previously above the lip.
      if (body.vy <= 0) continue;
      if (prevBottom > s.y + 6) continue;
    }
    if (body.vy > 0) {
      body.y = s.y - body.h;
      body.grounded = true;
    } else if (body.vy < 0) {
      body.y = s.y + s.h;
      body.hitCeiling = true;
    }
    body.vy = 0;
  }
}