// This file contains detailed tests for various components
// It's meant to be run with node.js

// Test the Cache functionality
const { Cache } = require('./s7_cache.js');

function runCacheTests() {
  console.log("Running Cache tests...");
  
  // Test 1: Constructor should reject invalid capacities
  try {
    new Cache(0);
    console.log("FAIL: Constructor should reject capacity 0");
  } catch (e) {
    console.log("PASS: Constructor rejects capacity 0");
  }
  
  try {
    new Cache(-1);
    console.log("FAIL: Constructor should reject negative capacity");
  } catch (e) {
    console.log("PASS: Constructor rejects negative capacity");
  }
  
  try {
    new Cache(3.14);
    console.log("FAIL: Constructor should reject non-integer capacity");
  } catch (e) {
    console.log("PASS: Constructor rejects non-integer capacity");
  }
  
  // Test 2: Basic functionality
  const cache = new Cache(2);
  cache.put("key1", "value1");
  cache.put("key2", "value2");
  
  if (cache.get("key1") === "value1") {
    console.log("PASS: Basic get works");
  } else {
    console.log("FAIL: Basic get failed");
  }
  
  // Test 3: Size tracking
  if (cache.size() === 2) {
    console.log("PASS: Size is correct");
  } else {
    console.log("FAIL: Size is incorrect");
  }
  
  // Test 4: LRU eviction
  cache.put("key3", "value3");
  if (cache.get("key1") === undefined) {
    console.log("PASS: Least recently used item was evicted");
  } else {
    console.log("FAIL: LRU eviction failed");
  }
  
  if (cache.get("key3") === "value3") {
    console.log("PASS: Most recently used item is still there");
  } else {
    console.log("FAIL: Most recently used item was evicted");
  }
  
  // Test 5: Updating existing key
  cache.put("key2", "updated_value");
  if (cache.get("key2") === "updated_value") {
    console.log("PASS: Updating existing key works");
  } else {
    console.log("FAIL: Updating existing key failed");
  }
  
  // Test 6: has() method
  if (cache.has("key2")) {
    console.log("PASS: has() method works");
  } else {
    console.log("FAIL: has() method failed");
  }
  
  if (!cache.has("nonexistent")) {
    console.log("PASS: has() method correctly identifies missing keys");
  } else {
    console.log("FAIL: has() method incorrectly identifies missing keys");
  }
  
  console.log("All tests completed");
}

// Run the tests
runCacheTests();