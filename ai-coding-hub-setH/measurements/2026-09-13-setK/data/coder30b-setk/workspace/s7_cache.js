// Cache class implementation
class Cache {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('Capacity must be a positive integer');
    }
    
    this.capacity = capacity;
    this.map = new Map();
  }
  
  set(key, value) {
    // If key exists, update it and move to end (most recently used)
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    
    // If cache is full, remove the least recently used item (first item)
    if (this.map.size >= this.capacity) {
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }
    
    // Add the new item at the end (most recently used)
    this.map.set(key, value);
  }
  
  get(key) {
    if (!this.map.has(key)) {
      return undefined;
    }
    
    // Get the value and move the key to the end (mark as most recently used)
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    
    return value;
  }
  
  peek(key) {
    if (!this.map.has(key)) {
      return undefined;
    }
    
    // Get the value without moving the key (no LRU update)
    return this.map.get(key);
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
  
  keys() {
    return Array.from(this.map.keys());
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
  
  try {
    const cache = new Cache(2);
    console.log('PASS: Constructor accepts valid capacity');
  } catch (e) {
    console.log('FAIL: Constructor should accept valid capacity');
    return false;
  }
  
  // Test 2: Basic set and get
  const cache = new Cache(2);
  
  cache.set('a', 1);
  cache.set('b', 2);
  
  if (cache.get('a') === 1) {
    console.log('PASS: Basic get works');
  } else {
    console.log('FAIL: Basic get failed');
    return false;
  }
  
  // Test 3: Size tracking
  if (cache.size() === 2) {
    console.log('PASS: Size tracking works');
  } else {
    console.log('FAIL: Size tracking failed');
    return false;
  }
  
  // Test 4: Has method
  if (cache.has('b') === true) {
    console.log('PASS: Has method works');
  } else {
    console.log('FAIL: Has method failed');
    return false;
  }
  
  if (cache.has('c') === false) {
    console.log('PASS: Has method correctly identifies missing key');
  } else {
    console.log('FAIL: Has method failed to identify missing key');
    return false;
  }
  
  // Test 5: LRU eviction
  // 'b' should be evicted since it's the least recently used
  // (a was accessed, then b was set, then a was accessed again, so b is LRU)
  cache.set('c', 3);
  
  if (cache.has('b') === false) {
    console.log('PASS: LRU eviction works');
  } else {
    console.log('FAIL: LRU eviction failed');
    return false;
  }
  
  if (cache.get('a') === 1 && cache.get('c') === 3) {
    console.log('PASS: Remaining items are still accessible');
  } else {
    console.log('FAIL: Remaining items not accessible after eviction');
    return false;
  }
  
  // Test 6: Update existing key (should move to end)
  cache.set('a', 20);
  if (cache.get('a') === 20) {
    console.log('PASS: Updating existing key works');
  } else {
    console.log('FAIL: Updating existing key failed');
    return false;
  }
  
  // Test 7: Get on missing key
  if (cache.get('b') === undefined) {
    console.log('PASS: Get on missing key returns undefined');
  } else {
    console.log('FAIL: Get on missing key should return undefined');
    return false;
  }
  
  console.log('All tests passed!');
  return true;
}

// Run the tests
if (require.main === module) {
  runTests();
}