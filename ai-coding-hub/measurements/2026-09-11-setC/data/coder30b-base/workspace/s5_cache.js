class LRUCache {
  constructor(capacity, now = Date.now) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('Capacity must be a positive integer');
    }
    this.capacity = capacity;
    this.now = now;
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  get(key) {
    if (!this.cache.has(key)) {
      this.misses++;
      return undefined;
    }
    
    const entry = this.cache.get(key);
    // Check if the entry has expired
    if (entry.expiry !== undefined && this.now() > entry.expiry) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }
    
    // Move the key to the end (mark as most recently used)
    const value = entry.value;
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    
    return value;
  }

  set(key, value, ttlMs) {
    // If key already exists, update it and move to end
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Remove the least recently used item (first item in Map)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.evictions++;
    }
    
    // Add the new key-value pair with optional expiry
    const entry = { value };
    if (ttlMs !== undefined) {
      if (typeof ttlMs !== 'number' || ttlMs <= 0) {
        throw new Error('ttlMs must be a positive number');
      }
      entry.expiry = this.now() + ttlMs;
    }
    this.cache.set(key, entry);
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
  
  stats() {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions
    };
  }
}

module.exports = { LRUCache };