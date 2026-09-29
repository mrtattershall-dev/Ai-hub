const assert = require('assert');
const EventBus = require('./s3_events.js');

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