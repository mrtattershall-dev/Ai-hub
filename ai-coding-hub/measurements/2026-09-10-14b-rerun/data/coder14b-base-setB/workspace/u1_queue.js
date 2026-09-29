// u1_queue.js
class Queue {
  constructor() {
    this.items = [];
  }

  enqueue(x) {
    this.items.push(x);
  }

  dequeue() {
    if (this.isEmpty()) {
      throw new Error("Queue is empty");
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
      throw new Error("Queue is empty");
    }
    return this.items[0];
  }
}

module.exports = Queue;