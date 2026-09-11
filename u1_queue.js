// Queue class implementation
class Queue {
  constructor() {
    this.items = [];
  }
  
  enqueue(x) {
    this.items.push(x);
  }
  
  dequeue() {
    if (this.isEmpty()) {
      throw new Error("Cannot dequeue from an empty queue");
    }
    return this.items.shift();
  }
  
  size() {
    return this.items.length;
  }
  
  isEmpty() {
    return this.items.length === 0;
  }
  
  peek() {
    if (this.isEmpty()) {
      throw new Error("Cannot peek at an empty queue");
    }
    return this.items[0];
  }
}

// Test assertions
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
console.assert(queue.size() === 3, "Peek should not change queue size");

// Test peek on empty queue throws error
let errorCaught = false;
try {
  const emptyQueue = new Queue();
  emptyQueue.peek();
} catch (e) {
  errorCaught = true;
  console.assert(e.message === "Cannot peek at an empty queue", "Should throw correct error message for peek on empty queue");
}
console.assert(errorCaught, "Should throw error when peeking at empty queue");

// Export the Queue class
module.exports = Queue;