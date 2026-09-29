const { TaskGraph } = require('./r3_tasks.js');

// Test case 5: Parallel tasks with dependencies (from test_total_report.js)
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

// Let's also manually trace what should happen
console.log("\nManual trace:");
console.log("t=0: task1 starts (duration 10)");
console.log("t=10: task1 finishes, task2 and task3 start (duration 20, 15)");
console.log("t=25: task3 finishes, task4 starts (duration 5)");
console.log("t=30: task2 finishes");
console.log("t=35: task4 finishes");
console.log("So total time should be 35");