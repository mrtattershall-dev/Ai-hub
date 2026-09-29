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
      return undefined;
    }
    
    return entry.value;
  }
  
  has(key) {
    return this.map.has(key) && !(this.now() - this.map.get(key).timestamp > this.map.get(key).ttl);
  }
  
  size() {
    return this.map.size;
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
    for (const [key, entry] of this.map.entries()) {
      if (this.onEvict) {
        this.onEvict(key, entry.value, 'deleted');
      }
    }
    this.map.clear();
  }
  
  // Add a method to inspect the internal state
  debugState() {
    console.log("Cache state:");
    console.log("  Capacity:", this.capacity);
    console.log("  Size:", this.map.size);
    console.log("  Keys:", Array.from(this.map.keys()));
    console.log("  Map contents:", this.map);
  }
}

// Test the cache with debug
const cache = new Cache(2, {
  onEvict: (key, value, reason) => {
    console.log(`Evicted: key=${key}, value=${value}, reason=${reason}`);
  }
});

console.log("Setting 'a'...");
cache.set("a", 1);
cache.debugState();

console.log("Setting 'b'...");
cache.set("b", 2);
cache.debugState();

console.log("Setting 'c' (should evict 'a')...");
cache.set("c", 3);
cache.debugState();

console.log("Checking if 'a' exists:", cache.has("a"));
console.log("Checking if 'b' exists:", cache.has("b"));
console.log("Checking if 'c' exists:", cache.has("c"));