const { Cache } = require('./s7_cache.js');

function testDelete() {
  console.log("Testing delete method...");
  
  const cache = new Cache(2);
  cache.set('a', 1);
  cache.set('b', 2);
  
  // Test deleting existing key
  const result1 = cache.delete('a');
  if (result1 !== true) {
    console.error("FAIL: delete should return true when removing existing key");
    return false;
  }
  
  // Test that key is actually removed
  if (cache.has('a')) {
    console.error("FAIL: key should be removed from cache");
    return false;
  }
  
  // Test deleting non-existing key
  const result2 = cache.delete('nonexistent');
  if (result2 !== false) {
    console.error("FAIL: delete should return false when removing non-existing key");
    return false;
  }
  
  console.log("PASS: delete method works correctly");
  return true;
}

function testClear() {
  console.log("Testing clear method...");
  
  const cache = new Cache(3);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  
  // Verify cache has items
  if (cache.size() !== 3) {
    console.error("FAIL: cache should have 3 items before clear");
    return false;
  }
  
  // Clear the cache
  cache.clear();
  
  // Verify cache is empty
  if (cache.size() !== 0) {
    console.error("FAIL: cache should be empty after clear");
    return false;
  }
  
  // Verify all keys are removed
  if (cache.has('a') || cache.has('b') || cache.has('c')) {
    console.error("FAIL: all keys should be removed after clear");
    return false;
  }
  
  console.log("PASS: clear method works correctly");
  return true;
}

function testDeleteWithLRU() {
  console.log("Testing delete with LRU behavior...");
  
  const cache = new Cache(3);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  
  // Access 'a' to make it most recently used
  cache.get('a');
  
  // Delete 'b' (middle item)
  const result = cache.delete('b');
  if (result !== true) {
    console.error("FAIL: delete should return true for existing key");
    return false;
  }
  
  // Verify 'b' is removed but 'a' and 'c' still exist
  if (!cache.has('a') || !cache.has('c') || cache.has('b')) {
    console.error("FAIL: only 'b' should be removed");
    return false;
  }
  
  console.log("PASS: delete works correctly with LRU");
  return true;
}

function testKeys() {
  console.log("Testing keys method...");
  
  const cache = new Cache(3);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  
  // Test that keys are returned in insertion order (not LRU order)
  const keys = cache.keys();
  if (keys.length !== 3) {
    console.error("FAIL: keys should return 3 items");
    return false;
  }
  
  // Check order: a, b, c (insertion order)
  if (keys[0] !== 'a' || keys[1] !== 'b' || keys[2] !== 'c') {
    console.error("FAIL: keys should be in insertion order");
    return false;
  }
  
  // Access 'a' to make it most recently used (but Map order doesn't change)
  cache.get('a');
  
  // Test that order is still the same (Map maintains insertion order)
  const keys2 = cache.keys();
  if (keys2[0] !== 'a' || keys2[1] !== 'b' || keys2[2] !== 'c') {
    console.error("FAIL: keys order should not change with get operation (Map insertion order)");
    return false;
  }
  
  // Add a new item to test eviction
  cache.set('d', 4);
  
  // Test that old item was evicted and new order is correct
  const keys3 = cache.keys();
  if (keys3.length !== 3) {
    console.error("FAIL: keys should still return 3 items after eviction");
    return false;
  }
  
  // Should be: b, c, d (a was evicted because it was least recently used)
  if (keys3[0] !== 'b' || keys3[1] !== 'c' || keys3[2] !== 'd') {
    console.error("FAIL: keys should reflect eviction");
    return false;
  }
  
  console.log("PASS: keys method works correctly");
  return true;
}

function testPeek() {
  console.log("Testing peek method...");
  
  const cache = new Cache(3);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  
  // Test peek on existing key
  const value = cache.peek('b');
  if (value !== 2) {
    console.error("FAIL: peek should return the correct value");
    return false;
  }
  
  // Test that peek doesn't affect the cache state
  // The cache should still have the same keys and size
  if (cache.size() !== 3) {
    console.error("FAIL: cache size should not change after peek");
    return false;
  }
  
  if (!cache.has('a') || !cache.has('b') || !cache.has('c')) {
    console.error("FAIL: all keys should still be present after peek");
    return false;
  }
  
  // Test that peek returns undefined for non-existing key
  const value3 = cache.peek('nonexistent');
  if (value3 !== undefined) {
    console.error("FAIL: peek should return undefined for non-existing key");
    return false;
  }
  
  // Test that peek doesn't change the order (since Map maintains insertion order)
  const keysBefore = cache.keys();
  cache.peek('a');
  const keysAfter = cache.keys();
  
  if (keysBefore.length !== keysAfter.length) {
    console.error("FAIL: peek should not change the number of keys");
    return false;
  }
  
  for (let i = 0; i < keysBefore.length; i++) {
    if (keysBefore[i] !== keysAfter[i]) {
      console.error("FAIL: peek should not change key order");
      return false;
    }
  }
  
  // Test that peek doesn't affect LRU behavior (this is the key test)
  // Create a cache with capacity 2
  const cache2 = new Cache(2);
  cache2.set('a', 1);
  cache2.set('b', 2);
  cache2.set('c', 3); // This should evict 'a'
  
  // Check that 'a' is gone and 'b' and 'c' remain
  if (cache2.has('a')) {
    console.error("FAIL: 'a' should have been evicted");
    return false;
  }
  
  if (!cache2.has('b') || !cache2.has('c')) {
    console.error("FAIL: 'b' and 'c' should still be in cache");
    return false;
  }
  
  // Now peek at 'b' - should not affect eviction order
  const value2 = cache2.peek('b');
  if (value2 !== 2) {
    console.error("FAIL: peek should return correct value");
    return false;
  }
  
  // Add another item to test LRU behavior
  cache2.set('d', 4); // This should evict 'c' (least recently used)
  
  // Check that 'c' is gone and 'b' and 'd' remain
  if (cache2.has('c')) {
    console.error("FAIL: 'c' should have been evicted");
    return false;
  }
  
  if (!cache2.has('b') || !cache2.has('d')) {
    console.error("FAIL: 'b' and 'd' should still be in cache");
    return false;
  }
  
  console.log("PASS: peek method works correctly");
  return true;
}

