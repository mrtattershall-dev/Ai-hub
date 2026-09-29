// Import the TaskGraph class directly
const { TaskGraph } = require('./r3_tasks.js');

// Test the toJSON() and fromJSON() functionality
try {
  // Test 1: Basic functionality
  console.log("Test 1: Basic toJSON() functionality");
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
    
    // Check if tasks are in order
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
      }
      
      if (task2 && task2.duration === 20 && task2.deps.length === 1 && task2.deps[0] === 'task1') {
        console.log("PASS: task2 data correct");
      } else {
        console.log("FAIL: task2 data incorrect");
      }
      
      if (task3 && task3.duration === 15 && task3.deps.length === 1 && task3.deps[0] === 'task1') {
        console.log("PASS: task3 data correct");
      } else {
        console.log("FAIL: task3 data incorrect");
      }
    } else {
      console.log("FAIL: Incorrect number of tasks");
    }
  } else {
    console.log("FAIL: toJSON() does not return correct structure");
  }
  
  // Test 2: fromJSON() functionality
  console.log("\nTest 2: Basic fromJSON() functionality");
  try {
    const reconstructed = TaskGraph.fromJSON(json);
    const reconstructedJson = reconstructed.toJSON();
    
    if (JSON.stringify(json) === JSON.stringify(reconstructedJson)) {
      console.log("PASS: fromJSON() correctly reconstructs the graph");
    } else {
      console.log("FAIL: fromJSON() does not reconstruct correctly");
      console.log("Original:", JSON.stringify(json));
      console.log("Reconstructed:", JSON.stringify(reconstructedJson));
    }
  } catch (e) {
    console.log("FAIL: fromJSON() threw an error:", e.message);
  }
  
  // Test 3: fromJSON() with cycle detection
  console.log("\nTest 3: fromJSON() with cycle detection");
  try {
    const cycleData = {
      tasks: [
        { id: 'task1', duration: 10, deps: ['task2'] },
        { id: 'task2', duration: 20, deps: ['task1'] }
      ]
    };
    TaskGraph.fromJSON(cycleData);
    console.log("FAIL: fromJSON() should have detected a cycle");
  } catch (e) {
    if (e.message.includes("Adding dependency would create a cycle")) {
      console.log("PASS: fromJSON() correctly detected cycle");
    } else {
      console.log("FAIL: fromJSON() threw wrong error:", e.message);
    }
  }
  
  // Test 4: fromJSON() with unknown dependency
  console.log("\nTest 4: fromJSON() with unknown dependency");
  try {
    const unknownDepData = {
      tasks: [
        { id: 'task1', duration: 10, deps: ['unknown_task'] }
      ]
    };
    TaskGraph.fromJSON(unknownDepData);
    console.log("FAIL: fromJSON() should have detected unknown dependency");
  } catch (e) {
    if (e.message.includes("Unknown dependency")) {
      console.log("PASS: fromJSON() correctly detected unknown dependency");
    } else {
      console.log("FAIL: fromJSON() threw wrong error:", e.message);
    }
  }
  
  console.log("\nAll tests completed!");
} catch (e) {
  console.error("Error running tests:", e);
}