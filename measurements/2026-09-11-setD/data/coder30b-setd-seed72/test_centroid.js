// Test the centroid function in r4_geom.js
const geom = require('./r4_geom.js');

// Test case 1: Simple triangle
console.log("Testing centroid of a triangle:");
const triangle = [
    {x: 0, y: 0},
    {x: 2, y: 0},
    {x: 1, y: 2}
];

try {
    const centroid1 = geom.centroid(triangle);
    console.log("Triangle centroid:", centroid1);
} catch (e) {
    console.log("Error:", e.message);
}

// Test case 2: Square
console.log("\nTesting centroid of a square:");
const square = [
    {x: 0, y: 0},
    {x: 2, y: 0},
    {x: 2, y: 2},
    {x: 0, y: 2}
];

try {
    const centroid2 = geom.centroid(square);
    console.log("Square centroid:", centroid2);
} catch (e) {
    console.log("Error:", e.message);
}

// Test case 3: Polygon with zero area (should throw error)
console.log("\nTesting centroid of a degenerate polygon:");
const degenerate = [
    {x: 0, y: 0},
    {x: 1, y: 1},
    {x: 2, y: 2}
];

try {
    const centroid3 = geom.centroid(degenerate);
    console.log("Degenerate polygon centroid:", centroid3);
} catch (e) {
    console.log("Expected error:", e.message);
}

// Test case 4: Polygon with less than 3 vertices (should throw error)
console.log("\nTesting centroid of a line:");
const line = [
    {x: 0, y: 0},
    {x: 2, y: 2}
];

try {
    const centroid4 = geom.centroid(line);
    console.log("Line centroid:", centroid4);
} catch (e) {
    console.log("Expected error:", e.message);
}