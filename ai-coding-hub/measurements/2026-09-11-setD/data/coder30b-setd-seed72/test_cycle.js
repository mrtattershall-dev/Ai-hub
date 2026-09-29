const { TaskGraph } = require('./r3_tasks.js');

// Test cycle detection
console.log("Testing cycle detection...");

const graph = new TaskGraph();
graph.add('task1', 10);
graph.add('task2', 20);
graph.add('task3', 15);

// This should work - no cycle
try {
    graph.depend('task2', 'task1');
    console.log("✓ task2 -> task1: No cycle (expected)");
} catch (e) {
    console.log("✗ task2 -> task1: Unexpected error:", e.message);
}

// This should also work - no cycle
try {
    graph.depend('task3', 'task2');
    console.log("✓ task3 -> task2: No cycle (expected)");
} catch (e) {
    console.log("✗ task3 -> task2: Unexpected error:", e.message);
}

// This should fail - creating a cycle
try {
    graph.depend('task1', 'task3');
    console.log("✗ task1 -> task3: Should have created a cycle but didn't");
} catch (e) {
    console.log("✓ task1 -> task3: Correctly detected cycle:", e.message);
}

// Test self-dependency
try {
    graph.depend('task1', 'task1');
    console.log("✗ task1 -> task1: Should have failed for self-dependency");
} catch (e) {
    console.log("✓ task1 -> task1: Correctly detected self-dependency:", e.message);
}

// Test unknown task
try {
    graph.depend('task1', 'unknown');
    console.log("✗ task1 -> unknown: Should have failed for unknown task");
} catch (e) {
    console.log("✓ task1 -> unknown: Correctly detected unknown task:", e.message);
}

console.log("Cycle detection tests completed.");