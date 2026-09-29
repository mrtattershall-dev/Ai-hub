const TaskGraph = require('./r3_tasks.js');
const assert = require('assert');

// Test depend method
const taskGraph = new TaskGraph();
taskGraph.add('task1', 10);
taskGraph.add('task2', 20);

// Test valid dependency
taskGraph.depend('task2', 'task1');
assert.strictEqual(taskGraph.dependencies.get('task2')[0], 'task1');

// Test unknown task dependency
try {
  taskGraph.depend('task3', 'task1');
  assert.fail('Expected error was not thrown');
} catch (e) {
  assert.strictEqual(e.message, 'Unknown task id: task3 or task1');
}

// Test self-dependency
try {
  taskGraph.depend('task1', 'task1');
  assert.fail('Expected error was not thrown');
} catch (e) {
  assert.strictEqual(e.message, 'Task cannot depend on itself: task1');
}
