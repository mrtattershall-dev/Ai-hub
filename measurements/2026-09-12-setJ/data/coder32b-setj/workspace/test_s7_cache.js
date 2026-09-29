const assert = require('assert');
const Cache = require('./s7_cache.js');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

// Test constructor
try {
  new Cache(-1);
} catch (e) {
  assert(e.message === 'Capacity must be a positive integer', 'Constructor should throw for non-positive capacity');
}

try {
  new Cache(0);
} catch (e) {
  assert(e.message === 'Capacity must be a positive integer', 'Constructor should throw for zero capacity');
}

try {
  new Cache(1.5);
} catch (e) {
  assert(e.message === 'Capacity must be a positive integer', 'Constructor should throw for non-integer capacity');
}

const cache = new Cache(3);

// Test set and get
cache.set('a', 1);
cache.set('b', 2);
cache.set('c', 3);
assert(cache.get('a') === 1, 'Cache should return correct value for key "a"');
assert(cache.get('b') === 2, 'Cache should return correct value for key "b"');
assert(cache.get('c') === 3, 'Cache should return correct value for key "c"');

// Test has
assert(cache.has('a'), 'Cache should have key "a"');
assert(cache.has('b'), 'Cache should have key "b"');
assert(cache.has('c'), 'Cache should have key "c"');
assert(!cache.has('d'), 'Cache should not have key "d"');

// Test size
assert(cache.size() === 3, 'Cache size should be 3');

// Test eviction
cache.set('d', 4);
assert(cache.get('a') === undefined, 'Cache should evict least recently used key "a"');
assert(cache.get('b') === 2, 'Cache should still have key "b"');
assert(cache.get('c') === 3, 'Cache should still have key "c"');
assert(cache.get('d') === 4, 'Cache should have new key "d"');
assert(cache.size() === 3, 'Cache size should still be 3');

console.log('All tests passed');