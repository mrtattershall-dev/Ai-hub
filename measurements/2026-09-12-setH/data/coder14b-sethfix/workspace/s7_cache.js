class Cache {
constructor(capacity, options = {}) {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error("Capacity must be a positive integer");
  }
  this.capacity = capacity;
  this.cache = new Map();
  this.ttl = options.ttl || null;
  this.now = options.now || Date.now;
}

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    if (this.cache.size > this.capacity) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  get(key) {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  peek(key) {
    return this.cache.get(key);
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
  }

  keys() {
    return Array.from(this.cache.keys()).reverse();
  }
}

module.exports = Cache;