const { LRUCache } = require('./s5_cache.js');

console.log('Testing LRUCache validation...');

// Test 1: Constructor with invalid capacity
console.log('Test 1: Constructor with invalid capacity');
try {
  new LRUCache(-1);
  console.log('FAIL: Should have thrown an error for negative capacity');
} catch (e) {
  if (e.message === 'Capacity must be a positive integer') {
    console.log('PASS: Correctly threw error for negative capacity');
  } else {
    console.log('FAIL: Wrong error message for negative capacity:', e.message);
  }
}

try {
  new LRUCache(0);
  console.log('FAIL: Should have thrown an error for zero capacity');
} catch (e) {
  if (e.message === 'Capacity must be a positive integer') {
    console.log('PASS: Correctly threw error for zero capacity');
  } else {
    console.log('FAIL: Wrong error message for zero capacity:', e.message);
  }
}

try {
  new LRUCache(3.14);
  console.log('FAIL: Should have thrown an error for non-integer capacity');
} catch (e) {
  if (e.message === 'Capacity must be a positive integer') {
    console.log('PASS: Correctly threw error for non-integer capacity');
  } else {
    console.log('FAIL: Wrong error message for non-integer capacity:', e.message);
  }
}

try {
  new LRUCache('5');
  console.log('FAIL: Should have thrown an error for string capacity');
} catch (e) {
  if (e.message === 'Capacity must be a positive integer') {
    console.log('PASS: Correctly threw error for string capacity');
  } else {
    console.log('FAIL: Wrong error message for string capacity:', e.message);
  }
}

// Test 2: Constructor with valid capacity
console.log('\nTest 2: Constructor with valid capacity');
try {
  const cache = new LRUCache(5);
  console.log('PASS: Valid capacity works correctly');
} catch (e) {
  console.log('FAIL: Valid capacity should not throw an error:', e.message);
}

// Test 3: set() method with invalid ttlMs
console.log('\nTest 3: set() method with invalid ttlMs');
try {
  const cache = new LRUCache(5);
  cache.set('key', 'value', -1000);
  console.log('FAIL: Should have thrown an error for negative ttlMs');
} catch (e) {
  if (e.message === 'ttlMs must be a positive number') {
    console.log('PASS: Correctly threw error for negative ttlMs');
  } else {
    console.log('FAIL: Wrong error message for negative ttlMs:', e.message);
  }
}

try {
  const cache = new LRUCache(5);
  cache.set('key', 'value', 0);
  console.log('FAIL: Should have thrown an error for zero ttlMs');
} catch (e) {
  if (e.message === 'ttlMs must be a positive number') {
    console.log('PASS: Correctly threw error for zero ttlMs');
  } else {
    console.log('FAIL: Wrong error message for zero ttlMs:', e.message);
  }
}

try {
  const cache = new LRUCache(5);
  cache.set('key', 'value', '1000');
  console.log('FAIL: Should have thrown an error for string ttlMs');
} catch (e) {
  if (e.message === 'ttlMs must be a positive number') {
    console.log('PASS: Correctly threw error for string ttlMs');
  } else {
    console.log('FAIL: Wrong error message for string ttlMs:', e.message);
  }
}

// Test 4: set() method with valid ttlMs
console.log('\nTest 4: set() method with valid ttlMs');
try {
  const cache = new LRUCache(5);
  cache.set('key', 'value', 1000);
  console.log('PASS: Valid ttlMs works correctly');
} catch (e) {
  console.log('FAIL: Valid ttlMs should not throw an error:', e.message);
}

console.log('\nAll tests completed.');