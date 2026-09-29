class Cache {
constructor(capacity, options = {}) {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error("Capacity must be a positive integer");
  }
  this.capacity = capacity;
  this.cache = new Map();
  this.usage = new Map();
  this.onEvict = options.onEvict || null;
}
set(key, value) {
  if (this.cache.size >= this.capacity) {
    const leastUsedKey = this.getLeastUsedKey();
    const leastUsedValue = this.cache.get(leastUsedKey);
    this.cache.delete(leastUsedKey);
    this.usage.delete(leastUsedKey);
    if (this.onEvict) {
      this.onEvict(leastUsedKey, leastUsedValue, 'lru');
    }
  }
  this.cache.set(key, value);
  this.usage.set(key, Date.now());
}

  get(key) {
    if (this.cache.has(key)) {
      this.usage.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  peek(key) {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  getLeastUsedKey() {
    let leastUsedKey = null;
    let leastUsedTime = Infinity;
    for (const [key, time] of this.usage.entries()) {
      if (time < leastUsedTime) {
        leastUsedTime = time;
        leastUsedKey = key;
      }
    }
    return leastUsedKey;
  }
}

module.exports = Cache;