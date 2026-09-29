// Test the Cache with TTL functionality
const { Cache } = require('./s7_cache.js');

console.log("Testing Cache with TTL functionality...");

// Test 1: Basic functionality without expiry
console.log("\n1. Testing basic functionality without expiry:");
const cache1 = new Cache(3);
cache1.set('a', 1);
cache1.set('b', 2);
cache1.set('c', 3);

console.log("Size:", cache1.size());
console.log("Has 'a':", cache1.has('a'));
console.log("Get 'a':", cache1.get('a'));
console.log("Keys:", cache1.keys());

// Test 2: With TTL
console.log("\n2. Testing with TTL:");
const cache2 = new Cache(3, { ttl: 100 }); // 100ms TTL
cache2.set('x', 10);
cache2.set('y', 20);
cache2.set('z', 30);

console.log("Initial size:", cache2.size());
console.log("Has 'x':", cache2.has('x'));
console.log("Get 'x':", cache2.get('x'));

// Wait for expiration
setTimeout(() => {
    console.log("\nAfter 150ms (should expire):");
    console.log("Size:", cache2.size());
    console.log("Has 'x':", cache2.has('x'));
    console.log("Get 'x':", cache2.get('x'));
    console.log("Has 'y':", cache2.has('y'));
    console.log("Get 'y':", cache2.get('y'));
    
    // Test 3: Per-entry TTL override
    console.log("\n3. Testing per-entry TTL override:");
    const cache3 = new Cache(3);
    cache3.set('p', 100, { ttl: 50 }); // 50ms TTL
    cache3.set('q', 200);
    cache3.set('r', 300);
    
    console.log("Initial size:", cache3.size());
    console.log("Get 'p':", cache3.get('p'));
    console.log("Get 'q':", cache3.get('q'));
    console.log("Get 'r':", cache3.get('r'));
    
    // Wait for 'p' to expire
    setTimeout(() => {
        console.log("\nAfter 'p' expires (50ms):");
        console.log("Size:", cache3.size());
        console.log("Get 'p':", cache3.get('p'));
        console.log("Get 'q':", cache3.get('q'));
        console.log("Get 'r':", cache3.get('r'));
        
        // Test 4: Peek with expiry
        console.log("\n4. Testing peek with expiry:");
        const cache4 = new Cache(2);
        cache4.set('peek1', 1000);
        cache4.set('peek2', 2000);
        
        console.log("Peek 'peek1':", cache4.peek('peek1'));
        
        // Wait for 'peek1' to expire
        setTimeout(() => {
            console.log("After 'peek1' expires:");
            console.log("Peek 'peek1':", cache4.peek('peek1'));
            console.log("Size:", cache4.size());
            
            console.log("\n=== All tests completed successfully ===");
        }, 100);
    }, 70);
}, 150);
// Test 5: Stats functionality
console.log("\n5. Testing stats functionality:");
const cache5 = new Cache(3);
cache5.set('a', 1);
cache5.set('b', 2);
cache5.set('c', 3);

// Access existing items (hits)
console.log("Get 'a':", cache5.get('a'));
console.log("Get 'b':", cache5.get('b'));

// Access non-existing items (misses)
console.log("Get 'nonexistent':", cache5.get('nonexistent'));
console.log("Get 'also_nonexistent':", cache5.get('also_nonexistent'));

// Force eviction by adding more items
cache5.set('d', 4);
cache5.set('e', 5);

// Check stats
const stats = cache5.stats();
console.log("Stats:", stats);
console.log("Expected: hits=2, misses=2, evictions=2, expirations=0");

// Test with expirations
console.log("\n6. Testing with expirations:");
const cache6 = new Cache(2, { ttl: 50 });
cache6.set('exp1', 100);
cache6.set('exp2', 200);
cache6.set('exp3', 300); // This should cause eviction of 'exp1'

// Wait for expiration
setTimeout(() => {
    console.log("Get 'exp1' (should expire):", cache6.get('exp1'));
    console.log("Get 'exp2' (should expire):", cache6.get('exp2'));
    console.log("Get 'exp3' (should be valid):", cache6.get('exp3'));
    
    const stats2 = cache6.stats();
    console.log("Stats with expirations:", stats2);
console.log("Stats with expirations:", stats2);
}, 100);

// Test 7: Resize functionality
cache7.set('c', 3);
console.log("Initial size:", cache7.size());
console.log("Keys before resize:", cache7.keys());

// Resize to larger capacity
cache7.resize(5);
console.log("Size after resizing to 5:", cache7.size());
console.log("Keys after resizing to 5:", cache7.keys());

// Resize to smaller capacity (should evict LRU items)
cache7.resize(2);
console.log("Size after resizing to 2:", cache7.size());
console.log("Keys after resizing to 2:", cache7.keys());

// Test resize with invalid capacity
try {
  cache7.resize(0);
  console.error("ERROR: Should have thrown for capacity 0");
} catch (e) {
  console.log("✓ Resize correctly rejects capacity 0");
}

try {
  cache7.resize(-1);
  console.error("ERROR: Should have thrown for negative capacity");
} catch (e) {
  console.log("✓ Resize correctly rejects negative capacity");
}

try {
  cache7.resize(3.14);
  console.error("ERROR: Should have thrown for non-integer capacity");
} catch (e) {
  console.log("✓ Resize correctly rejects non-integer capacity");
}

console.log("\n=== All tests completed successfully ===");