// Run all tests
console.log("Running Cache tests...\n");

let allPassed = true;
allPassed &= testDelete();
allPassed &= testClear();
allPassed &= testDeleteWithLRU();
allPassed &= testKeys();
allPassed &= testPeek();

if (allPassed) {
  console.log("\nAll tests passed!");
} else {
  console.log("\nSome tests failed!");
  process.exit(1);
}
function testTTL() {
  console.log("Testing TTL functionality...");
  
  // Create a cache with 100ms TTL
  const cache = new Cache(3, { ttl: 100 });
  
  // Set some entries
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  
  // Verify they exist
  if (!cache.has('a') || !cache.has('b') || !cache.has('c')) {
    console.error("FAIL: All entries should exist initially");
    return false;
  }
  
  // Verify they can be retrieved
  if (cache.get('a') !== 1 || cache.get('b') !== 2 || cache.get('c') !== 3) {
    console.error("FAIL: All entries should be retrievable initially");
    return false;
  }
  
  // Wait for entries to expire
  // We'll use a custom now function to simulate time passing
  const startTime = Date.now();
  const mockNow = () => Date.now() - startTime;
  
  // Create a new cache with the same TTL but custom now function
  const cache2 = new Cache(3, { ttl: 100, now: mockNow });
  
  cache2.set('x', 100);
  cache2.set('y', 200);
  
  // Check that entries exist before expiration
  if (!cache2.has('x') || !cache2.has('y')) {
    console.error("FAIL: Entries should exist before expiration");
    return false;
  }
  
  // Simulate time passing by setting a large offset
  const oldNow = cache2.now;
  cache2.now = () => oldNow() + 150; // Advance time by 150ms
  
  // Check that entries are now expired
  if (cache2.has('x') || cache2.has('y')) {
    console.error("FAIL: Entries should be expired after TTL");
    return false;
  }
  
  // Check that get returns undefined for expired entries
  if (cache2.get('x') !== undefined || cache2.get('y') !== undefined) {
    console.error("FAIL: get should return undefined for expired entries");
    return false;
  }
  
  // Check that peek returns undefined for expired entries
  if (cache2.peek('x') !== undefined || cache2.peek('y') !== undefined) {
    console.error("FAIL: peek should return undefined for expired entries");
    return false;
  }
  
  // Check that size reflects expired entries
  if (cache2.size() !== 0) {
    console.error("FAIL: size should be 0 after expiration");
    return false;
  }
  
  // Check that keys returns empty array for expired entries
  if (cache2.keys().length !== 0) {
    console.error("FAIL: keys should be empty after expiration");
    return false;
  }
  
  // Test per-entry TTL override
  const cache3 = new Cache(3, { ttl: 200 });
  cache3.set('p', 1000, { ttl: 50 }); // Override TTL for this entry
  cache3.set('q', 2000); // Use default TTL
  
  // Wait for the first entry to expire
  const oldNow2 = cache3.now;
  cache3.now = () => oldNow2() + 75; // Advance time by 75ms
  
  // Entry with short TTL should be expired
  if (cache3.has('p')) {
    console.error("FAIL: Entry with short TTL should be expired");
    return false;
  }
  
  // Entry with default TTL should still exist
  if (!cache3.has('q')) {
    console.error("FAIL: Entry with default TTL should still exist");
    return false;
  }
  
  console.log("PASS: TTL functionality works correctly");
  return true;
}

// Run all tests
console.log("Running Cache tests...\n");

allPassed &= testDelete();
allPassed &= testClear();
allPassed &= testDeleteWithLRU();
allPassed &= testKeys();
allPassed &= testPeek();
allPassed &= testTTL();

if (allPassed) {
  console.log("\nAll tests passed!");
} else {
  console.log("\nSome tests failed!");
  process.exit(1);
}
