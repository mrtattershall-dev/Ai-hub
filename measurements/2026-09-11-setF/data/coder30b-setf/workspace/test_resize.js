const { Cache } = require('./s7_cache.js');

// Test the resize functionality
console.log('Testing resize functionality...');

// Create a cache with capacity 3
const cache = new Cache(3);

// Add some items
cache.set('a', 1);
cache.set('b', 2);
cache.set('c', 3);
console.log('Added items a, b, c');

// Access 'a' to make it recently used
cache.get('a');
console.log('Accessed item a');

// Add one more item to trigger eviction
cache.set('d', 4);
console.log('Added item d - should evict least recently used (b)');

// Check what's left
console.log('Cache contents:', cache.keys());
console.log('Expected: [\'a\', \'c\', \'d\']');

// Now resize to capacity 2
cache.resize(2);
console.log('Resized to capacity 2');
console.log('Cache contents after resize:', cache.keys());
console.log('Expected: [\'c\', \'d\'] (a was evicted as LRU)');

// Try to resize to invalid capacity
try {
  cache.resize(-1);
  console.log('ERROR: Should have thrown for negative capacity');
} catch (e) {
  console.log('PASS: Correctly threw error for negative capacity');
}

try {
  cache.resize(0);
  console.log('ERROR: Should have thrown for zero capacity');
} catch (e) {
  console.log('PASS: Correctly threw error for zero capacity');
}

try {
  cache.resize(3.14);
  console.log('ERROR: Should have thrown for non-integer capacity');
} catch (e) {
  console.log('PASS: Correctly threw error for non-integer capacity');
}

console.log('All resize tests completed successfully!');