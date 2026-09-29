const EventBus = require('./s3_events');

// Create an event bus instance
const eventBus = new EventBus();

// Test 1: Basic emit with no listeners should return 0
let count = eventBus.emit('test');
console.assert(count === 0, 'emit with no listeners should return 0');

// Test 2: Add one listener and emit
let called = false;
eventBus.on('test', () => {
  called = true;
});
count = eventBus.emit('test');
console.assert(count === 1, 'emit with one listener should return 1');
console.assert(called === true, 'listener should have been called');

// Reset for next test
called = false;

// Test 3: Add multiple listeners and emit
let called2 = false;
eventBus.on('test', () => {
  called2 = true;
});
count = eventBus.emit('test');
console.assert(count === 2, 'emit with two listeners should return 2');
console.assert(called === true, 'first listener should have been called');
console.assert(called2 === true, 'second listener should have been called');

// Test 4: Test with arguments
let argsReceived = [];
eventBus.on('test2', (...args) => {
  argsReceived = args;
});
count = eventBus.emit('test2', 'hello', 42, {test: 'value'});
console.assert(count === 1, 'emit with one listener should return 1');
console.assert(argsReceived.length === 3, 'should receive 3 arguments');
console.assert(argsReceived[0] === 'hello', 'first argument should be "hello"');
console.assert(argsReceived[1] === 42, 'second argument should be 42');
console.assert(argsReceived[2].test === 'value', 'third argument should be the object');

// Test 5: Test different events don't interfere
let otherCalled = false;
eventBus.on('other', () => {
  otherCalled = true;
});
called = false; // Reset the flag
eventBus.emit('test');
console.assert(otherCalled === false, 'other event listeners should not be called when emitting test');

// Test 6: Test order of execution
let order = [];
eventBus.on('order', () => {
  order.push('first');
});
eventBus.on('order', () => {
  order.push('second');
});
eventBus.on('order', () => {
  order.push('third');
});
order = [];
eventBus.emit('order');
console.assert(order.length === 3, 'should have 3 listeners called');
console.assert(order[0] === 'first', 'first listener should be called first');
console.assert(order[1] === 'second', 'second listener should be called second');
console.assert(order[2] === 'third', 'third listener should be called third');

console.log('All tests passed!');

// Test 7: Test off method - remove one listener
let offCalled1 = false;
let offCalled2 = false;

const listener1 = () => { offCalled1 = true; };
const listener2 = () => { offCalled2 = true; };

eventBus.on('offTest', listener1);
eventBus.on('offTest', listener2);

// Verify both are called
eventBus.emit('offTest');
console.assert(offCalled1 === true, 'first listener should have been called');
console.assert(offCalled2 === true, 'second listener should have been called');

// Reset flags
offCalled1 = false;
offCalled2 = false;

// Remove first listener
eventBus.off('offTest', listener1);

// Verify only second is called
eventBus.emit('offTest');
console.assert(offCalled1 === false, 'first listener should not be called after being removed');
console.assert(offCalled2 === true, 'second listener should still be called');

// Reset flags
offCalled2 = false;

// Remove second listener
eventBus.off('offTest', listener2);

// Verify none are called
eventBus.emit('offTest');
console.assert(offCalled2 === false, 'second listener should not be called after being removed');

// Test 8: off with non-existent event should not crash
eventBus.off('nonExistent', listener1);

// Test 9: off with non-existent listener should not crash
eventBus.on('test3', () => {});
eventBus.off('test3', listener1);

console.log('All tests passed!');
// Test 8: Test once method - listener should only run once
let onceCalled = false;
eventBus.once('onceTest', () => {
  onceCalled = true;
});

// First emit - should call the listener
eventBus.emit('onceTest');
console.assert(onceCalled === true, 'once listener should have been called on first emit');

// Reset flag
onceCalled = false;

// Second emit - should not call the listener (it should be removed)
eventBus.emit('onceTest');
console.assert(onceCalled === false, 'once listener should not be called on second emit');

// Test 9: Test once with arguments
let onceArgsReceived = [];
eventBus.once('onceTest2', (...args) => {
  onceArgsReceived = args;
});

eventBus.emit('onceTest2', 'hello', 42);
console.assert(onceArgsReceived.length === 2, 'once listener should receive 2 arguments');
console.assert(onceArgsReceived[0] === 'hello', 'first argument should be "hello"');
console.assert(onceArgsReceived[1] === 42, 'second argument should be 42');

// Reset flag
onceArgsReceived = [];

// Second emit - should not call the listener
eventBus.emit('onceTest2', 'should not be received');
console.assert(onceArgsReceived.length === 0, 'once listener should not be called on second emit');

console.log('All tests passed!');
// Test 10: Test listenerCount method with no listeners
console.assert(eventBus.listenerCount('noListeners') === 0, 'listenerCount should return 0 for event with no listeners');

// Test 11: Test listenerCount method with regular listeners
eventBus.on('countTest', () => {});
eventBus.on('countTest', () => {});
console.assert(eventBus.listenerCount('countTest') === 2, 'listenerCount should return 2 for event with 2 regular listeners');

// Test 12: Test listenerCount method with once listeners
eventBus.once('countTest2', () => {});
eventBus.once('countTest2', () => {});
console.assert(eventBus.listenerCount('countTest2') === 2, 'listenerCount should return 2 for event with 2 once listeners');

// Test 13: Test listenerCount method after once listeners have fired
let onceTest3Called = false;
eventBus.once('countTest3', () => {
  onceTest3Called = true;
});
eventBus.emit('countTest3');
console.assert(onceTest3Called === true, 'once listener should have been called');
console.assert(eventBus.listenerCount('countTest3') === 0, 'listenerCount should return 0 after once listener has fired');

console.log('All tests passed!');
