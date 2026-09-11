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
}

// Export the Queue class
module.exports = Queue;