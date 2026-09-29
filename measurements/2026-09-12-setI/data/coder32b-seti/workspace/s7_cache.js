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
      const lruKey = this.order.shift();
      this.cache.delete(lruKey);
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
// Test cases
const cache = new Cache(3);

cache.set('a', 1);
cache.set('b', 2);
cache.set('c', 3);

console.log(cache.get('a')); // Expected output: 1
console.log(cache.get('b')); // Expected output: 2
console.log(cache.get('c')); // Expected output: 3

console.log(cache.delete('b')); // Expected output: true
console.log(cache.get('b')); // Expected output: undefined

console.log(cache.delete('d')); // Expected output: false

cache.set('d', 4);
console.log(cache.get('d')); // Expected output: 4

cache.clear();
console.log(cache.get('a')); // Expected output: undefined
console.log(cache.get('c')); // Expected output: undefined
console.log(cache.get('d')); // Expected output: undefined
console.log(cache.size()); // Expected output: 0
