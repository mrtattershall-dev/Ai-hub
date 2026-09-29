const LRUCache = require('./s5_cache');
const { expect } = require('chai');

describe('LRUCache', () => {
  it('should throw an error if capacity is not a positive integer', () => {
    expect(() => new LRUCache(-1)).to.throw('Capacity must be a positive integer');
    expect(() => new LRUCache(0)).to.throw('Capacity must be a positive integer');
    expect(() => new LRUCache(1.5)).to.throw('Capacity must be a positive integer');
    expect(() => new LRUCache('10')).to.throw('Capacity must be a positive integer');
  });

  it('should throw an error if ttlMs is given but not a positive integer', () => {
    const cache = new LRUCache(10);
    expect(() => cache.set('key', 'value', -1)).to.throw('ttlMs must be a positive integer');
    expect(() => cache.set('key', 'value', 0)).to.throw('ttlMs must be a positive integer');
    expect(() => cache.set('key', 'value', 1.5)).to.throw('ttlMs must be a positive integer');
    expect(() => cache.set('key', 'value', '10')).to.throw('ttlMs must be a positive integer');
  });
});