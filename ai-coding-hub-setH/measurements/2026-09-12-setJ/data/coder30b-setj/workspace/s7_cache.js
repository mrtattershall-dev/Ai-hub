// Cache class implementation with LRU eviction
class Cache {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    
    this.capacity = capacity;
    this.map = new Map();
  }
  
  set(key, value) {
    // If key already exists, update it and move to end (most recently used)
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    
    // If cache is full, remove the least recently used item (first item)
    if (this.map.size >= this.capacity) {
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }
    
    // Add the new key-value pair at the end (most recently used)
    this.map.set(key, value);
  }
  
  get(key) {
    // If key doesn't exist, return undefined
    if (!this.map.has(key)) {
      return undefined;
    }
    
    // Get the value and move the key to the end (mark as most recently used)
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    
    return value;
  }
  
  has(key) {
    return this.map.has(key);
  }
  
  size() {
    return this.map.size;
  }
  
  delete(key) {
    return this.map.delete(key);
  }
  
  clear() {
    this.map.clear();
  }
}

module.exports = { Cache };