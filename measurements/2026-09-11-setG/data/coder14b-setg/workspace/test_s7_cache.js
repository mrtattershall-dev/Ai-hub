const assert = require('assert');
const Cache = require('./s7_cache.js');

describe('Cache', function() {
  describe('constructor', function() {
    it('should throw an error for non-positive integer capacity', function() {
      assert.throws(() => new Cache(0), Error);
      assert.throws(() => new Cache(-1), Error);
      assert.throws(() => new Cache(1.5), Error);
      assert.throws(() => new Cache('5'), Error);
    });

    it('should initialize with a positive integer capacity', function() {
      const cache = new Cache(5);
      assert.strictEqual(cache.capacity, 5);
      assert.strictEqual(cache.cache.size, 0);
      assert.strictEqual(cache.usageOrder.length, 0);
    });
  });

  describe('set', function() {
    it('should set a new key-value pair', function() {
      const cache = new Cache(5);
      cache.set('key1', 'value1');
      assert.strictEqual(cache.cache.get('key1'), 'value1');
      assert.strictEqual(cache.usageOrder[0], 'key1');
    });

    it('should update an existing key-value pair', function() {
      const cache = new Cache(5);
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      assert.strictEqual(cache.cache.get('key1'), 'value2');
      assert.strictEqual(cache.usageOrder[0], 'key1');
    });

    it('should evict the least recently used entry when full', function() {
      const cache = new Cache(2);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      assert.strictEqual(cache.cache.has('key1'), false);
      assert.strictEqual(cache.cache.get('key2'), 'value2');
      assert.strictEqual(cache.cache.get('key3'), 'value3');
    });
  });

  describe('get', function() {
    it('should return the value for an existing key', function() {
      const cache = new Cache(5);
      cache.set('key1', 'value1');
      assert.strictEqual(cache.get('key1'), 'value1');
    });

    it('should return undefined for a non-existing key', function() {
      const cache = new Cache(5);
      assert.strictEqual(cache.get('key1'), undefined);
    });

    it('should update the usage order when getting a key', function() {
      const cache = new Cache(3);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.get('key2');
      cache.set('key4', 'value4');
      assert.strictEqual(cache.cache.has('key1'), false);
      assert.strictEqual(cache.cache.get('key2'), 'value2');
      assert.strictEqual(cache.cache.get('key3'), 'value3');
      assert.strictEqual(cache.cache.get('key4'), 'value4');
    });
  });

  describe('has', function() {
    it('should return true for an existing key', function() {
      const cache = new Cache(5);
      cache.set('key1', 'value1');
      assert.strictEqual(cache.has('key1'), true);
    });

    it('should return false for a non-existing key', function() {
      const cache = new Cache(5);
      assert.strictEqual(cache.has('key1'), false);
    });
  });

  describe('size', function() {
    it('should return the number of entries in the cache', function() {
      const cache = new Cache(5);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      assert.strictEqual(cache.size(), 2);
    });
  });
});