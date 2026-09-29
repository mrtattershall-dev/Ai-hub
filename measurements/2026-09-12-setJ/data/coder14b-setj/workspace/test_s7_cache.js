const assert = require('assert');
const Cache = require('./s7_cache.js');

describe('Cache', function() {
  describe('#set', function() {
    it('should set a key-value pair', function() {
      const cache = new Cache(1);
      cache.set('key1', 'value1');
      assert.strictEqual(cache.get('key1'), 'value1');
    });
  });

  describe('#get', function() {
    it('should return undefined for a non-existent key', function() {
      const cache = new Cache(1);
      assert.strictEqual(cache.get('key1'), undefined);
    });
  });

  describe('#has', function() {
    it('should return false for a non-existent key', function() {
      const cache = new Cache(1);
      assert.strictEqual(cache.has('key1'), false);
    });
  });

  describe('#size', function() {
    it('should return the number of items in the cache', function() {
      const cache = new Cache(2);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      assert.strictEqual(cache.size(), 2);
    });
  });
});