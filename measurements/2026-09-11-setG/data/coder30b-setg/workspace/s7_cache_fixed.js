class Cache {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    
    this.capacity = capacity;
    this.map = new Map();
  }
  
  set(key, value) {
    if (this.map.has(key)) {
      // Update existing key - move to end to mark as recently used
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      // Remove least recently used item (first item in the map)
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }
    
    this.map.set(key, value);
  }
  
  get(key) {
    if (!this.map.has(key)) {
      return undefined;
    }
    
    // Move to end to mark as recently used
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
}

function runTests() {
  console.log("Running Cache tests...");
  
  // Test 1: Constructor validation
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
    console.log("  cache.has('a'):", cache.has("a"));
    console.log("  cache.has('b'):", cache.has("b"));
    console.log("  cache.has('c'):", cache.has("c"));
  }
  
  // Test 5: LRU behavior
  cache.get("b"); // Use "b" to make it recent
  cache.set("d", 4); // This should evict "c"
  
  if (cache.has("b") === true && cache.has("c") === false && cache.has("d") === true) {
    console.log("✓ LRU behavior works correctly");
  } else {
    console.error("ERROR: LRU behavior failed");
    console.log("  cache.has('b'):", cache.has("b"));
    console.log("  cache.has('c'):", cache.has("c"));
    console.log("  cache.has('d'):", cache.has("d"));
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