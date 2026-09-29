const { TaskGraph } = require('./r3_tasks.js');

// Create a test TaskGraph
const graph = new TaskGraph();
graph.add('task1', 10)
     .add('task2', 20)
     .add('task3', 15)
     .add('task4', 5)
     .depend('task2', 'task1')
     .depend('task3', 'task1')
     .depend('task4', 'task2');

console.log("Testing ready method:");
console.log("All tasks:", Array.from(graph.tasks.keys()));

// Test 1: No tasks done
const ready1 = graph.ready([]);
console.log("Ready when no tasks done:", ready1); // Should be ['task1'] since it has no dependencies

// Test 2: task1 done
const ready2 = graph.ready(['task1']);
console.log("Ready when task1 done:", ready2); // Should be ['task2', 'task3'] 

// Test 3: task1 and task2 done
const ready3 = graph.ready(['task1', 'task2']);
console.log("Ready when task1 and task2 done:", ready3); // Should be ['task3', 'task4']

// Test 4: All tasks done
const ready4 = graph.ready(['task1', 'task2', 'task3', 'task4']);
console.log("Ready when all tasks done:", ready4); // Should be []

console.log("Test completed");