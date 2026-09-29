class Cache {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = [];
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      const index = this.usageOrder.indexOf(key);
      this.usageOrder.splice(index, 1);
    } else {
      if (this.cache.size >= this.capacity) {
        const lruKey = this.usageOrder.shift();
        this.cache.delete(lruKey);
      }
      this.cache.set(key, value);
    }
    this.usageOrder.push(key);
  }

  get(key) {
    if (this.cache.has(key)) {
      const index = this.usageOrder.indexOf(key);
      this.usageOrder.splice(index, 1);
      this.usageOrder.push(key);
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
}

module.exports = Cache;