const TaskGraph = require('./r3_tasks.js');
const assert = require('assert');

describe('TaskGraph', function() {
  describe('ready', function() {
    it('should return tasks that are not in doneIds and whose dependencies are all in doneIds', function() {
      const taskGraph = new TaskGraph();
      taskGraph.add('task1', 10);
      taskGraph.add('task2', 20);
      taskGraph.add('task3', 30);
      taskGraph.depend('task2', 'task1');
      taskGraph.depend('task3', 'task1');
      taskGraph.depend('task3', 'task2');

      const readyTasks = taskGraph.ready(['task1']);
      assert.deepStrictEqual(readyTasks, ['task2']);

      const readyTasks2 = taskGraph.ready(['task1', 'task2']);
      assert.deepStrictEqual(readyTasks2, ['task3']);
    });

    it('should return an empty array if no tasks are ready', function() {
      const taskGraph = new TaskGraph();
      taskGraph.add('task1', 10);
      taskGraph.add('task2', 20);
      taskGraph.depend('task2', 'task1');

      const readyTasks = taskGraph.ready([]);
      assert.deepStrictEqual(readyTasks, []);

      const readyTasks2 = taskGraph.ready(['task1']);
      assert.deepStrictEqual(readyTasks2, []);
    });

    it('should return all tasks if all dependencies are met', function() {
      const taskGraph = new TaskGraph();
      taskGraph.add('task1', 10);
      taskGraph.add('task2', 20);
      taskGraph.add('task3', 30);
      taskGraph.depend('task2', 'task1');
      taskGraph.depend('task3', 'task1');
      taskGraph.depend('task3', 'task2');

      const readyTasks = taskGraph.ready(['task1', 'task2']);
      assert.deepStrictEqual(readyTasks, ['task3']);
    });
  });
});