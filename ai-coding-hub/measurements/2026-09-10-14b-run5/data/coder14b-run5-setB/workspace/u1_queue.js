class Queue {
  constructor() {
    this.items = [];
  }

  enqueue(x) {
    this.items.push(x);
  }

  dequeue() {
    if (this.size() === 0) {
      throw new Error('Queue is empty');
    }
    return this.items.shift();
  }

  size() {
    return this.items.length;
  }
}function runTests() {
  const q = new Queue();
  q.enqueue(1);
  q.enqueue(2);
  q.enqueue(3);
  console.assert(q.size() === 3, 'size is 3 after 3 enqueues');
  console.assert(q.dequeue() === 1, 'dequeue returns the first item');
  console.assert(q.size() === 2, 'size is 2 after one dequeue');
  try {
    q.dequeue();
    q.dequeue();
    q.dequeue();
    console.assert(false, 'dequeue on empty throws');
  } catch (e) {
    console.assert(e.message === 'Queue is empty', 'empty queue throws the right message');
  }
  console.log('all tests passed');
}runTests();