class Cache {
  peek(key) {
    const entry = this.cache.get(key);
    if (entry && (!entry.expiry || entry.expiry > this.now())) {
      return entry.value;
    }
    return undefined;
  }
  constructor(capacity, options = {}) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = [];
    this.ttl = options.ttl || null;
    this.now = options.now || Date.now;
  }
  set(key, value, options = {}) {
    const expiry = options.ttl !== undefined ? this.now() + options.ttl : this.ttl;
    const entry = { value, expiry };
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.splice(this.usageOrder.indexOf(key), 1);
    } else if (this.cache.size >= this.capacity) {
      const lruKey = this.usageOrder.shift();
      this.cache.delete(lruKey);
    }
    this.cache.set(key, entry);
    this.usageOrder.push(key);
  }
  get(key) {
    const entry = this.cache.get(key);
    if (entry && (!entry.expiry || entry.expiry > this.now())) {
      this.usageOrder.splice(this.usageOrder.indexOf(key), 1);
      this.usageOrder.push(key);
      return entry.value;
    }
    return undefined;
  }
  has(key) {
    const entry = this.cache.get(key);
    return entry && (!entry.expiry || entry.expiry > this.now());
  }
  size() {
    return this.cache.size;
  }
  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.splice(this.usageOrder.indexOf(key), 1);
      return true;
    }
    return false;
  }
  clear() {
    this.cache.clear();
    this.usageOrder.length = 0;
  }
}
module.exports = Cache;