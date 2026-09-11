// Test file for u1_queue.js and u4_flatten.js

// Require the modules
const Queue = require('./u1_queue.js');
const flatten = require('./u4_flatten.js');

console.log('Testing u1_queue.js...');
// Test Queue class
const queue = new Queue();

// Test size on empty queue
console.assert(queue.size() === 0, "Empty queue should have size 0");

// Test enqueue
queue.enqueue(1);
console.assert(queue.size() === 1, "Queue should have size 1 after one enqueue");

queue.enqueue(2);
console.assert(queue.size() === 2, "Queue should have size 2 after two enqueues");

// Test dequeue
const first = queue.dequeue();
console.assert(first === 1, "First element should be 1");
console.assert(queue.size() === 1, "Queue should have size 1 after one dequeue");

const second = queue.dequeue();
console.assert(second === 2, "Second element should be 2");
console.assert(queue.size() === 0, "Queue should have size 0 after two dequeues");

// Test dequeue from empty queue throws error
let errorCaught = false;
try {
  queue.dequeue();
} catch (e) {
  errorCaught = true;
  console.assert(e.message === "Cannot dequeue from an empty queue", "Should throw correct error message");
}
console.assert(errorCaught, "Should throw error when dequeueing from empty queue");

// Test isEmpty
console.assert(queue.isEmpty() === true, "Empty queue should be empty");

queue.enqueue("test");
console.assert(queue.isEmpty() === false, "Non-empty queue should not be empty");

// Test peek
queue.enqueue(42);
const peeked = queue.peek();
console.assert(peeked === "test", "Peek should return the front item without removing it");
console.assert(queue.size() === 2, "Peek should not change queue size");

// Test peek on empty queue throws error
let emptyQueueErrorCaught = false;
try {
  const emptyQueue = new Queue();
  emptyQueue.peek();
} catch (e) {
  emptyQueueErrorCaught = true;
  console.assert(e.message === "Cannot peek at an empty queue", "Should throw correct error message for peek on empty queue");
}
console.assert(emptyQueueErrorCaught, "Should throw error when peeking at empty queue");

console.log('All u1_queue.js tests passed!');

console.log('Testing u4_flatten.js...');
// Test flatten function
console.assert(JSON.stringify(flatten({ a: { b: 1 } })) === JSON.stringify({ 'a.b': 1 }), 'Test 1 failed');
console.assert(JSON.stringify(flatten({ a: { b: { c: 2 } } })) === JSON.stringify({ 'a.b.c': 2 }), 'Test 2 failed');
console.assert(JSON.stringify(flatten({ a: 1, b: 2 })) === JSON.stringify({ a: 1, b: 2 }), 'Test 3 failed');
console.assert(JSON.stringify(flatten({ a: { b: 1 }, c: { d: 2 } })) === JSON.stringify({ 'a.b': 1, 'c.d': 2 }), 'Test 4 failed');
console.assert(JSON.stringify(flatten({})) === JSON.stringify({}), 'Test 5 failed');
console.assert(JSON.stringify(flatten({ a: null })) === JSON.stringify({ a: null }), 'Test 6 failed');
console.assert(JSON.stringify(flatten({ a: [1, 2, 3] })) === JSON.stringify({ a: [1, 2, 3] }), 'Test 7 failed');
console.assert(JSON.stringify(flatten({ a: [1, 2] })) === JSON.stringify({ a: [1, 2] }), 'Test 8 failed');

console.log('All u4_flatten.js tests passed!');

console.log('All tests passed successfully!');