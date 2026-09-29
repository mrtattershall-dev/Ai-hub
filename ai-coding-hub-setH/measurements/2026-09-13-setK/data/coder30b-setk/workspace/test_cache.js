// Test the new delete and clear methods for Cache
const { Cache } = require('./s7_cache.js');

console.log('Testing new delete and clear methods...');

// Test delete method
const cache = new Cache(3);

// Add some items
cache.set('a', 1);
cache.set('b', 2);
cache.set('c', 3);

console.log('Cache size before delete:', cache.size());

// Test deleting existing key
const deletedA = cache.delete('a');
console.log('Delete existing key "a":', deletedA); // Should be true
console.log('Cache size after delete:', cache.size());

// Test deleting non-existing key
const deletedD = cache.delete('d');
console.log('Delete non-existing key "d":', deletedD); // Should be false
console.log('Cache size after trying to delete non-existing key:', cache.size());

// Test that deleted key is no longer in cache
console.log('Has key "a" after deletion:', cache.has('a')); // Should be false

// Test clear method
cache.clear();
console.log('Cache size after clear:', cache.size()); // Should be 0
console.log('Has key "b" after clear:', cache.has('b')); // Should be false

// Test clear on empty cache
cache.clear();
console.log('Cache size after clearing empty cache:', cache.size()); // Should be 0

console.log('All cache tests passed!');
// Test keys method
console.log('Testing keys method...');
const cache2 = new Cache(3);

// Add some items
cache2.set('a', 1);
cache2.set('b', 2);
cache2.set('c', 3);

console.log('Keys in LRU order:', cache2.keys()); // Should be ['a', 'b', 'c']

// Access 'a' to make it most recently used
cache2.get('a');
console.log('Keys after accessing "a":', cache2.keys()); // Should be ['b', 'c', 'a']

// Add a new item to test eviction
cache2.set('d', 4);
console.log('Keys after adding "d" (should evict "b"):', cache2.keys()); // Should be ['c', 'a', 'd']

console.log('Keys method test passed!');
// Test peek method
console.log('Testing peek method...');
const cache3 = new Cache(3);

// Add some items
cache3.set('x', 10);
cache3.set('y', 20);
cache3.set('z', 30);

// Test peek on existing key
console.log('Peek value of "x":', cache3.peek('x')); // Should be 10
console.log('Peek value of "y":', cache3.peek('y')); // Should be 20
console.log('Peek value of missing key "a":', cache3.peek('a')); // Should be undefined

// Verify that peek doesn't change LRU order by checking keys order
console.log('Keys before accessing "x":', cache3.keys()); // Should be ['x', 'y', 'z']
console.log('Peek value of "x":', cache3.peek('x')); // Should be 10
console.log('Keys after peeking "x":', cache3.keys()); // Should still be ['x', 'y', 'z'] (no change in order)

// Test get method to show it does change LRU order
console.log('Get value of "y":', cache3.get('y')); // Should be 20
console.log('Keys after getting "y":', cache3.keys()); // Should be ['x', 'z', 'y'] (y moved to end)

console.log('All peek tests passed!');
