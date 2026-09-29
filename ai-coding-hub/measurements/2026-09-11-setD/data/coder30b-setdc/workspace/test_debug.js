const { TaskGraph } = require('./r3_tasks.js');

// Test case 5: Parallel tasks with dependencies
const parallelGraph = new TaskGraph();
parallelGraph.add('task1', 10)
            .add('task2', 20)
            .add('task3', 15)
            .add('task4', 5)
            .depend('task2', 'task1')
            .depend('task3', 'task1')
            .depend('task4', 'task2');

console.log("Tasks:", parallelGraph.tasks);
console.log("Dependencies:", parallelGraph.dependencies);
console.log("Order:", parallelGraph.order());
console.log("Total time:", parallelGraph.totalTime());