class LRUCache {
constructor(capacity) {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error("Capacity must be a positive integer");
  }
  this.capacity = capacity;
  this.cache = new Map();
}

  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
set(key, value, ttlMs) {
  if (ttlMs !== undefined && (!Number.isInteger(ttlMs) || ttlMs <= 0)) {
    throw new Error("ttlMs must be a positive integer");
  }
  if (this.cache.has(key)) {
    this.cache.delete(key);
  } else if (this.cache.size >= this.capacity) {
    const oldestKey = this.cache.keys().next().value;
    this.cache.delete(oldestKey);
  }
  this.cache.set(key, value);
}
}

module.exports = LRUCache;