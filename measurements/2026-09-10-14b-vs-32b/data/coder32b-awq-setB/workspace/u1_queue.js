class Queue {
    constructor() {
        this.items = [];
    }

    enqueue(x) {
        this.items.push(x);
    }

    dequeue() {
        if (this.items.length === 0) {
            throw new Error("Queue is empty");
        }
        return this.items.shift();
    }

    size() {
        return this.items.length;
    }
}

module.exports = Queue;