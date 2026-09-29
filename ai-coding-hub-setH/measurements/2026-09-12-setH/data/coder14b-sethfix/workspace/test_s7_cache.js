const assert = require('assert');
const Cache = require('./s7_cache.js');

describe('Cache', function() {
  describe('constructor', function() {
    it('should throw an error if capacity is not a positive integer', function() {
      assert.throws(() => new Cache(-1), Error);
      assert.throws(() => new Cache(0), Error);
      assert.throws(() => new Cache(1.5), Error);
      assert.throws(() => new Cache('1'), Error);
    });

    it('should initialize with the given capacity', function() {
      const cache = new Cache(5);
      assert.strictEqual(cache.capacity, 5);
      assert.strictEqual(cache.size(), 0);
    });
  });

  describe('set', function() {
    it('should add a key-value pair to the cache', function() {
      const cache = new Cache(5);
      cache.set('key1', 'value1');
      assert.strictEqual(cache.get('key1'), 'value1');
      assert.strictEqual(cache.size(), 1);
    });

    it('should evict the least recently used item when full', function() {
      const cache = new Cache(2);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      assert.strictEqual(cache.get('key1'), undefined);
      assert.strictEqual(cache.get('key2'), 'value2');
      assert.strictEqual(cache.get('key3'), 'value3');
      assert.strictEqual(cache.size(), 2);
    });
  });

  describe('get', function() {
    it('should return the value for a given key', function() {
      const cache = new Cache(5);
      cache.set('key1', 'value1');
      assert.strictEqual(cache.get('key1'), 'value1');
    });

    it('should return undefined for a missing key', function() {
      const cache = new Cache(5);
      assert.strictEqual(cache.get('key1'), undefined);
    });

    it('should update the recency of a key', function() {
      const cache = new Cache(3);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.get('key1');
      cache.set('key4', 'value4');
      assert.strictEqual(cache.get('key2'), undefined);
      assert.strictEqual(cache.get('key1'), 'value1');
      assert.strictEqual(cache.get('key3'), 'value3');
      assert.strictEqual(cache.get('key4'), 'value4');
      assert.strictEqual(cache.size(), 3);
    });
  });

  describe('has', function() {
    it('should return true if the key exists in the cache', function() {
      const cache = new Cache(5);
      cache.set('key1', 'value1');
      assert.strictEqual(cache.has('key1'), true);
    });

    it('should return false if the key does not exist in the cache', function() {
      const cache = new Cache(5);
      assert.strictEqual(cache.has('key1'), false);
    });
  });

  describe('size', function() {
    it('should return the number of items in the cache', function() {
      const cache = new Cache(5);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      assert.strictEqual(cache.size(), 2);
    });
  });
});