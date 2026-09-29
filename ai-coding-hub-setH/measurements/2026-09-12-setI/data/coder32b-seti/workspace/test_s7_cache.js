const assert = require('assert');
const Cache = require('./s7_cache.js');

// Test Cache constructor
assert.throws(() => new Cache(-1), Error, 'Capacity must be a positive integer');
assert.throws(() => new Cache(0), Error, 'Capacity must be a positive integer');
assert.throws(() => new Cache(3.5), Error, 'Capacity must be a positive integer');
assert.throws(() => new Cache('5'), Error, 'Capacity must be a positive integer');
assert.doesNotThrow(() => new Cache(5), 'Should not throw for positive integer capacity');

// Test set and get methods
const cache = new Cache(3);
cache.set('key1', 'value1');
cache.set('key2', 'value2');
assert.strictEqual(cache.get('key1'), 'value1', 'Should get correct value for key1');
assert.strictEqual(cache.get('key2'), 'value2', 'Should get correct value for key2');
assert.strictEqual(cache.get('key3'), undefined, 'Should return undefined for missing key');

// Test has method
assert.strictEqual(cache.has('key1'), true, 'Should return true for existing key');
assert.strictEqual(cache.has('key3'), false, 'Should return false for missing key');

// Test size method
assert.strictEqual(cache.size(), 2, 'Should return correct size');

// Test LRU eviction
cache.set('key3', 'value3');
cache.set('key4', 'value4'); // Evicts key1
assert.strictEqual(cache.get('key1'), undefined, 'Should evict least recently used key1');
assert.strictEqual(cache.get('key2'), 'value2', 'Should retain key2');
assert.strictEqual(cache.get('key3'), 'value3', 'Should retain key3');
assert.strictEqual(cache.get('key4'), 'value4', 'Should retain key4');

// Test get and set as a use
cache.get('key2');
cache.set('key5', 'value5'); // Evicts key3
assert.strictEqual(cache.get('key3'), undefined, 'Should evict least recently used key3');
assert.strictEqual(cache.get('key2'), 'value2', 'Should retain key2');
assert.strictEqual(cache.get('key4'), 'value4', 'Should retain key4');
assert.strictEqual(cache.get('key5'), 'value5', 'Should retain key5');

console.log('All tests passed!');