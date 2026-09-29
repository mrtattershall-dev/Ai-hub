class Cache {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    
    this.capacity = capacity;
    this.map = new Map();
  }
  
  set(key, value) {
    console.log(`\nSET: Setting ${key} = ${value}`);
    console.log(`Before set - size: ${this.map.size}, keys: [${Array.from(this.map.keys()).join(', ')}]`);
    
    if (this.map.has(key)) {
      // Update existing key
      console.log(`Updating existing key ${key}`);
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      // Remove least recently used item (first item in the map)
      console.log(`Cache is full (${this.capacity}), need to evict`);
      const firstKey = this.map.keys().next().value;
      console.log(`Evicting least recently used key: ${firstKey}`);
      this.map.delete(firstKey);
    }
    
    this.map.set(key, value);
    console.log(`After set - size: ${this.map.size}, keys: [${Array.from(this.map.keys()).join(', ')}]`);
  }
  
  get(key) {
    console.log(`\nGET: Getting key ${key}`);
    console.log(`Before get - size: ${this.map.size}, keys: [${Array.from(this.map.keys()).join(', ')}]`);
    
    if (!this.map.has(key)) {
      console.log(`Key ${key} not found`);
      return undefined;
    }
    
    // Move to end to mark as recently used
    const value = this.map.get(key);
    console.log(`Found key ${key} with value ${value}`);
    this.map.delete(key);
    this.map.set(key, value);
    console.log(`After get - size: ${this.map.size}, keys: [${Array.from(this.map.keys()).join(', ')}]`);
    
    return value;
  }
  
  has(key) {
    return this.map.has(key);
  }
  
  size() {
    return this.map.size;
  }
}

// Test the detailed behavior
console.log("=== DETAILED CACHE TEST ===");
const cache = new Cache(2);

console.log("\n1. Setting 'a' = 1");
cache.set("a", 1);

console.log("\n2. Setting 'b' = 2");
cache.set("b", 2);

console.log("\n3. Setting 'c' = 3 (should evict 'a')");
cache.set("c", 3);

console.log("\nFinal state:");
console.log(`Has 'a': ${cache.has("a")}`);
console.log(`Has 'b': ${cache.has("b")}`);
console.log(`Has 'c': ${cache.has("c")}`);
console.log(`Size: ${cache.size()}`);