const Queue = require('./u1_queue.js').Queue;
const flatten = require('./u4_flatten.js').flatten;

// Test Queue
const queue = new Queue();
queue.enqueue(1);
queue.enqueue(2);
queue.enqueue(3);
console.assert(queue.dequeue() === 1, 'Queue dequeue should return 1');
console.assert(queue.dequeue() === 2, 'Queue dequeue should return 2');
console.assert(queue.dequeue() === 3, 'Queue dequeue should return 3');
console.assert(queue.isEmpty(), 'Queue should be empty');

// Test flatten
const obj = { a: 1, b: { c: 2, d: { e: 3 } } };
const flatObj = flatten(obj);
console.assert(flatObj.a === 1, 'Flatten should have a.a === 1');
console.assert(flatObj['b.c'] === 2, 'Flatten should have b.c === 2');
console.assert(flatObj['b.d.e'] === 3, 'Flatten should have b.d.e === 3');

console.log('All tests passed!');