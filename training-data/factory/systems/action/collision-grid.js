/**
 * Action collision: a SpatialHash that buckets entities into grid cells so only nearby
 * pairs are tested (broad phase), plus an axis-aligned bounding-box overlap test (narrow
 * phase). A CollisionSystem queries the hash and returns colliding pairs. The two phases
 * are separate so either can change without the other.
 */
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

class SpatialHash {
  constructor(cell) { this.cell = cell; this.buckets = new Map(); }
  key(cx, cy) { return cx + ',' + cy; }
  insert(e) {
    const k = this.key(Math.floor(e.x / this.cell), Math.floor(e.y / this.cell));
    if (!this.buckets.has(k)) this.buckets.set(k, []);
    this.buckets.get(k).push(e);
  }
  near(e) {
    const out = [];
    const cx = Math.floor(e.x / this.cell), cy = Math.floor(e.y / this.cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const b = this.buckets.get(this.key(cx + dx, cy + dy));
        if (b) for (const o of b) if (o !== e) out.push(o);
      }
    return out;
  }
}

class CollisionSystem {
  constructor(hash) { this.hash = hash; }
  pairs() {
    const seen = new Set(), result = [];
    for (const bucket of this.hash.buckets.values())
      for (const e of bucket)
        for (const o of this.hash.near(e)) {
          const id = e.id < o.id ? e.id + '|' + o.id : o.id + '|' + e.id;
          if (seen.has(id)) continue;
          seen.add(id);
          if (overlaps(e, o)) result.push([e.id, o.id]);
        }
    return result;
  }
}

// --- self-checking demo ---
const hash = new SpatialHash(32);
const a = { id: 'a', x: 10, y: 10, w: 10, h: 10 };
const b = { id: 'b', x: 15, y: 12, w: 10, h: 10 };               // overlaps a
const c = { id: 'c', x: 200, y: 200, w: 10, h: 10 };            // far away
[a, b, c].forEach(e => hash.insert(e));

assert(overlaps(a, b) && !overlaps(a, c), 'aabb test: a overlaps b but not c');
const sys = new CollisionSystem(hash);
const found = sys.pairs();
assert(found.length === 1, 'broad+narrow phase find exactly one pair');
assert(found[0].includes('a') && found[0].includes('b'), 'the colliding pair is a and b');
assert(hash.near(c).length === 0, 'the distant entity has no neighbours to test');
console.log('action/collision-grid OK');
