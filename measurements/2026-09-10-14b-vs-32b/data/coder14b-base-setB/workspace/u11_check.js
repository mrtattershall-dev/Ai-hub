const assert = require('assert');
const Queue = require('./u1_queue.js');
const { flatten } = require('./u4_flatten.js');

// Test for u1_queue.js
describe('Queue', function() {
  it('should enqueue and dequeue elements correctly', function() {
    const queue = new Queue();
    queue.enqueue(1);
    queue.enqueue(2);
    assert.strictEqual(queue.dequeue(), 1);
    assert.strictEqual(queue.dequeue(), 2);
  });

  it('should return undefined when dequeueing from an empty queue', function() {
    const queue = new Queue();
    assert.strictEqual(queue.dequeue(), undefined);
  });
});

// Test for u4_flatten.js
describe('flatten', function() {
  it('should flatten a simple object', function() {
    const input = { a: [1, 2] };
    const expectedOutput = { a0: 1, a1: 2 };
    assert.deepStrictEqual(flatten(input), expectedOutput);
  });

  it('should handle nested objects', function() {
    const input = { a: { b: [1, 2], c: 3 } };
    const expectedOutput = { a_b0: 1, a_b1: 2, a_c: 3 };
    assert.deepStrictEqual(flatten(input), expectedOutput);
  });

  it('should handle arrays of objects', function() {
    const input = [{ a: 1 }, { b: 2 }];
    const expectedOutput = { '0_a': 1, '1_b': 2 };
    assert.deepStrictEqual(flatten(input), expectedOutput);
  });

  it('should handle empty objects and arrays', function() {
    const input = { a: [], b: {} };
    const expectedOutput = {};
    assert.deepStrictEqual(flatten(input), expectedOutput);
  });
});