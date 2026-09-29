// Simple debug version to understand the LRU issue
class Cache {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('Capacity must be a positive integer');
    }
    
    this.capacity = capacity;
    this.map = new Map();
  }
  
  set(key, value) {
    console.log(`Setting ${key} = ${value}`);
    console.log(`Before set - map size: ${this.map.size}, keys: [${Array.from(this.map.keys())}]`);
    
    // If key exists, update it and move to end (most recently used)
    if (this.map.has(key)) {
      console.log(`Key ${key} already exists, deleting it`);
      this.map.delete(key);
    }
    
    // If cache is full, remove the least recently used item (first item)
    if (this.map.size >= this.capacity) {
      console.log(`Cache is full (${this.map.size} >= ${this.capacity}), evicting LRU`);
      const firstKey = this.map.keys().next().value;
      console.log(`First key to evict: ${firstKey}`);
      this.map.delete(firstKey);
      console.log(`After eviction - map size: ${this.map.size}, keys: [${Array.from(this.map.keys())}]`);
    }
    
    // Add the new item at the end (most recently used)
    this.map.set(key, value);
    console.log(`After set - map size: ${this.map.size}, keys: [${Array.from(this.map.keys())}]`);
  }
  
  get(key) {
    console.log(`Getting ${key}`);
    if (!this.map.has(key)) {
      console.log(`Key ${key} not found`);
      return undefined;
    }
    
    // Get the value and move the key to the end (mark as most recently used)
    const value = this.map.get(key);
    console.log(`Found ${key} = ${value}`);
    this.map.delete(key);
    this.map.set(key, value);
    console.log(`After get - map size: ${this.map.size}, keys: [${Array.from(this.map.keys())}]`);
    
    return value;
  }
  
  has(key) {
    return this.map.has(key);
  }
  
  size() {
    return this.map.size;
  }
}

// Test the debug version
console.log('=== Debug LRU Cache ===');
const cache = new Cache(2);

console.log('\nStep 1: Set a=1');
cache.set('a', 1);

console.log('\nStep 2: Set b=2');
cache.set('b', 2);

console.log('\nStep 3: Set c=3 (should evict a)');
cache.set('c', 3);

console.log('\nFinal state:');
console.log(`Has 'a': ${cache.has('a')}`);
console.log(`Has 'b': ${cache.has('b')}`);
console.log(`Has 'c': ${cache.has('c')}`);
console.log(`Size: ${cache.size()}`);