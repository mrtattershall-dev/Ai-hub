const { TaskGraph } = require('./r3_tasks.js');

// Test case 1: Empty graph
const emptyGraph = new TaskGraph();
console.assert(emptyGraph.totalTime() === 0, 'Empty graph should have totalTime of 0');

// Test case 2: Single task
const singleTaskGraph = new TaskGraph();
singleTaskGraph.add('task1', 10);
console.assert(singleTaskGraph.totalTime() === 10, 'Single task should have totalTime equal to its duration');

// Test case 3: Multiple independent tasks
const independentGraph = new TaskGraph();
independentGraph.add('task1', 10)
              .add('task2', 20)
              .add('task3', 15);
console.assert(independentGraph.totalTime() === 20, 'Independent tasks should have totalTime equal to max duration');

// Test case 4: Dependent tasks (linear chain)
const linearGraph = new TaskGraph();
linearGraph.add('task1', 10)
           .add('task2', 20)
           .add('task3', 15)
           .depend('task2', 'task1')
           .depend('task3', 'task2');
console.assert(linearGraph.totalTime() === 45, 'Linear chain should have totalTime equal to sum of durations');

// Test case 5: Parallel tasks with dependencies
const parallelGraph = new TaskGraph();
parallelGraph.add('task1', 10)
            .add('task2', 20)
            .add('task3', 15)
            .add('task4', 5)
            .depend('task2', 'task1')
            .depend('task3', 'task1')
            .depend('task4', 'task2');
console.assert(parallelGraph.totalTime() === 45, 'Parallel tasks should have totalTime of 45');

// Test case 6: More complex dependency graph
const complexGraph = new TaskGraph();
complexGraph.add('A', 5)
           .add('B', 10)
           .add('C', 15)
           .add('D', 20)
           .add('E', 25)
           .depend('B', 'A')
           .depend('C', 'A')
           .depend('D', 'B')
           .depend('E', 'C')
           .depend('E', 'D');
console.assert(complexGraph.totalTime() === 55, 'Complex graph should have totalTime of 55');

console.log('All tests passed!');