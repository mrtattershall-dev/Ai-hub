// test_convex_hull.js - Test the convexHull function

const { convexHull } = require('./r4_geom.js');

// Test cases
console.log("Testing convexHull function...");

// Test 1: Simple triangle
const triangle = [
    {x: 0, y: 0},
    {x: 4, y: 0},
    {x: 2, y: 4}
];

console.log("Triangle:", triangle);
console.log("Convex hull:", convexHull(triangle));

// Test 2: Square
const square = [
    {x: 0, y: 0},
    {x: 4, y: 0},
    {x: 4, y: 4},
    {x: 0, y: 4}
];

console.log("\nSquare:", square);
console.log("Convex hull:", convexHull(square));

// Test 3: Points forming a convex hull with some interior points
const points = [
    {x: 0, y: 0},
    {x: 4, y: 0},
    {x: 4, y: 4},
    {x: 0, y: 4},
    {x: 2, y: 2}, // interior point
    {x: 1, y: 1}, // interior point
    {x: 3, y: 3}  // interior point
];

console.log("\nPoints with interior:", points);
console.log("Convex hull:", convexHull(points));

// Test 4: Collinear points
const collinear = [
    {x: 0, y: 0},
    {x: 2, y: 2},
    {x: 4, y: 4},
    {x: 1, y: 1}
];

console.log("\nCollinear points:", collinear);
console.log("Convex hull:", convexHull(collinear));

// Test 5: Single point
const single = [{x: 5, y: 5}];

console.log("\nSingle point:", single);
console.log("Convex hull:", convexHull(single));

// Test 6: Two points
const two = [
    {x: 0, y: 0},
    {x: 4, y: 4}
];

console.log("\nTwo points:", two);
console.log("Convex hull:", convexHull(two));