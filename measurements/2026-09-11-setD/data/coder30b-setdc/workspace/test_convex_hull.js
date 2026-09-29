// test_convex_hull.js - Test the isConvex function

const { isConvex } = require('./r4_geom.js');

// Test cases
console.log("Testing isConvex function...\n");

// Test 1: Square (convex)
const square = [
    {x: 0, y: 0},
    {x: 1, y: 0},
    {x: 1, y: 1},
    {x: 0, y: 1}
];
console.log("Square (convex):", isConvex(square));

// Test 2: Triangle (convex)
const triangle = [
    {x: 0, y: 0},
    {x: 1, y: 0},
    {x: 0.5, y: 1}
];
console.log("Triangle (convex):", isConvex(triangle));

// Test 3: Star shape (non-convex)
const star = [
    {x: 0, y: 0},
    {x: 1, y: 0},
    {x: 0.5, y: 1},
    {x: 0, y: 0.5},
    {x: 1, y: 0.5}
];
console.log("Star shape (non-convex):", isConvex(star));

// Test 4: Concave quadrilateral (non-convex)
const concave = [
    {x: 0, y: 0},
    {x: 2, y: 0},
    {x: 1, y: 1},
    {x: 0, y: 2}
];
console.log("Concave quadrilateral (non-convex):", isConvex(concave));

// Test 5: Pentagon (convex)
const pentagon = [
    {x: 0, y: 0},
    {x: 1, y: 0},
    {x: 1.5, y: 0.5},
    {x: 0.5, y: 1.5},
    {x: 0, y: 0.5}
];
console.log("Pentagon (convex):", isConvex(pentagon));

// Test 6: Collinear points (should be non-convex)
const collinear = [
    {x: 0, y: 0},
    {x: 1, y: 1},
    {x: 2, y: 2}
];
console.log("Collinear points (non-convex):", isConvex(collinear));

// Test 7: Invalid input - not enough points
try {
    const invalid = [{x: 0, y: 0}, {x: 1, y: 1}];
    console.log("Invalid polygon (too few points):", isConvex(invalid));
} catch (e) {
    console.log("Invalid polygon (too few points) - caught error:", e.message);
}

console.log("\nTests completed.");