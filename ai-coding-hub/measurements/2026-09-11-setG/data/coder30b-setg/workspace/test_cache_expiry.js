// Test file for Cache expiry functionality
const { Cache } = require('./s7_cache.js');

console.log("Testing Cache expiry functionality...");

// Test 1: Basic expiry
console.log("\n=== Test 1: Basic expiry ===");
const cache = new Cache(3, { ttl: 100 }); // 100ms TTL

cache.set("a", 1);
cache.set("b", 2);
cache.set("c", 3);

console.log("Initial size:", cache.size());
console.log("Has 'a':", cache.has("a"));
console.log("Get 'a':", cache.get("a"));

// Wait for expiry
setTimeout(() => {
  console.log("\nAfter expiry wait:");
  console.log("Size:", cache.size());
  console.log("Has 'a':", cache.has("a"));
  console.log("Get 'a':", cache.get("a"));
  
  // Test 2: Per-entry TTL override
  console.log("\n=== Test 2: Per-entry TTL override ===");
  const cache2 = new Cache(3, { ttl: 1000 }); // 1s default TTL
  
  cache2.set("x", 10, { ttl: 50 }); // 50ms TTL for this entry
  cache2.set("y", 20); // 1s TTL (default)
  cache2.set("z", 30); // 1s TTL (default)
  
  console.log("Initial size:", cache2.size());
  console.log("Get 'x':", cache2.get("x"));
  console.log("Get 'y':", cache2.get("y"));
  console.log("Get 'z':", cache2.get("z"));
  
  // Wait for 'x' to expire
  setTimeout(() => {
    console.log("\nAfter 'x' expiry:");
    console.log("Size:", cache2.size());
    console.log("Get 'x':", cache2.get("x"));
    console.log("Get 'y':", cache2.get("y"));
    console.log("Get 'z':", cache2.get("z"));
    
    // Wait for 'y' to expire
    setTimeout(() => {
      console.log("\nAfter 'y' expiry:");
      console.log("Size:", cache2.size());
      console.log("Get 'y':", cache2.get("y"));
      console.log("Get 'z':", cache2.get("z"));
      
      // Test 3: Peek with expiry
      console.log("\n=== Test 3: Peek with expiry ===");
      const cache3 = new Cache(3, { ttl: 100 });
      
      cache3.set("p", 100);
      console.log("Peek 'p':", cache3.peek("p"));
      
      // Wait for expiry
      setTimeout(() => {
        console.log("After 'p' expiry:");
        console.log("Peek 'p':", cache3.peek("p"));
        console.log("Size:", cache3.size());
        
        console.log("\nAll expiry tests completed!");
      }, 150);
    }, 1050);
  }, 1050);
}, 150);