// Reference solution (final state of chain 5) - used only to prove checks-C.mjs can pass.
class LRUCache {
  constructor(capacity, now = Date.now) {
    if (!(Number.isInteger(capacity) && capacity > 0)) throw new Error('capacity must be a positive integer');
    this.capacity = capacity; this.now = now; this.map = new Map(); this.s = { hits: 0, misses: 0, evictions: 0 };
  }
  get(key) {
    const e = this.map.get(key);
    if (!e) { this.s.misses++; return undefined; }
    if (e.exp !== null && this.now() >= e.exp) { this.map.delete(key); this.s.misses++; return undefined; }
    this.map.delete(key); this.map.set(key, e); this.s.hits++; return e.value;
  }
  set(key, value, ttlMs) {
    if (ttlMs !== undefined && !(typeof ttlMs === 'number' && ttlMs > 0)) throw new Error('ttlMs must be a positive number');
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, exp: ttlMs === undefined ? null : this.now() + ttlMs });
    while (this.map.size > this.capacity) { this.map.delete(this.map.keys().next().value); this.s.evictions++; }
    return this;
  }
  stats() { return { ...this.s }; }
  delete(key) { return this.map.delete(key); }
  clear() { this.map.clear(); }
}
module.exports = { LRUCache };
