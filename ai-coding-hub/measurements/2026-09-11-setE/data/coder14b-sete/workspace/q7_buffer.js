class TextBuffer {
  constructor(text = '', options = {}) {
    this.text = text;
    this.history = [];
    this.redoStack = [];
    this.maxUndo = options.maxUndo || Infinity;
  }

  text() {
    return this.text;
  }

  text() {
    return this.text;
  }

  text() {
    return this.text;
  }

  insert(pos, str) {
    if (pos < 0 || pos > this.text.length) {
      throw new Error('Position out of bounds');
    }
    this.text = this.text.slice(0, pos) + str + this.text.slice(pos);
    this.history.push(this.text);
    if (this.history.length > this.maxUndo) {
      this.history.shift();
    }
    this.redoStack = [];
  }

  remove(pos, length) {
    if (pos < 0 || pos + length > this.text.length) {
      throw new Error('Position out of bounds');
    }
    this.text = this.text.slice(0, pos) + this.text.slice(pos + length);
    this.history.push(this.text);
    if (this.history.length > this.maxUndo) {
      this.history.shift();
    }
    this.redoStack = [];
  }

  stats() {
    const chars = this.text.length;
    const words = this.text.match(/\b\w+\b/g) ? this.text.match(/\b\w+\b/g).length : 0;
    const lines = this.text.split('\n').length;
    return { chars, words, lines };
  }
}

module.exports = TextBuffer;
const assert = require('assert');

// Test constructor
const buffer = new TextBuffer('Hello, world!');
assert.strictEqual(buffer.text(), 'Hello, world!');

// Test insert
buffer.insert(5, ' beautiful ');
assert.strictEqual(buffer.text(), 'Hello beautiful world!');

// Test remove
buffer.remove(5, 9);
assert.strictEqual(buffer.text(), 'Hello world!');

// Test insert at start
buffer.insert(0, 'Start ');
assert.strictEqual(buffer.text(), 'Start Hello world!');

// Test insert at end
buffer.insert(buffer.text().length, ' End');
assert.strictEqual(buffer.text(), 'Start Hello world! End');

// Test remove from start
buffer.remove(0, 6);
assert.strictEqual(buffer.text(), 'Hello world! End');

// Test remove from end
buffer.remove(buffer.text().length - 4, 4);
assert.strictEqual(buffer.text(), 'Hello world!');

// Test insert out of bounds
try {
  buffer.insert(-1, 'Test');
  assert.fail('Expected error');
} catch (e) {
  assert.strictEqual(e.message, 'Position out of bounds');
}

// Test remove out of bounds
try {
  buffer.remove(100, 5);
  assert.fail('Expected error');
} catch (e) {
  assert.strictEqual(e.message, 'Position out of bounds');
}

console.log('All tests passed!');
