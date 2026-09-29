const { Cache } = require('./s7_cache.js');

// Test the peek method
const cache = new Cache(3);

// Add some items
cache.set('a', 1);
cache.set('b', 2);
cache.set('c', 3);

console.log('Initial cache state:');
console.log('get(a):', cache.get('a')); // Should return 1 and mark as recently used
console.log('peek(a):', cache.peek('a')); // Should return 1 but not mark as recently used
console.log('peek(b):', cache.peek('b')); // Should return 2 but not mark as recently used

// Add another item to trigger eviction
cache.set('d', 4); // This should evict 'b' since 'a' was recently used

console.log('After adding d (should evict b):');
console.log('get(a):', cache.get('a')); // Should return 1
console.log('get(b):', cache.peek('b')); // Should return undefined since it was evicted
console.log('peek(c):', cache.peek('c')); // Should return 3

console.log('Cache keys:', cache.keys());

// Test stats method
console.log('Cache stats:', cache.stats());