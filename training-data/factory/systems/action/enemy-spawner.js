/**
 * Action spawning: an EnemyPool that recycles enemy objects instead of allocating, a
 * Spawner that releases enemies on a ramping interval, and a Wave value that shortens the
 * interval over time. The spawner asks the pool for instances; the pool owns reuse and
 * nothing is shared through globals.
 */
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

class EnemyPool {
  constructor() { this.free = []; this.live = []; this.created = 0; }
  acquire(kind) {
    let e = this.free.pop();
    if (!e) { e = { kind: null, hp: 0, alive: false }; this.created += 1; }
    e.kind = kind; e.hp = 10; e.alive = true;
    this.live.push(e);
    return e;
  }
  release(e) {
    e.alive = false;
    const i = this.live.indexOf(e);
    if (i >= 0) this.live.splice(i, 1);
    this.free.push(e);
  }
}

class Spawner {
  constructor(pool, baseInterval) { this.pool = pool; this.base = baseInterval; this.t = 0; this.spawned = 0; }
  interval(wave) { return Math.max(1, this.base - wave); }   // each wave spawns faster
  tick(wave) {
    this.t += 1;
    if (this.t >= this.interval(wave)) {
      this.t = 0;
      this.spawned += 1;
      return this.pool.acquire('grunt');
    }
    return null;
  }
}

// --- self-checking demo ---
const pool = new EnemyPool();
const spawner = new Spawner(pool, 5);

let spawns = 0;
for (let i = 0; i < 5; i++) if (spawner.tick(0)) spawns += 1;     // interval 5 -> one spawn
assert(spawns === 1, 'one enemy spawned in five ticks at wave 0');
assert(pool.live.length === 1 && pool.created === 1, 'pool allocated exactly one enemy');

pool.release(pool.live[0]);                                       // enemy dies, returns to pool
for (let i = 0; i < 4; i++) spawner.tick(1);                      // wave 1 interval 4 -> one spawn
assert(pool.created === 1, 'next spawn reuses the pooled enemy, no new allocation');
assert(spawner.interval(3) < spawner.interval(0), 'higher waves spawn faster');
console.log('action/enemy-spawner OK');
