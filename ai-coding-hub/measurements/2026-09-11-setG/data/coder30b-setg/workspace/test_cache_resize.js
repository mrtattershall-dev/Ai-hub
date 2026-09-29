// Test the Cache resize functionality
const { Cache } = require('./s7_cache.js');

console.log("Testing Cache resize functionality...");

// Test 1: Basic resize functionality
console.log("\n1. Testing basic resize functionality:");
const cache1 = new Cache(3);
cache1.set('a', 1);
cache1.set('b', 2);
cache1.set('c', 3);
console.log("Initial size:", cache1.size());
console.log("Keys before resize:", cache1.keys());

// Resize to smaller capacity
cache1.resize(2);
console.log("Size after resizing to 2:", cache1.size());
console.log("Keys after resize:", cache1.keys());

// Test 2: Resize to larger capacity
console.log("\n2. Testing resize to larger capacity:");
const cache2 = new Cache(2);
cache2.set('x', 10);
cache2.set('y', 20);
console.log("Size before resize:", cache2.size());
console.log("Keys before resize:", cache2.keys());

cache2.resize(5);
console.log("Size after resizing to 5:", cache2.size());
console.log("Keys after resize:", cache2.keys());

// Test 3: Resize with eviction
console.log("\n3. Testing resize with eviction:");
const cache3 = new Cache(4);
cache3.set('a', 1);
cache3.set('b', 2);
cache3.set('c', 3);
cache3.set('d', 4);
console.log("Before resize (size:", cache3.size(), "):", cache3.keys());

// Access 'a' to make it recently used
cache3.get('a');
console.log("After accessing 'a', keys:", cache3.keys());

// Resize to capacity 2 - should evict least recently used ('b' and 'c')
cache3.resize(2);
console.log("After resizing to 2 (size:", cache3.size(), "):", cache3.keys());
console.log("Should have 'a' and 'd' (recently used), evicted 'b' and 'c'");

// Test 4: Error handling - invalid capacity
console.log("\n4. Testing error handling:");
try {
    const cache4 = new Cache(3);
    cache4.resize(-1);
    console.log("ERROR: Should have thrown an error for negative capacity");
} catch (e) {
    console.log("Correctly threw error for negative capacity:", e.message);
}

try {
    const cache5 = new Cache(3);
    cache5.resize(0);
    console.log("ERROR: Should have thrown an error for zero capacity");
} catch (e) {
    console.log("Correctly threw error for zero capacity:", e.message);
}

try {
    const cache6 = new Cache(3);
    cache6.resize(3.5);
    console.log("ERROR: Should have thrown an error for non-integer capacity");
} catch (e) {
    console.log("Correctly threw error for non-integer capacity:", e.message);
}

try {
    const cache7 = new Cache(3);
    cache7.resize("invalid");
    console.log("ERROR: Should have thrown an error for string capacity");
} catch (e) {
    console.log("Correctly threw error for string capacity:", e.message);
}

console.log("\nAll resize tests completed!");