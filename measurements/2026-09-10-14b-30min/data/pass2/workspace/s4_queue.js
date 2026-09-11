class PriorityQueue {
  constructor() {
    this.items = [];
  }

  push(item, priority) {
    this.items.push({ item, priority });
    this.items.sort((a, b) => a.priority - b.priority);
  }

  pop() {
    if (this.isEmpty()) {
      return null;
    }
    return this.items.shift().item;
  }

  isEmpty() {
    return this.items.length === 0;
  }

  size() {
    return this.items.length;
  }
}

module.exports = PriorityQueue;
const assert = require('assert');

// Test cases
const pq = new PriorityQueue();

pq.push('task1', 3);
pq.push('task2', 1);
pq.push('task3', 2);

assert.strictEqual(pq.pop(), 'task2', 'The item with the highest priority should be popped first');
assert.strictEqual(pq.pop(), 'task3', 'The next item with the highest priority should be popped');
assert.strictEqual(pq.pop(), 'task1', 'The last item with the highest priority should be popped');
assert.strictEqual(pq.pop(), null, 'Popping from an empty queue should return null');

console.log('All tests passed!');
// Test stability of pop() method
pq.push('task4', 2);
pq.push('task5', 2);
assert.strictEqual(pq.pop(), 'task4', 'The first item with equal priority should be popped first');
assert.strictEqual(pq.pop(), 'task5', 'The second item with equal priority should be popped second');
