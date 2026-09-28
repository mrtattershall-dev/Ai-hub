// CANONICAL REFERENCE - cumulative correct state after setH goals 1-60 for this file.
// Goals 61+ are HELD OUT and deliberately not implemented.
//
//   goal  7  new Cache(capacity), set/get/has/size, LRU where get AND set count as uses
//   goal 17  delete(key) -> boolean, clear()
//   goal 27  keys() most-recently-used first
//   goal 37  peek(key) - like get but not a use
//   goal 47  new Cache(capacity, { ttl, now }) expiry; set(key, value, { ttl }) per-entry override;
//            an expired entry counts as missing EVERYWHERE; new Cache(capacity) never expires
//   goal 57  stats() -> { hits, misses, evictions, expirations }, each expiry counted once
class Cache {
  constructor(capacity, options = {}) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new Error('capacity must be a positive integer');
    this.capacity = capacity;
    this.defaultTtl = options && options.ttl !== undefined ? options.ttl : null;
    this.now = (options && typeof options.now === 'function') ? options.now : Date.now;
    this.m = new Map();   // key -> { value, expiresAt|null }
    this._stats = { hits: 0, misses: 0, evictions: 0, expirations: 0 };
  }

  // goal 47 + 57: an expired entry is dropped on sight and counted exactly once.
  _live(key) {
    if (!this.m.has(key)) return false;
    const e = this.m.get(key);
    if (e.expiresAt !== null && this.now() >= e.expiresAt) {
      this.m.delete(key);
      this._stats.expirations++;
      return false;
    }
    return true;
  }

  _sweep() {
    for (const key of [...this.m.keys()]) this._live(key);
  }

  _touch(key) {
    const e = this.m.get(key);
    this.m.delete(key);
    this.m.set(key, e);
  }

  set(key, value, options = {}) {
    const ttl = options && options.ttl !== undefined ? options.ttl : this.defaultTtl;
    const expiresAt = (ttl === null || ttl === undefined) ? null : this.now() + ttl;
    if (this.m.has(key)) {
      this.m.delete(key);
    } else {
      this._sweep();                       // expired entries free room before anything is evicted
      if (this.m.size >= this.capacity) {
        const lru = this.m.keys().next().value;
        this.m.delete(lru);
        this._stats.evictions++;
      }
    }
    this.m.set(key, { value, expiresAt });
  }

  get(key) {
    if (!this._live(key)) { this._stats.misses++; return undefined; }
    this._stats.hits++;
    const v = this.m.get(key).value;
    this._touch(key);
    return v;
  }

  has(key) { return this._live(key); }

  size() { this._sweep(); return this.m.size; }

  delete(key) {
    if (!this._live(key)) return false;
    return this.m.delete(key);
  }

  clear() { this.m.clear(); }

  keys() { this._sweep(); return [...this.m.keys()].reverse(); }

  peek(key) {
    if (!this._live(key)) return undefined;
    return this.m.get(key).value;
  }

  stats() { return { ...this._stats }; }
}

module.exports = { Cache };
