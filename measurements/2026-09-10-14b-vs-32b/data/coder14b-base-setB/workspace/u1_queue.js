class Queue {
  constructor() {
    this.items = [];
  }

  enqueue(x) {
    this.items.push(x);
  }

  dequeue() {
    if (this.isEmpty()) {
      throw new Error("Queue is empty");
    }
    return this.items.shift();
  }

  size() {
    return this.items.length;
  }

  isEmpty() {
    return this.items.length === 0;
  }
}

module.exports = Queue;
const assert = require('assert');

// Test enqueue
let queue = new Queue();
queue.enqueue(1);
queue.enqueue(2);
assert.strictEqual(queue.size(), 2);

// Test dequeue
assert.strictEqual(queue.dequeue(), 1);
assert.strictEqual(queue.size(), 1);

// Test isEmpty
assert.strictEqual(queue.isEmpty(), false);
queue.dequeue();
assert.strictEqual(queue.isEmpty(), true);

// Test error on dequeue from empty queue
try {
  queue.dequeue();
  assert.fail("Expected an error to be thrown");
} catch (e) {
  assert.strictEqual(e.message, "Queue is empty");
}

console.log("All tests passed!");
