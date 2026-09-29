const { Cache } = require('./s7_cache.js');

console.log("Testing Cache delete() and clear() methods...");

// Test 1: Basic functionality
const cache = new Cache(3);

// Test set and get
cache.set("a", 1);
cache.set("b", 2);
cache.set("c", 3);

console.log("Initial cache size:", cache.size()); // Should be 3

// Test delete existing key
const deletedA = cache.delete("a");
console.log("Delete existing key 'a':", deletedA); // Should be true
console.log("Cache size after delete:", cache.size()); // Should be 2

// Test delete non-existing key
const deletedX = cache.delete("x");
console.log("Delete non-existing key 'x':", deletedX); // Should be false

// Test clear
cache.clear();
console.log("Cache size after clear:", cache.size()); // Should be 0

// Test that clear works correctly
cache.set("d", 4);
cache.set("e", 5);
console.log("Cache size after re-populating:", cache.size()); // Should be 2

// Test delete after clear
const deletedD = cache.delete("d");
console.log("Delete 'd' after clear:", deletedD); // Should be true

// Test clear again
cache.clear();
console.log("Cache size after second clear:", cache.size()); // Should be 0

// Test keys() method
console.log("Testing keys() method...");
const testCache = new Cache(3);
testCache.set("a", 1);
testCache.set("b", 2);
testCache.set("c", 3);
console.log("Keys in MRU order:", testCache.keys()); // Should be ["c", "b", "a"]

// Access "a" to make it most recent
testCache.get("a");
console.log("Keys after accessing 'a':", testCache.keys()); // Should be ["a", "c", "b"]

// Add a new item to test eviction
testCache.set("d", 4);
console.log("Keys after adding 'd' (should evict 'b'):", testCache.keys()); // Should be ["d", "a", "c"]

console.log("All tests completed!");
// Test peek method
console.log("Testing peek() method...");
const peekCache = new Cache(3);
peekCache.set("x", 10);
peekCache.set("y", 20);
peekCache.set("z", 30);

console.log("Value of 'x' via peek:", peekCache.peek("x")); // Should be 10
console.log("Value of 'y' via peek:", peekCache.peek("y")); // Should be 20
console.log("Value of 'nonexistent' via peek:", peekCache.peek("nonexistent")); // Should be undefined

// Verify that peek doesn't affect LRU order
console.log("Keys before accessing 'x':", peekCache.keys()); // Should be ["z", "y", "x"]
peekCache.peek("x");
console.log("Keys after peeking 'x':", peekCache.keys()); // Should still be ["z", "y", "x"] (no change)
console.log("Value of 'x' after peek:", peekCache.get("x")); // Should be 10
console.log("Keys after getting 'x':", peekCache.keys()); // Should be ["z", "y", "x"] (x moved to end)
