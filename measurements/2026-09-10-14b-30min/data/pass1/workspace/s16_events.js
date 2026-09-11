class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }
off(event, listener) {
  if (this.events[event]) {
    console.log(`Before off: ${this.events[event].length} listeners`);
    this.events[event] = this.events[event].filter(l => l !== listener);
    console.log(`After off: ${this.events[event].length} listeners`);
    if (this.events[event].length === 0) {
      delete this.events[event];
    }
  }
}

  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach(listener => listener(...args));
    }
  }
}

module.exports = EventEmitter;
// const EventEmitter = require('./s16_events');

const assert = require('assert');

// Test on and emit
const emitter = new EventEmitter();
let called = false;
emitter.on('test', () => { called = true; });
emitter.emit('test');
assert.strictEqual(called, true, 'Listener should be called when emitting an event');

// Test off
called = false;
const listener = () => { called = true; };
emitter.on('test', listener);
emitter.off('test', listener);
emitter.emit('test');
assert.strictEqual(called, false, 'Listener should not be called after being removed');

// Test multiple listeners
let count = 0;
const listener1 = () => { count++; };
const listener2 = () => { count++; };
emitter.on('test', listener1);
emitter.on('test', listener2);
emitter.emit('test');
assert.strictEqual(count, 2, 'Both listeners should be called when emitting an event');

console.log('All tests passed!');
