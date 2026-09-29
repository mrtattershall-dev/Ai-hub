const TaskGraph = require('./r3_tasks.js');
const assert = require('assert');

// Create a new TaskGraph instance
const taskGraph = new TaskGraph();

// Add tasks
taskGraph.add('task1', 10);
taskGraph.add('task2', 20);
taskGraph.add('task3', 30);

// Add dependencies
taskGraph.depend('task2', 'task1');
taskGraph.depend('task3', 'task2');

// Test remove method
taskGraph.remove('task2');

// Verify that task2 and its dependencies are removed
assert.strictEqual(taskGraph.has('task2'), false);
assert.strictEqual(taskGraph.has('task3'), false);
assert.strictEqual(taskGraph.size(), 1);

// Test remove method with unknown id
try {
  taskGraph.remove('task4');
  assert.fail('Expected error was not thrown');
} catch (e) {
  assert.strictEqual(e.message, 'Unknown task id: task4');
}

console.log('All tests passed!');