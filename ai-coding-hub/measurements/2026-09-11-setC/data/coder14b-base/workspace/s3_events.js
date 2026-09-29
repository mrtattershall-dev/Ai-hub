class EventBus {
  constructor() {
    this.listeners = {};
  }

  listenerCount(event) {
    return this.listeners[event] ? this.listeners[event].length : 0;
  }

  on(event, fn) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(fn);
  }

  emit(event, ...args) {
    if (this.listeners[event]) {
      let error = null;
      this.listeners[event].forEach(fn => {
        try {
          fn(...args);
        } catch (e) {
          if (!error) {
            error = e;
          }
        }
      });
      if (error) {
        throw error;
      }
      return this.listeners[event].length;
    }
    return 0;
  }

  off(event, fn) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(fn);
      if (index !== -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }
}

module.exports = EventBus;
const assert = require('assert');

// Test cases
const eventBus = new EventBus();

// Test on method
eventBus.on('testEvent', (arg1, arg2) => {
  assert.strictEqual(arg1, 'Hello');
  assert.strictEqual(arg2, 'World');
});

// Test emit method
let emitCount = eventBus.emit('testEvent', 'Hello', 'World');
assert.strictEqual(emitCount, 1);

// Test multiple listeners
let listener1Called = false;
let listener2Called = false;

eventBus.on('multipleListeners', () => {
  listener1Called = true;
});

eventBus.on('multipleListeners', () => {
  listener2Called = true;
});

eventBus.emit('multipleListeners');
assert.strictEqual(listener1Called, true);
assert.strictEqual(listener2Called, true);

console.log('All tests passed!');
