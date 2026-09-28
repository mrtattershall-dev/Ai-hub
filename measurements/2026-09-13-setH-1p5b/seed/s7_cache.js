// CANONICAL REFERENCE - cumulative correct state after setH goals 7, 17, 27, 37.
// Goal 47 onward (ttl expiry, stats) is HELD OUT and deliberately not implemented.
//
//   goal  7  new Cache(capacity), set, get, has, size; LRU eviction where get AND set count as uses
//   goal 17  delete(key) returning true/false, clear()
//   goal 27  keys() most-recently-used first
//   goal 37  peek(key) - like get but does NOT count as a use
//
// A Map preserves insertion order, so "least recently used" is the first key and a use is modelled
// by deleting and re-inserting.
class Cache {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('capacity must be a positive integer');
    }
    this.capacity = capacity;
    this.m = new Map();
  }

  _touch(key) {
    const v = this.m.get(key);
    this.m.delete(key);
    this.m.set(key, v);
  }

  set(key, value) {
    if (this.m.has(key)) {
      this.m.delete(key);
    } else if (this.m.size >= this.capacity) {
      const lru = this.m.keys().next().value;
      this.m.delete(lru);
    }
    this.m.set(key, value);
  }

  get(key) {
    if (!this.m.has(key)) return undefined;
    const v = this.m.get(key);
    this._touch(key);
    return v;
  }

  has(key) {
    return this.m.has(key);
  }

  size() {
    return this.m.size;
  }

  delete(key) {
    return this.m.delete(key);
  }

  clear() {
    this.m.clear();
  }

  keys() {
    return [...this.m.keys()].reverse();
  }

  peek(key) {
    return this.m.get(key);
  }
}

module.exports = { Cache };
