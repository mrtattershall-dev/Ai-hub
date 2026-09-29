class Cache {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('Capacity must be a positive integer');
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.order = [];
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.order.splice(this.order.indexOf(key), 1);
    } else if (this.cache.size >= this.capacity) {
      const oldestKey = this.order.shift();
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.order.push(key);
  }

  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }
    this.order.splice(this.order.indexOf(key), 1);
    this.order.push(key);
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
      this.order.splice(this.order.indexOf(key), 1);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.order = [];
  }
}

module.exports = Cache;