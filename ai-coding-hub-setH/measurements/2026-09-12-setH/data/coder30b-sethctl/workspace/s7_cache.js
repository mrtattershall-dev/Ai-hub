// Cache class implementation with LRU eviction
class Cache {
  constructor(capacity, options = {}) {
    // Validate capacity
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    
    this.capacity = capacity;
    this.map = new Map();
    this.ttl = options.ttl || null;
    this.now = options.now || (() => Date.now());
    // Stats counters
    this.hits = 0;
    this.misses = 0;
    this.evolutions = 0;
    this.expirations = 0;
  }
  
  set(key, value, options = {}) {
    // If key exists, update it and move to end (most recently used)
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    
    // Get TTL for this entry (use instance TTL or provided TTL)
    const ttl = options.ttl !== undefined ? options.ttl : this.ttl;
    
    // Add new key-value pair with timestamp
    const entry = {
      value: value,
      timestamp: this.now()
    };
    
    if (ttl !== null) {
      entry.ttl = ttl;
    }
    
    this.map.set(key, entry);
    
    // If cache is over capacity, remove the least recently used item
    if (this.map.size > this.capacity) {
      // Get the first key (least recently used) and delete it
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
      this.evolutions++;
    }
  }
  
  get(key) {
    // If key doesn't exist, return undefined
    if (!this.map.has(key)) {
      this.misses++;
      return undefined;
    }
    
    // Get the entry and check if it's expired
    const entry = this.map.get(key);
    if (this._isExpired(entry)) {
      this.map.delete(key);
      this.expirations++;
      return undefined;
    }
    
    // Get the value and move to end (mark as most recently used)
    const value = entry.value;
    this.map.delete(key);
    this.map.set(key, entry);
    this.hits++;
    
    return value;
  }
  
  peek(key) {
    // If key doesn't exist, return undefined
    if (!this.map.has(key)) {
      return undefined;
    }
    
    // Get the entry and check if it's expired
    const entry = this.map.get(key);
    if (this._isExpired(entry)) {
      this.map.delete(key);
      return undefined;
    }
    
    // Get the value without updating usage order
    return entry.value;
  }
  
  has(key) {
    // If key doesn't exist, return false
    if (!this.map.has(key)) {
      return false;
    }
    
    // Get the entry and check if it's expired
    const entry = this.map.get(key);
    if (this._isExpired(entry)) {
      this.map.delete(key);
      return false;
    }
    
    return true;
  }
  
  size() {
    // Count non-expired entries
    let count = 0;
    for (const entry of this.map.values()) {
      if (!this._isExpired(entry)) {
        count++;
      }
    }
    return count;
  }
  
  delete(key) {
    return this.map.delete(key);
  }
  
  clear() {
    this.map.clear();
  }
  
  stats() {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evolutions,
      expirations: this.expirations
    };
  }
  
  keys() {
    // Return keys in insertion order (not LRU order) but only for non-expired entries
    const result = [];
    for (const [key, entry] of this.map.entries()) {
      if (!this._isExpired(entry)) {
        result.push(key);
      }
    }
    return result;
  }
  
  _isExpired(entry) {
    if (entry.ttl === undefined) {
      return false;
    }
    return (this.now() - entry.timestamp) >= entry.ttl;
  }
}

module.exports = { Cache };