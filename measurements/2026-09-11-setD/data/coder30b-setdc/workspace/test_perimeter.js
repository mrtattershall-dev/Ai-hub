// test_perimeter.js - Test the pointInPolygon function

const { pointInPolygon } = require('./r4_geom.js');

// Test cases
console.log("Testing pointInPolygon function...");

// Test 1: Point inside a triangle
const triangle = [
    {x: 0, y: 0},
    {x: 4, y: 0},
    {x: 2, y: 4}
];

console.log("Triangle:", triangle);
console.log("Point (2, 2) inside triangle:", pointInPolygon({x: 2, y: 2}, triangle)); // Should be true
console.log("Point (0, 0) on edge:", pointInPolygon({x: 0, y: 0}, triangle)); // Should be true
console.log("Point (5, 5) outside:", pointInPolygon({x: 5, y: 5}, triangle)); // Should be false

// Test 2: Point inside a square
const square = [
    {x: 0, y: 0},
    {x: 4, y: 0},
    {x: 4, y: 4},
    {x: 0, y: 4}
];

console.log("\nSquare:", square);
console.log("Point (2, 2) inside square:", pointInPolygon({x: 2, y: 2}, square)); // Should be true
console.log("Point (0, 2) on edge:", pointInPolygon({x: 0, y: 2}, square)); // Should be true
console.log("Point (5, 2) outside:", pointInPolygon({x: 5, y: 2}, square)); // Should be false

// Test 3: Point inside a pentagon
const pentagon = [
    {x: 0, y: 5},
    {x: 5, y: 0},
    {x: 0, y: -5},
    {x: -5, y: 0},
    {x: 0, y: 5} // Closing the polygon
];

console.log("\nPentagon:", pentagon);
console.log("Point (0, 0) inside pentagon:", pointInPolygon({x: 0, y: 0}, pentagon)); // Should be true
console.log("Point (0, 5) on edge:", pointInPolygon({x: 0, y: 5}, pentagon)); // Should be true
console.log("Point (10, 10) outside:", pointInPolygon({x: 10, y: 10}, pentagon)); // Should be false

// Test 4: Point on vertex
const triangle2 = [
    {x: 0, y: 0},
    {x: 4, y: 0},
    {x: 2, y: 4}
];

console.log("\nTriangle 2:", triangle2);
console.log("Point (0, 0) on vertex:", pointInPolygon({x: 0, y: 0}, triangle2)); // Should be true

// Test 5: Invalid polygon (less than 3 points)
const invalid = [
    {x: 0, y: 0},
    {x: 4, y: 0}
];

console.log("\nInvalid polygon (2 points):", invalid);
console.log("Point (2, 2) on invalid polygon:", pointInPolygon({x: 2, y: 2}, invalid)); // Should be false

console.log("\nAll tests completed.");