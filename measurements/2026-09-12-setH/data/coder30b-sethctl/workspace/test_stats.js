const { Cache } = require('./s7_cache.js');

// Test the stats() method
const cache = new Cache(2);

// Initially all stats should be 0
console.log("Initial stats:", cache.stats());

// Add an item - should be a miss
cache.set('a', 1);
console.log("After setting 'a':", cache.stats());

// Get the item - should be a hit
console.log("Get 'a':", cache.get('a'));
console.log("After getting 'a':", cache.stats());

// Get a non-existent item - should be a miss
console.log("Get 'b':", cache.get('b'));
console.log("After getting 'b':", cache.stats());

// Add another item - should still be 2 items
cache.set('b', 2);
console.log("After setting 'b':", cache.stats());

// Add a third item - should evict 'a'
cache.set('c', 3);
console.log("After setting 'c' (should evict 'a'):", cache.stats());

// Try to get evicted item - should be a miss
console.log("Get 'a' (evicted):", cache.get('a'));
console.log("After getting evicted 'a':", cache.stats());

// Test expiration by creating a cache with short TTL
const cache2 = new Cache(2, { ttl: 100 });
cache2.set('expiring', 'value');
console.log("Before expiration:", cache2.stats());
setTimeout(() => {
  console.log("After expiration:", cache2.stats());
  console.log("Get expired item:", cache2.get('expiring'));
  console.log("After getting expired:", cache2.stats());
}, 150);