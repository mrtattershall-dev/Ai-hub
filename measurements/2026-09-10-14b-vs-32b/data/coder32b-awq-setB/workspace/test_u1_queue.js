const assert = require('assert');
const Queue = require('./u1_queue.js');

// Test enqueue and size
const queue = new Queue();
queue.enqueue(1);
queue.enqueue(2);
assert.strictEqual(queue.size(), 2, 'Queue size should be 2 after enqueuing two items');

// Test dequeue
assert.strictEqual(queue.dequeue(), 1, 'Dequeue should return the first item enqueued');
assert.strictEqual(queue.size(), 1, 'Queue size should be 1 after dequeuing one item');

// Test dequeue on empty queue
try {
    queue.dequeue();
} catch (error) {
    assert.strictEqual(error.message, 'Queue is empty', 'Dequeue on empty queue should throw "Queue is empty"');
}

// Test enqueue again
queue.enqueue(3);
assert.strictEqual(queue.dequeue(), 3, 'Dequeue should return the last item enqueued');
assert.strictEqual(queue.size(), 0, 'Queue size should be 0 after dequeuing the last item');

console.log('All tests passed!');
try {
    queue.dequeue();
    assert.fail("Expected an error to be thrown");
} catch (error) {
    assert.strictEqual(error.message, "Queue is empty");
}
