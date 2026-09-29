const { TaskGraph } = require('./r3_tasks.js');

console.log("Debugging cycle detection...");

const graph = new TaskGraph();
graph.add('task1', 10);
graph.add('task2', 20);

console.log("Added tasks");

// First dependency: task1 depends on task2
try {
    graph.depend('task1', 'task2');
    console.log("✓ task1 -> task2: Added successfully");
} catch (e) {
    console.log("✗ task1 -> task2: Failed:", e.message);
}

console.log("Dependencies after first add:", graph.dependencies);

// Second dependency: task2 depends on task1 (should create cycle)
try {
    graph.depend('task2', 'task1');
    console.log("✓ task2 -> task1: Added successfully (this is wrong - should detect cycle)");
} catch (e) {
    console.log("✗ task2 -> task1: Failed as expected:", e.message);
}

console.log("Final dependencies:", graph.dependencies);