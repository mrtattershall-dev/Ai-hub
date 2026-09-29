// Debug the quadrilateral perimeter calculation
const fs = require('fs');

// Read the r4_geom.js file to get our functions
const content = fs.readFileSync('r4_geom.js', 'utf8');

// Evaluate the content to get the functions
eval(content);

// Test the exact quadrilateral from the test
const quadPerimeter = [{x: 0, y: 0}, {x: 4, y: 0}, {x: 3, y: 3}, {x: 1, y: 3}];
console.log("Quadrilateral points:", quadPerimeter);

// Calculate each side manually
const p1 = quadPerimeter[0]; // (0,0)
const p2 = quadPerimeter[1]; // (4,0)
const p3 = quadPerimeter[2]; // (3,3)
const p4 = quadPerimeter[3]; // (1,3)

console.log("Side 1: (0,0) to (4,0) = ", distance(p1, p2));
console.log("Side 2: (4,0) to (3,3) = ", distance(p2, p3));
console.log("Side 3: (3,3) to (1,3) = ", distance(p3, p4));
console.log("Side 4: (1,3) to (0,0) = ", distance(p4, p1));

const expected = 14.82842712474619;
const calculated = perimeter(quadPerimeter);
console.log("Expected:", expected);
console.log("Calculated:", calculated);
console.log("Difference:", Math.abs(expected - calculated));