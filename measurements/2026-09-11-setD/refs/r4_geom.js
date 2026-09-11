// Reference solution (final state of chain r4) - used only to prove checks-D.mjs can pass.
function chkPt(p) { if (!p || typeof p !== 'object' || !Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error('each point must be an object with finite numeric x and y'); }
function chkPts(points, min = 0) { if (!Array.isArray(points)) throw new Error('points must be an array'); points.forEach(chkPt); if (points.length < min) throw new Error('need at least ' + min + ' points'); }
function distance(a, b) { chkPt(a); chkPt(b); return Math.hypot(a.x - b.x, a.y - b.y); }
function signedArea(points) { let s = 0; for (let i = 0; i < points.length; i++) { const p = points[i], q = points[(i + 1) % points.length]; s += p.x * q.y - q.x * p.y; } return s / 2; }
function polygonArea(points) { chkPts(points, 3); return Math.abs(signedArea(points)); }
function perimeter(points) { chkPts(points, 3); let s = 0; for (let i = 0; i < points.length; i++) s += distance(points[i], points[(i + 1) % points.length]); return s; }
function centroid(points) {
  chkPts(points, 3); const A = signedArea(points); if (Math.abs(A) < 1e-12) throw new Error('polygon has zero area');
  let cx = 0, cy = 0;
  for (let i = 0; i < points.length; i++) { const p = points[i], q = points[(i + 1) % points.length]; const f = p.x * q.y - q.x * p.y; cx += (p.x + q.x) * f; cy += (p.y + q.y) * f; }
  return { x: cx / (6 * A), y: cy / (6 * A) };
}
function boundingBox(points) { chkPts(points, 1); const xs = points.map((p) => p.x), ys = points.map((p) => p.y); return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }; }
function onSegment(p, a, b) {
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x); if (Math.abs(cross) > 1e-9) return false;
  return p.x >= Math.min(a.x, b.x) - 1e-9 && p.x <= Math.max(a.x, b.x) + 1e-9 && p.y >= Math.min(a.y, b.y) - 1e-9 && p.y <= Math.max(a.y, b.y) + 1e-9;
}
function pointInPolygon(p, points) {
  chkPt(p); chkPts(points, 3); let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if (onSegment(p, a, b)) return true;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function convexHull(points) {
  chkPts(points);
  const pts = [...new Map(points.map((p) => [p.x + ',' + p.y, { x: p.x, y: p.y }])).values()].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = []; for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  const upper = []; for (const p of [...pts].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  let s = 0; for (let i = 1; i < hull.length; i++) if (hull[i].y < hull[s].y || (hull[i].y === hull[s].y && hull[i].x < hull[s].x)) s = i;
  return hull.slice(s).concat(hull.slice(0, s));
}
function translate(points, dx, dy) { chkPts(points); return points.map((p) => ({ x: p.x + dx, y: p.y + dy })); }
function scale(points, factor, origin = { x: 0, y: 0 }) { chkPts(points); chkPt(origin); return points.map((p) => ({ x: origin.x + (p.x - origin.x) * factor, y: origin.y + (p.y - origin.y) * factor })); }
function isConvex(points) {
  chkPts(points, 3); let sign = 0; const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n], c = points[(i + 2) % n];
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(z) < 1e-12) continue; const s = Math.sign(z);
    if (sign === 0) sign = s; else if (s !== sign) return false;
  }
  return true;
}
function rotate(points, degrees, origin = { x: 0, y: 0 }) {
  chkPts(points); chkPt(origin); const r = degrees * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return points.map((p) => { const x = p.x - origin.x, y = p.y - origin.y; return { x: origin.x + x * c - y * s, y: origin.y + x * s + y * c }; });
}
module.exports = { distance, polygonArea, perimeter, centroid, boundingBox, pointInPolygon, convexHull, translate, scale, isConvex, rotate };
