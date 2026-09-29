const { Cache } = require('./s7_cache.js');

// Test basic functionality
console.log("Testing Cache class...");

// Test 1: Constructor with invalid capacity
try {
  new Cache(0);
  console.log("FAIL: Should have thrown error for capacity 0");
} catch (e) {
  console.log("PASS: Constructor rejects capacity 0");
}

try {
  new Cache(-1);
  console.log("FAIL: Should have thrown error for negative capacity");
} catch (e) {
  console.log("PASS: Constructor rejects negative capacity");
}

try {
  new Cache(3.14);
  console.log("FAIL: Should have thrown error for non-integer capacity");
} catch (e) {
  console.log("PASS: Constructor rejects non-integer capacity");
}

try {
  const cache = new Cache(2);
  console.log("PASS: Constructor accepts valid capacity");
} catch (e) {
  console.log("FAIL: Constructor should accept valid capacity");
}

// Test 2: Basic set and get
const cache = new Cache(2);
cache.set('a', 1);
cache.set('b', 2);

if (cache.get('a') === 1) {
  console.log("PASS: Basic get works");
} else {
  console.log("FAIL: Basic get failed");
}

if (cache.get('b') === 2) {
  console.log("PASS: Basic get works for second item");
} else {
  console.log("FAIL: Basic get failed for second item");
}

// Test 3: Size tracking
if (cache.size() === 2) {
  console.log("PASS: Size tracking works");
} else {
  console.log("FAIL: Size tracking failed");
}

// Test 4: Has method
if (cache.has('a') && cache.has('b')) {
  console.log("PASS: Has method works");
} else {
  console.log("FAIL: Has method failed");
}

// Test 5: LRU eviction
cache.set('c', 3); // This should evict 'a' since it's least recently used

if (cache.get('a') === undefined) {
  console.log("PASS: LRU eviction works - old item evicted");
} else {
  console.log("FAIL: LRU eviction failed - old item not evicted");
}

if (cache.get('b') === 2 && cache.get('c') === 3) {
  console.log("PASS: LRU eviction preserves recent items");
} else {
  console.log("FAIL: LRU eviction corrupted recent items");
}

// Test 6: Update existing key (should move to end)
cache.set('b', 20); // Update 'b'
const bValue = cache.get('b'); // Access 'b' to mark as recently used

if (bValue === 20) {
  console.log("PASS: Updating existing key works");
} else {
  console.log("FAIL: Updating existing key failed");
}

// Test 7: LRU with updates
cache.set('d', 4); // Should evict 'c' (least recently used)
if (cache.get('c') === undefined) {
  console.log("PASS: LRU eviction works with updates");
} else {
  console.log("FAIL: LRU eviction failed with updates");
}

if (cache.get('d') === 4 && cache.get('b') === 20) {
  console.log("PASS: LRU preserves correct items after updates");
} else {
  console.log("FAIL: LRU corrupted items after updates");
}

// Test 3: parse_log and bad_lines functions
const { parse_line } = require('./s2_logs.py');

// Test parse_log with valid and invalid lines
const test_log = `
127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045
invalid line here
192.168.1.1 - - [15/Oct/2023:14:30:45 +0000] "POST /api/data HTTP/1.1" 201 - 0.123
another invalid line
  `;

// Test parse_log
try {
  const parsed = parse_log(test_log);
  if (parsed.length === 2 && parsed[0].ip === '127.0.0.1' && parsed[1].ip === '192.168.1.1') {
    console.log("PASS: parse_log correctly parses valid lines and skips invalid ones");
  } else {
    console.log("FAIL: parse_log did not parse correctly");
  }
} catch (e) {
  console.log("FAIL: parse_log threw an error:", e.message);
}

// Test bad_lines
try {
  const bad = bad_lines(test_log);
  if (bad.length === 2 && bad[0] === 2 && bad[1] === 4) {
    console.log("PASS: bad_lines correctly identifies malformed line numbers");
  } else {
    console.log("FAIL: bad_lines did not identify correct line numbers");
  }
} catch (e) {
  console.log("FAIL: bad_lines threw an error:", e.message);
}

console.log("All tests completed");