class Stack {
  constructor() {
    this.items = [];
  }

  push(item) {
    this.items.push(item);
  }

  pop() {
    if (this.isEmpty()) {
      throw new Error("Stack is empty");
    }
    return this.items.pop();
  }

  peek() {
    if (this.isEmpty()) {
      throw new Error("Stack is empty");
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

// Test push
let stack = new Stack();
stack.push(1);
assert.strictEqual(stack.size(), 1);
assert.strictEqual(stack.peek(), 1);

// Test pop
stack.push(2);
assert.strictEqual(stack.pop(), 2);
assert.strictEqual(stack.size(), 1);

// Test peek
assert.strictEqual(stack.peek(), 1);

// Test size
assert.strictEqual(stack.size(), 1);

// Test isEmpty
assert.strictEqual(stack.isEmpty(), false);
stack.pop();
assert.strictEqual(stack.isEmpty(), true);

// Test pop on empty stack
try {
  stack.pop();
  assert.fail("Expected an error to be thrown");
} catch (e) {
  assert.strictEqual(e.message, "Stack is empty");
}

// Test peek on empty stack
try {
  stack.peek();
  assert.fail("Expected an error to be thrown");
} catch (e) {
  assert.strictEqual(e.message, "Stack is empty");
}

console.log("All tests passed!");
