const TaskGraph = require('./r3_tasks.js');
const assert = require('assert');

describe('TaskGraph', function() {
  let taskGraph;

  beforeEach(function() {
    taskGraph = new TaskGraph();
  });

  it('should add a task', function() {
    taskGraph.add('task1', 10);
    assert.strictEqual(taskGraph.has('task1'), true);
    assert.strictEqual(taskGraph.size(), 1);
  });

  it('should throw an error if task id already exists', function() {
    taskGraph.add('task1', 10);
    assert.throws(() => taskGraph.add('task1', 10), Error, 'Task with id task1 already exists.');
  });

  it('should throw an error if duration is not a positive number', function() {
    assert.throws(() => taskGraph.add('task1', -10), Error, 'Duration must be a positive number.');
    assert.throws(() => taskGraph.add('task1', 0), Error, 'Duration must be a positive number.');
  });

  it('should check if a task exists', function() {
    taskGraph.add('task1', 10);
    assert.strictEqual(taskGraph.has('task1'), true);
    assert.strictEqual(taskGraph.has('task2'), false);
  });

  it('should get the size of the task graph', function() {
    taskGraph.add('task1', 10);
    taskGraph.add('task2', 20);
    assert.strictEqual(taskGraph.size(), 2);
  });
});