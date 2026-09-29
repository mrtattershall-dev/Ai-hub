// Final test for Cache expiry functionality
const { Cache } = require('./s7_cache.js');

console.log("=== Testing Cache Expiry Functionality ===");

// Test 1: Basic functionality without expiry (should work as before)
console.log("\n1. Testing basic functionality without expiry:");
const cache1 = new Cache(3);
cache1.set("a", 1);
cache1.set("b", 2);
cache1.set("c", 3);

console.log("Size:", cache1.size());
console.log("Has 'a':", cache1.has("a"));
console.log("Get 'a':", cache1.get("a"));
console.log("Keys:", cache1.keys());

// Test 2: Basic expiry functionality
console.log("\n2. Testing basic expiry:");
const cache2 = new Cache(3, { ttl: 100 }); // 100ms TTL

cache2.set("x", 10);
cache2.set("y", 20);
cache2.set("z", 30);

console.log("Initial size:", cache2.size());
console.log("Has 'x':", cache2.has("x"));
console.log("Get 'x':", cache2.get("x"));

// Wait for expiry
setTimeout(() => {
  console.log("\nAfter 150ms (should expire):");
  console.log("Size:", cache2.size());
  console.log("Has 'x':", cache2.has("x"));
  console.log("Get 'x':", cache2.get("x"));
  console.log("Has 'y':", cache2.has("y"));
  console.log("Get 'y':", cache2.get("y"));
  
  // Test 3: Per-entry TTL override
  console.log("\n3. Testing per-entry TTL override:");
  const cache3 = new Cache(3, { ttl: 1000 }); // 1s default
  
  cache3.set("p", 100, { ttl: 50 });  // 50ms TTL
  cache3.set("q", 200);              // 1s TTL (default)
  cache3.set("r", 300);              // 1s TTL (default)
  
  console.log("Initial size:", cache3.size());
  console.log("Get 'p':", cache3.get("p"));
  console.log("Get 'q':", cache3.get("q"));
  console.log("Get 'r':", cache3.get("r"));
  
  // Wait for 'p' to expire
  setTimeout(() => {
    console.log("\nAfter 'p' expires (50ms):");
    console.log("Size:", cache3.size());
    console.log("Get 'p':", cache3.get("p"));
    console.log("Get 'q':", cache3.get("q"));
    console.log("Get 'r':", cache3.get("r"));
    
    // Test 4: Peek with expiry
    console.log("\n4. Testing peek with expiry:");
    const cache4 = new Cache(2, { ttl: 100 });
    
    cache4.set("peek1", 1000);
    console.log("Peek 'peek1':", cache4.peek("peek1"));
    
    setTimeout(() => {
      console.log("\nAfter 'peek1' expires:");
      console.log("Peek 'peek1':", cache4.peek("peek1"));
      console.log("Size:", cache4.size());
      
      // Test 5: Size method with expired entries
      console.log("\n5. Testing size with expired entries:");
      const cache5 = new Cache(3, { ttl: 50 });
      
      cache5.set("s1", 1);
      cache5.set("s2", 2);
      cache5.set("s3", 3);
      
      console.log("Before expiry - Size:", cache5.size());
      
      setTimeout(() => {
        console.log("After expiry - Size:", cache5.size());
        
        console.log("\n=== All tests completed ===");
      }, 70);
    }, 120);
  }, 120);
}, 120);