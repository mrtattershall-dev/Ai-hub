class Stack {
  constructor() {
    this.items = [];
  }

  push(item) {
    this.items.push(item);
  }

  pop() {
    if (this.isEmpty()) {
      return null;
    }
    return this.items.pop();
  }

  peek() {
    if (this.isEmpty()) {
      return null;
    }
    return this.items[this.items.length - 1];
  }

  size() {
    return this.items.length;
  }

  isEmpty() {
    return this.items.length === 0;
  }
}

module.exports = Stack;
const assert = require('assert');

// Test cases
const stack = new Stack();

stack.push('item1');
assert.strictEqual(stack.peek(), 'item1', 'The top item should be "item1"');
assert.strictEqual(stack.size(), 1, 'The stack size should be 1');

stack.push('item2');
assert.strictEqual(stack.peek(), 'item2', 'The top item should be "item2"');
assert.strictEqual(stack.size(), 2, 'The stack size should be 2');

assert.strictEqual(stack.pop(), 'item2', 'The popped item should be "item2"');
assert.strictEqual(stack.peek(), 'item1', 'The top item should be "item1"');
assert.strictEqual(stack.size(), 1, 'The stack size should be 1');

assert.strictEqual(stack.pop(), 'item1', 'The popped item should be "item1"');
assert.strictEqual(stack.peek(), null, 'The top item should be null');
assert.strictEqual(stack.size(), 0, 'The stack size should be 0');

assert.strictEqual(stack.pop(), null, 'Popping from an empty stack should return null');
assert.strictEqual(stack.peek(), null, 'The top item should be null');
assert.strictEqual(stack.size(), 0, 'The stack size should be 0');

console.log('All tests passed!');
