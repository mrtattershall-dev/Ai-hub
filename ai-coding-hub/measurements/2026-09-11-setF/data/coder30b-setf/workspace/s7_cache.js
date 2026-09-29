// Cache class implementation
class Cache {
  constructor(capacity, options = {}) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('Capacity must be a positive integer');
    }
    this.capacity = capacity;
    this.map = new Map();
    this.ttl = options.ttl || null;
    this.now = options.now || (() => Date.now());
    this.onEvict = options.onEvict || null;
    // Stats tracking
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.expirations = 0;
  }
  
  set(key, value, options = {}) {
    if (this.map.has(key)) {
      // Update existing key
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      // Remove least recently used item
      const firstKey = this.map.keys().next().value;
      const entry = this.map.get(firstKey);
      this.map.delete(firstKey);
      if (this.onEvict) {
        this.onEvict(firstKey, entry.value, 'lru');
      }
    }
    
    const ttl = options.ttl !== undefined ? options.ttl : this.ttl;
    const expiry = ttl !== null ? this.now() + ttl : null;
    
    this.map.set(key, { value, expiry });
  }
  
  get(key) {
    if (!this.map.has(key)) {
      this.misses++;
      return undefined;
    }
    // Check if entry has expired
    const entry = this.map.get(key);
    if (entry.expiry !== null && this.now() > entry.expiry) {
      this.map.delete(key);
      this.expirations++;
      if (this.onEvict) {
        this.onEvict(key, entry.value, 'expired');
      }
      return undefined;
    }
    // Move to end to mark as recently used
    const value = entry.value;
    this.map.delete(key);
    this.map.set(key, entry);
    this.hits++;
    return value;
  }
  
  peek(key) {
    if (!this.map.has(key)) {
      return undefined;
    }
    // Check if entry has expired
    const entry = this.map.get(key);
    if (entry.expiry !== null && this.now() > entry.expiry) {
      this.map.delete(key);
      return undefined;
    }
    // Just return the value without marking as recently used
    return entry.value;
  }
  
  has(key) {
    if (!this.map.has(key)) {
      return false;
    }
    // Check if entry has expired
    const entry = this.map.get(key);
    if (entry.expiry !== null && this.now() > entry.expiry) {
      this.map.delete(key);
      return false;
    }
    return true;
  }
  
  size() {
    let count = 0;
    for (const entry of this.map.values()) {
      if (entry.expiry === null || this.now() <= entry.expiry) {
        count++;
      }
    }
    return count;
  }
  
  delete(key) {
    const entry = this.map.get(key);
    const deleted = this.map.delete(key);
    if (deleted && this.onEvict) {
      this.onEvict(key, entry.value, 'deleted');
    }
    return deleted;
  }
  
  clear() {
    if (this.onEvict) {
      for (const [key, entry] of this.map.entries()) {
        this.onEvict(key, entry.value, 'deleted');
      }
    }
    this.map.clear();
  }
  
  keys() {
    return Array.from(this.map.keys());
  }
  
  stats() {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      expirations: this.expirations
    };
  }

  resize(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('Capacity must be a positive integer');
    }
    
    // Evict LRU entries until we're under the new capacity
    while (this.map.size > capacity) {
      // Get the first key (LRU entry)
      const firstKey = this.map.keys().next().value;
      const entry = this.map.get(firstKey);
      this.map.delete(firstKey);
      if (this.onEvict) {
        this.onEvict(firstKey, entry.value, 'lru');
      }
      this.evictions++;
    }
    
    this.capacity = capacity;
  }

  toJSON() {
    const result = {
      capacity: this.capacity,
      entries: []
    };
    
    // Iterate through entries in LRU order (from oldest to newest)
    for (const [key, entry] of this.map.entries()) {
      // Only include non-expired entries
      if (entry.expiry === null || this.now() <= entry.expiry) {
        result.entries.push([key, entry.value]);
      }
    }
    
    return result;
  }

  getOrSet(key, factory) {
    const value = this.get(key);
    if (value !== undefined) {
      return value;
    }
    
    // Miss - call factory to compute the value
    try {
      const newValue = factory(key);
      this.set(key, newValue);
      return newValue;
    } catch (error) {
      // If factory throws, don't store anything and re-throw the error
      throw error;
    }
  }

  static fromJSON(data, options = {}) {
    const cache = new Cache(data.capacity, options);
    
    // Rebuild cache with entries in the same order
    for (const [key, value] of data.entries) {
      cache.set(key, value, { ttl: null });
    }
    
    return cache;
  }
}

// Export the Cache class
module.exports = { Cache };
// Test assertions
function runTests() {
  console.log('Running Cache tests...');
  
  // Test 1: Constructor validation
  try {
    new Cache(-1);
    console.log('FAIL: Constructor should throw for negative capacity');
    return false;
  } catch (e) {
    console.log('PASS: Constructor correctly rejects negative capacity');
  }
  
  try {
    new Cache(0);
    console.log('FAIL: Constructor should throw for zero capacity');
    return false;
  } catch (e) {
    console.log('PASS: Constructor correctly rejects zero capacity');
  }
  
  try {
    new Cache(1.5);
    console.log('FAIL: Constructor should throw for non-integer capacity');
    return false;
  } catch (e) {
    console.log('PASS: Constructor correctly rejects non-integer capacity');
  }
  
  // Test 2: Basic functionality
  const cache = new Cache(2);
  
  // Test size and empty cache
  if (cache.size() !== 0) {
    console.log('FAIL: Empty cache should have size 0');
    return false;
  }
  
  // Test set and get
  cache.set('a', 1);
  if (cache.get('a') !== 1) {
    console.log('FAIL: Set/get should work');
    return false;
  }
  
  // Test has
  if (!cache.has('a')) {
    console.log('FAIL: has() should return true for existing key');
    return false;
  }
  
  // Test size after set
  if (cache.size() !== 1) {
    console.log('FAIL: Cache size should be 1 after one set');
    return false;
  }
  
  // Test 3: LRU eviction
  cache.set('b', 2);
  cache.set('c', 3); // This should evict 'a'
  
  if (cache.has('a')) {
    console.log('FAIL: Least recently used item should be evicted');
    return false;
  }
  
  if (cache.get('b') !== 2) {
    console.log('FAIL: Recently used item should still be accessible');
    return false;
  }
  
  if (cache.get('c') !== 3) {
    console.log('FAIL: Recently added item should be accessible');
    return false;
  }
  
  // Test 4: Update existing key (should update LRU position)
  cache.get('b'); // Access 'b' to make it recently used
  cache.set('d', 4); // This should evict 'c' (least recently used)
  
  if (cache.has('c')) {
    console.log('FAIL: Least recently used item should be evicted');
    return false;
  }
  
  if (cache.get('b') !== 2) {
    console.log('FAIL: Recently used item should still be accessible');
    return false;
  }
  
  if (cache.get('d') !== 4) {
    console.log('FAIL: Recently added item should be accessible');
    return false;
  }
  
  console.log('All tests passed!');
  return true;
}

// Run the tests
runTests();

// Export the Cache class for use in other modules
module.exports = Cache;
