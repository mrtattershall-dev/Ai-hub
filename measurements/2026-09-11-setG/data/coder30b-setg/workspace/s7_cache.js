class Cache {
  constructor(capacity, options = {}) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    
    this.capacity = capacity;
    this.map = new Map();
    this.ttl = options.ttl || Infinity;
    this.now = options.now || Date.now;
    this.onEvict = options.onEvict;
    
    // Stats counters
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
      // Remove least recently used item (first item in the map)
      const firstKey = this.map.keys().next().value;
      const entry = this.map.get(firstKey);
      this.map.delete(firstKey);
      this.evictions++;
      if (this.onEvict) {
        this.onEvict(firstKey, entry.value, 'lru');
      }
    }
    
    const ttl = options.ttl !== undefined ? options.ttl : this.ttl;
    const timestamp = this.now();
    
    this.map.set(key, { value, timestamp, ttl });
  }
  
  get(key) {
    if (!this.map.has(key)) {
      this.misses++;
      return undefined;
    }
    
    const entry = this.map.get(key);
    const { value, timestamp, ttl } = entry;
    
    // Check if entry has expired
    if (this.now() - timestamp > ttl) {
      this.map.delete(key);
      this.expirations++;
      if (this.onEvict) {
        this.onEvict(key, value, 'expired');
      }
      return undefined;
    }
    
    // Move to end to mark as recently used
    this.map.delete(key);
    this.map.set(key, entry);
    this.hits++;
    
    return value;
  }
  
  peek(key) {
    if (!this.map.has(key)) {
      return undefined;
    }
    
    const entry = this.map.get(key);
    const { value, timestamp, ttl } = entry;
    
    // Check if entry has expired
    if (this.now() - timestamp > ttl) {
      this.map.delete(key);
      return undefined;
    }
    
    // Return the value without marking as recently used
    return value;
  }
  
  has(key) {
    if (!this.map.has(key)) {
      return false;
    }
    
    const entry = this.map.get(key);
    const { timestamp, ttl } = entry;
    
    // Check if entry has expired
    if (this.now() - timestamp > ttl) {
      this.map.delete(key);
      return false;
    }
    
    return true;
  }
  
  size() {
    let count = 0;
    const now = this.now();
    
    for (const [key, entry] of this.map.entries()) {
      const { timestamp, ttl } = entry;
      
      // Check if entry has expired
      if (now - timestamp <= ttl) {
        count++;
      } else {
        // Remove expired entry
        this.map.delete(key);
      }
    }
    
    return count;
  }
  
  delete(key) {
    const entry = this.map.get(key);
    const deleted = this.map.delete(key);
    if (deleted && this.onEvict) {
      if (entry) {
        this.onEvict(key, entry.value, 'deleted');
      }
    }
    return deleted;
  }
  
  clear() {
    this.map.clear();
  }
  
  resize(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    
    // Evict LRU entries until we fit within the new capacity
    while (this.map.size > capacity) {
      // Remove least recently used item (first item in the map)
      const firstKey = this.map.keys().next().value;
      const entry = this.map.get(firstKey);
      this.map.delete(firstKey);
      this.evictions++;
      if (this.onEvict) {
        this.onEvict(firstKey, entry.value, 'lru');
      }
    }
    
    this.capacity = capacity;
  }
  
  keys() {
    return Array.from(this.map.keys()).reverse();
  }
  
  stats() {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      expirations: this.expirations
    };
  }
}

// Export the Cache class
module.exports = { Cache };

// Test asserts
function runTests() {
  console.log("Running Cache tests...");
  
  // Test 1: Constructor with invalid capacity
  try {
    new Cache(0);
    console.error("ERROR: Should have thrown for capacity 0");
  } catch (e) {
    console.log("✓ Constructor correctly rejects capacity 0");
  }
  
  try {
    new Cache(-1);
    console.error("ERROR: Should have thrown for negative capacity");
  } catch (e) {
    console.log("✓ Constructor correctly rejects negative capacity");
  }
  
  try {
    new Cache(3.14);
    console.error("ERROR: Should have thrown for non-integer capacity");
  } catch (e) {
    console.log("✓ Constructor correctly rejects non-integer capacity");
  }
  
  // Test 2: Basic functionality
  const cache = new Cache(2);
  
  cache.set("a", 1);
  cache.set("b", 2);
  
  if (cache.get("a") === 1) {
    console.log("✓ Basic get/set works");
  } else {
    console.error("ERROR: Basic get/set failed");
  }
  
  // Test 3: Size tracking
  if (cache.size() === 2) {
    console.log("✓ Size tracking works");
  } else {
    console.error("ERROR: Size tracking failed");
  }
  
  // Test 4: Eviction
  cache.set("c", 3);
  
  if (cache.has("a") === false && cache.has("b") === true && cache.has("c") === true) {
    console.log("✓ Eviction works correctly");
  } else {
    console.error("ERROR: Eviction failed");
  }
  
  // Test 5: LRU behavior
  cache.get("b"); // Use "b" to make it recent
  cache.set("d", 4); // This should evict "c"
  
  if (cache.has("b") === true && cache.has("c") === false && cache.has("d") === true) {
    console.log("✓ LRU behavior works correctly");
  } else {
    console.error("ERROR: LRU behavior failed");
  }
  
  // Test 6: Update existing key
  cache.set("b", 22);
  if (cache.get("b") === 22) {
    console.log("✓ Update existing key works");
  } else {
    console.error("ERROR: Update existing key failed");
  }
  
  console.log("All tests completed!");
}

runTests();