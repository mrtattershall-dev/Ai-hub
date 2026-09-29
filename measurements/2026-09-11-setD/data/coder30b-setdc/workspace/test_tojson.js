// Test the toJSON() and fromJSON() methods for TaskGraph

// Read the tasks file
const fs = require('fs');
const tasksCode = fs.readFileSync('r3_tasks.js', 'utf8');

// Evaluate the code to get the TaskGraph class
eval(tasksCode);

console.log("Testing toJSON() and fromJSON() methods...");

// Test 1: Basic functionality
console.log("\nTest 1: Basic toJSON() functionality");
try {
  const graph = new TaskGraph();
  graph.add('task1', 10)
       .add('task2', 20)
       .add('task3', 15)
       .depend('task2', 'task1')
       .depend('task3', 'task1');
  
  const json = graph.toJSON();
  
  // Check if the structure is correct
  if (json && json.tasks && Array.isArray(json.tasks)) {
    console.log("PASS: toJSON() returns correct structure");
    
    // Check if tasks are in order (task1 should come first since it has no dependencies)
    if (json.tasks.length === 3) {
      console.log("PASS: All tasks included");
      
      // Check specific task data
      const task1 = json.tasks.find(t => t.id === 'task1');
      const task2 = json.tasks.find(t => t.id === 'task2');
      const task3 = json.tasks.find(t => t.id === 'task3');
      
      if (task1 && task1.duration === 10 && task1.deps.length === 0) {
        console.log("PASS: task1 data correct");
      } else {
        console.log("FAIL: task1 data incorrect");
        console.log("task1:", task1);
      }
      
      if (task2 && task2.duration === 20 && task2.deps.length === 1 && task2.deps[0] === 'task1') {
        console.log("PASS: task2 data correct");
      } else {
        console.log("FAIL: task2 data incorrect");
        console.log("task2:", task2);
      }
      
      if (task3 && task3.duration === 15 && task3.deps.length === 1 && task3.deps[0] === 'task1') {
        console.log("PASS: task3 data correct");
      } else {
        console.log("FAIL: task3 data incorrect");
        console.log("task3:", task3);
      }
    } else {
      console.log("FAIL: Incorrect number of tasks");
      console.log("Expected 3, got", json.tasks.length);
    }
  } else {
    console.log("FAIL: toJSON() does not return correct structure");
    console.log("json:", json);
  }
} catch (error) {
  console.log("FAIL: Error in Test 1:", error.message);
}

// Test 2: Roundtrip test
console.log("\nTest 2: Roundtrip test");
try {
  const originalGraph = new TaskGraph();
  originalGraph.add('A', 5)
              .add('B', 3)
              .add('C', 4)
              .depend('B', 'A')
              .depend('C', 'A');
  
  const json2 = originalGraph.toJSON();
  const restoredGraph = TaskGraph.fromJSON(json2);
  
  // Check if the restored graph has the same tasks and dependencies
  if (restoredGraph.size() === 3) {
    console.log("PASS: Restored graph has correct size");
    
    // Check if tasks are in the same order
    const originalOrder = originalGraph.order();
    const restoredOrder = restoredGraph.order();
    
    if (originalOrder.length === restoredOrder.length) {
      let orderMatch = true;
      for (let i = 0; i < originalOrder.length; i++) {
        if (originalOrder[i] !== restoredOrder[i]) {
          orderMatch = false;
          break;
        }
      }
      
      if (orderMatch) {
        console.log("PASS: Tasks in same order");
      } else {
        console.log("FAIL: Tasks not in same order");
        console.log("Original order:", originalOrder);
        console.log("Restored order:", restoredOrder);
      }
    } else {
      console.log("FAIL: Different number of tasks in order");
    }
  } else {
    console.log("FAIL: Restored graph has incorrect size");
  }
} catch (error) {
  console.log("FAIL: Error in Test 2:", error.message);
}

// Test 3: Error handling - cycle detection
console.log("\nTest 3: Error handling - cycle detection");
try {
  const cycleGraph = new TaskGraph();
  cycleGraph.add('A', 5)
            .add('B', 3)
            .depend('A', 'B')  // This creates a cycle when combined with B->A
            .depend('B', 'A');
  
  const json3 = cycleGraph.toJSON();
  TaskGraph.fromJSON(json3);
  console.log("FAIL: Should have thrown error for cycle");
} catch (e) {
  if (e.message.includes('cycle') || e.message.includes('Cycle')) {
    console.log("PASS: Correctly detected cycle");
  } else {
    console.log("FAIL: Wrong error for cycle:", e.message);
  }
}

// Test 4: Error handling - unknown dependency
console.log("\nTest 4: Error handling - unknown dependency");
try {
  const badData = {
    tasks: [
      { id: 'task1', duration: 10, deps: ['unknown_task'] }
    ]
  };
  
  TaskGraph.fromJSON(badData);
  console.log("FAIL: Should have thrown error for unknown dependency");
} catch (e) {
  if (e.message.includes('Unknown dependency') || e.message.includes('does not exist')) {
    console.log("PASS: Correctly detected unknown dependency");
  } else {
    console.log("FAIL: Wrong error for unknown dependency:", e.message);
  }
}

console.log("\nAll tests completed");