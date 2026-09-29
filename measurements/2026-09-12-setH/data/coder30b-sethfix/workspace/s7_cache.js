class Cache {
  constructor(capacity, options = {}) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('Capacity must be a positive integer');
    }
    
    this.capacity = capacity;
    this.map = new Map();
    this.ttl = options.ttl || null;
    this.now = options.now || (() => Date.now());
  }
  
  set(key, value, options = {}) {
    // If key exists, update it and move to end (most recently used)
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    
    // Add new key-value pair with timestamp
    const entry = {
      value: value,
      timestamp: this.now()
    };
    
    // Apply TTL from options or default TTL
    if (options.ttl !== undefined) {
      entry.ttl = options.ttl;
    } else if (this.ttl !== null) {
      entry.ttl = this.ttl;
    }
    
    this.map.set(key, entry);
    
    // If cache is over capacity, remove the least recently used item
    if (this.map.size > this.capacity) {
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }
  }
  
  get(key) {
    if (!this.map.has(key)) {
      return undefined;
    }
    
    const entry = this.map.get(key);
    
    // Check if entry has expired
    if (entry.ttl !== undefined) {
      const age = this.now() - entry.timestamp;
      if (age > entry.ttl) {
        this.map.delete(key);
        return undefined;
      }
    } else if (this.ttl !== null) {
      const age = this.now() - entry.timestamp;
      if (age > this.ttl) {
        this.map.delete(key);
        return undefined;
      }
    }
    
    // Get the value and move to end (most recently used)
    const value = entry.value;
    this.map.delete(key);
    this.map.set(key, entry);
    
    return value;
  }
  
  peek(key) {
    if (!this.map.has(key)) {
      return undefined;
    }
    
    const entry = this.map.get(key);
    
    // Check if entry has expired
    if (entry.ttl !== undefined) {
      const age = this.now() - entry.timestamp;
      if (age > entry.ttl) {
        this.map.delete(key);
        return undefined;
      }
    } else if (this.ttl !== null) {
      const age = this.now() - entry.timestamp;
      if (age > this.ttl) {
        this.map.delete(key);
        return undefined;
      }
    }
    
    return entry.value;
  }
  
  has(key) {
    if (!this.map.has(key)) {
      return false;
    }
    
    const entry = this.map.get(key);
    
    // Check if entry has expired
    if (entry.ttl !== undefined) {
      const age = this.now() - entry.timestamp;
      if (age > entry.ttl) {
        this.map.delete(key);
        return false;
      }
    } else if (this.ttl !== null) {
      const age = this.now() - entry.timestamp;
      if (age > this.ttl) {
        this.map.delete(key);
        return false;
      }
    }
    
    return true;
  }
  
  size() {
    let count = 0;
    for (const [key, entry] of this.map.entries()) {
      // Check if entry has expired
      if (entry.ttl !== undefined) {
        const age = this.now() - entry.timestamp;
        if (age <= entry.ttl) {
          count++;
        }
      } else if (this.ttl !== null) {
        const age = this.now() - entry.timestamp;
        if (age <= this.ttl) {
          count++;
        }
      } else {
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
  
  keys() {
    const validKeys = [];
    for (const [key, entry] of this.map.entries()) {
      // Check if entry has expired
      if (entry.ttl !== undefined) {
        const age = this.now() - entry.timestamp;
        if (age <= entry.ttl) {
          validKeys.push(key);
        }
      } else if (this.ttl !== null) {
        const age = this.now() - entry.timestamp;
        if (age <= this.ttl) {
          validKeys.push(key);
        }
      } else {
        validKeys.push(key);
      }
    }
    return validKeys;
  }
}

// Export the Cache class
module.exports = { Cache };

// Add assertions to test the implementation
function runTests() {
  console.log('Running Cache tests...');
  
  // Test 1: Constructor with invalid capacity
  try {
    new Cache(0);
    console.log('FAIL: Should have thrown error for capacity 0');
  } catch (e) {
    console.log('PASS: Constructor rejects capacity 0');
  }
  
  try {
    new Cache(-1);
    console.log('FAIL: Should have thrown error for negative capacity');
  } catch (e) {
    console.log('PASS: Constructor rejects negative capacity');
  }
  
  try {
    new Cache(3.14);
    console.log('FAIL: Should have thrown error for non-integer capacity');
  } catch (e) {
    console.log('PASS: Constructor rejects non-integer capacity');
  }
  
  // Test 2: Basic functionality
  const cache = new Cache(2);
  
  cache.set('a', 1);
  cache.set('b', 2);
  
  if (cache.get('a') === 1) {
    console.log('PASS: Basic get works');
  } else {
    console.log('FAIL: Basic get failed');
  }
  
  if (cache.size() === 2) {
    console.log('PASS: Size is correct');
  } else {
    console.log('FAIL: Size is incorrect');
  }
  
  // Test 3: Eviction
  cache.set('c', 3);
  
  if (cache.get('b') === undefined) {
    console.log('PASS: Least recently used item was evicted');
  } else {
    console.log('FAIL: Least recently used item was not evicted');
  }
  
  if (cache.get('c') === 3) {
    console.log('PASS: Most recently used item is still there');
  } else {
    console.log('FAIL: Most recently used item was evicted');
  }
  
  // Test 4: Update existing key
  cache.set('a', 10);
  if (cache.get('a') === 10) {
    console.log('PASS: Updating existing key works');
  } else {
    console.log('FAIL: Updating existing key failed');
  }
  
  // Test 5: has() method
  if (cache.has('a')) {
    console.log('PASS: has() method works');
  } else {
    console.log('FAIL: has() method failed');
  }
  
  if (!cache.has('b')) {
    console.log('PASS: has() method correctly identifies missing keys');
  } else {
    console.log('FAIL: has() method incorrectly identifies missing keys');
  }
  
  console.log('All tests completed');
}

runTests();