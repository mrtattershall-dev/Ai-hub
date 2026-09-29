const fs = require('fs');
const path = require('path');

// Read the r3_tasks.js file
const content = fs.readFileSync('./r3_tasks.js', 'utf8');

// Extract just the TaskGraph class part
const classMatch = content.match(/class TaskGraph\s*{[\s\S]*?}/);
if (!classMatch) {
    console.error("Could not find TaskGraph class");
    process.exit(1);
}

// Create a new file with just the class and a simple test
const testContent = `
${classMatch[0]}

// Test the remove method
const taskGraph = new TaskGraph();

// Add some tasks
taskGraph.add('taskA', 5);
taskGraph.add('taskB', 3);
taskGraph.add('taskC', 2);
taskGraph.add('taskD', 4);

console.log("Initial size:", taskGraph.size());

// Create dependencies
taskGraph.depend('taskB', 'taskA');
taskGraph.depend('taskC', 'taskA');
taskGraph.depend('taskD', 'taskB');

console.log("Size after adding dependencies:", taskGraph.size());

// Test removing a task with dependencies
console.log("Removing taskB...");
taskGraph.remove('taskB');
console.log("Size after removal:", taskGraph.size());

console.log("All tests completed");
`;

fs.writeFileSync('./test_remove_temp.js', testContent);