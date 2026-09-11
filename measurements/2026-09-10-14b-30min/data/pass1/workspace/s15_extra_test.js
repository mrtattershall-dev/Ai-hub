const assert = require('assert');
const Queue = require('./s4_queue.js');
const validate = require('./s9_validate.js');

// Test cases for s4_queue.js
describe('Queue', function() {
  it('should enqueue and dequeue correctly', function() {
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

  it('should return the correct size', function() {
    const queue = new Queue();
    queue.enqueue(1);
    queue.enqueue(2);
    assert.strictEqual(queue.size(), 2);
    queue.dequeue();
    assert.strictEqual(queue.size(), 1);
  });
});

// Test cases for s9_validate.js
describe('validate', function() {
  it('should validate a valid email', function() {
    assert.strictEqual(validate.email('test@example.com'), true);
  });

  it('should invalidate an invalid email', function() {
    assert.strictEqual(validate.email('invalid-email'), false);
  });

  it('should validate a valid URL', function() {
    assert.strictEqual(validate.url('https://example.com'), true);
  });

  it('should invalidate an invalid URL', function() {
    assert.strictEqual(validate.url('invalid-url'), false);
  });
});