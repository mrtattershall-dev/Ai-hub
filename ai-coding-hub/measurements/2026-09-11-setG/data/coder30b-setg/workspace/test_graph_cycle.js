const Graph = require('./s6_graph.py');

// Test 1: Empty graph should not have cycle
console.log("Test 1: Empty graph");
const g1 = new Graph();
console.log("Empty graph has cycle:", g1.has_cycle()); // Should be false

// Test 2: Single node should not have cycle
console.log("\nTest 2: Single node");
const g2 = new Graph();
g2.add_node("a");
console.log("Single node graph has cycle:", g2.has_cycle()); // Should be false

// Test 3: Single node with self-loop should have cycle
console.log("\nTest 3: Self-loop");
const g3 = new Graph();
g3.add_node("a");
g3.add_edge("a", "a");
console.log("Self-loop graph has cycle:", g3.has_cycle()); // Should be true

// Test 4: Simple directed path should not have cycle
console.log("\nTest 4: Simple path");
const g4 = new Graph();
g4.add_node("a");
g4.add_node("b");
g4.add_node("c");
g4.add_edge("a", "b");
g4.add_edge("b", "c");
console.log("Simple path graph has cycle:", g4.has_cycle()); // Should be false

// Test 5: Simple cycle should have cycle
console.log("\nTest 5: Simple cycle");
const g5 = new Graph();
g5.add_node("a");
g5.add_node("b");
g5.add_edge("a", "b");
g5.add_edge("b", "a");
console.log("Simple cycle graph has cycle:", g5.has_cycle()); // Should be true

// Test 6: Complex graph with cycle
console.log("\nTest 6: Complex cycle");
const g6 = new Graph();
g6.add_node("a");
g6.add_node("b");
g6.add_node("c");
g6.add_node("d");
g6.add_edge("a", "b");
g6.add_edge("b", "c");
g6.add_edge("c", "d");
g6.add_edge("d", "b"); // Creates cycle: b->c->d->b
console.log("Complex cycle graph has cycle:", g6.has_cycle()); // Should be true

// Test 7: Complex graph without cycle
console.log("\nTest 7: Complex no cycle");
const g7 = new Graph();
g7.add_node("a");
g7.add_node("b");
g7.add_node("c");
g7.add_node("d");
g7.add_edge("a", "b");
g7.add_edge("a", "c");
g7.add_edge("b", "d");
g7.add_edge("c", "d");
console.log("Complex no-cycle graph has cycle:", g7.has_cycle()); // Should be false

console.log("\nAll tests completed");