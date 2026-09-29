class TaskGraph {
  constructor() {
    this.tasks = new Map();
    this.dependencies = new Map();
    this.completed = new Set();
  }

  ready(doneIds) {
    const readyTasks = [];
    for (const [id, dependencies] of this.dependencies) {
      if (!doneIds.includes(id) && dependencies.every(dep => doneIds.includes(dep))) {
        readyTasks.push(id);
      }
    }
    return readyTasks;
  }

  depend(id, onId) {
    if (!this.tasks.has(id) || !this.tasks.has(onId)) {
      throw new Error(`Unknown task id: ${id} or ${onId}`);
    }
    if (id === onId) {
      throw new Error(`Task cannot depend on itself: ${id}`);
    }
    if (!this.dependencies.has(id)) {
      this.dependencies.set(id, []);
    }
    this.dependencies.get(id).push(onId);
  }

  add(id, duration) {
    if (this.tasks.has(id)) {
      throw new Error(`Task with id ${id} already exists.`);
    }
    if (typeof duration !== 'number' || duration <= 0) {
      throw new Error(`Duration must be a positive number.`);
    }
    this.tasks.set(id, duration);
  }

  has(id) {
    return this.tasks.has(id);
  }

  size() {
    return this.tasks.size;
  }
}

module.exports = TaskGraph;
const assert = require('assert');

// Test add method
const taskGraph = new TaskGraph();
taskGraph.add('task1', 10);
assert.strictEqual(taskGraph.has('task1'), true);
assert.strictEqual(taskGraph.size(), 1);

try {
  taskGraph.add('task1', 10);
  assert.fail('Expected error was not thrown');
} catch (e) {
  assert.strictEqual(e.message, 'Task with id task1 already exists.');
}

try {
  taskGraph.add('task2', -5);
  assert.fail('Expected error was not thrown');
} catch (e) {
  assert.strictEqual(e.message, 'Duration must be a positive number.');
}

// Test has method
assert.strictEqual(taskGraph.has('task1'), true);
assert.strictEqual(taskGraph.has('task2'), false);

// Test size method
assert.strictEqual(taskGraph.size(), 1);
taskGraph.add('task2', 20);
assert.strictEqual(taskGraph.size(), 2);
