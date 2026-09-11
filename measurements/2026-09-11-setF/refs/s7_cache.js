// Reference solution (final state of chain s7) - used only to prove checks-F.mjs can pass.
class Cache {
  constructor(capacity, opts = {}) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new Error('capacity must be a positive integer');
    this.cap = capacity;
    this.ttl = opts.ttl;
    this.now = opts.now || Date.now;
    this.onEvict = opts.onEvict;
    this.map = new Map();   // key -> { value, exp }; Map order runs least -> most recently used
    this.st = { hits: 0, misses: 0, evictions: 0, expirations: 0 };
  }

  _ev(key, value, reason) { if (this.onEvict) this.onEvict(key, value, reason); }

  _live(key) {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.exp !== undefined && this.now() >= e.exp) {
      this.map.delete(key);
      this.st.expirations++;
      this._ev(key, e.value, 'expired');
      return undefined;
    }
    return e;
  }

  _purge() { for (const k of [...this.map.keys()]) this._live(k); }

  _touch(key, e) { this.map.delete(key); this.map.set(key, e); }

  _evictDownTo(n) {
    while (this.map.size > n) {
      const [k, e] = this.map.entries().next().value;
      this.map.delete(k);
      this.st.evictions++;
      this._ev(k, e.value, 'lru');
    }
  }

  set(key, value, opts = {}) {
    const ttl = opts.ttl !== undefined ? opts.ttl : this.ttl;
    const exp = ttl !== undefined ? this.now() + ttl : undefined;
    if (this.map.has(key)) this.map.delete(key);
    else { this._purge(); this._evictDownTo(this.cap - 1); }
    this.map.set(key, { value, exp });
    return this;
  }

  get(key) {
    const e = this._live(key);
    if (!e) { this.st.misses++; return undefined; }
    this.st.hits++;
    this._touch(key, e);
    return e.value;
  }

  has(key) { return !!this._live(key); }

  size() { this._purge(); return this.map.size; }

  delete(key) {
    const e = this._live(key);
    if (!e) return false;
    this.map.delete(key);
    this._ev(key, e.value, 'deleted');
    return true;
  }

  clear() { for (const [k, e] of [...this.map]) { this.map.delete(k); this._ev(k, e.value, 'deleted'); } }

  keys() { this._purge(); return [...this.map.keys()].reverse(); }

  peek(key) { const e = this._live(key); return e ? e.value : undefined; }

  stats() { return { ...this.st }; }

  resize(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new Error('capacity must be a positive integer');
    this.cap = capacity;
    this._purge();
    this._evictDownTo(this.cap);
  }

  toJSON() { this._purge(); return { capacity: this.cap, entries: [...this.map].map(([k, e]) => [k, e.value]) }; }

  static fromJSON(data, options = {}) {
    const c = new Cache(data.capacity, options);
    for (const [k, v] of data.entries || []) c.set(k, v);
    return c;
  }

  getOrSet(key, factory) {
    const e = this._live(key);
    if (e) { this.st.hits++; this._touch(key, e); return e.value; }
    this.st.misses++;
    const v = factory(key);
    this.set(key, v);
    return v;
  }
}

module.exports = { Cache };
