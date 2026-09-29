const assert = require('assert');
const Queue = require('./u1_queue.js').Queue;
const { flatten } = require('./u4_flatten.js');

// Test Queue class
describe('Queue', function() {
    it('should enqueue and dequeue correctly', function() {
        const queue = new Queue();
        queue.enqueue(1);
        queue.enqueue(2);
        assert.strictEqual(queue.dequeue(), 1);
        assert.strictEqual(queue.dequeue(), 2);
    });

    it('should return the correct size', function() {
        const queue = new Queue();
        queue.enqueue(1);
        queue.enqueue(2);
        assert.strictEqual(queue.size(), 2);
        queue.dequeue();
        assert.strictEqual(queue.size(), 1);
    });
});

// Test flatten function
describe('flatten', function() {
    it('should flatten a simple object', function() {
        const obj = { a: 1, b: 2 };
        const result = flatten(obj);
        assert.deepStrictEqual(result, { a: 1, b: 2 });
    });

    it('should flatten a nested object', function() {
        const obj = { a: { b: 2, c: { d: 4 } }, e: 5 };
        const result = flatten(obj);
        assert.deepStrictEqual(result, { 'a.b': 2, 'a.c.d': 4, e: 5 });
    });
});