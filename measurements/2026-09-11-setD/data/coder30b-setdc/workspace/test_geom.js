const { translate, scale } = require('./r4_geom.js');

// Test data
const points = [{x: 1, y: 1}, {x: 2, y: 2}, {x: 3, y: 3}];

// Test translate
console.log("Original points:", points);
const translated = translate(points, 10, 20);
console.log("Translated points:", translated);
console.log("Original points after translate:", points); // Should be unchanged

// Test scale
console.log("\nOriginal points:", points);
const scaled = scale(points, 2);
console.log("Scaled points (default origin):", scaled);

const scaledWithOrigin = scale(points, 2, {x: 1, y: 1});
console.log("Scaled points (origin at 1,1):", scaledWithOrigin);
console.log("Original points after scale:", points); // Should be unchanged
// Test rotate
console.log("\nTesting rotate function:");
const { rotate } = require('./r4_geom.js');

// Test data
const testPoints = [{x: 1, y: 0}, {x: 0, y: 1}];

// Test rotate 90 degrees counter-clockwise around origin (0,0)
console.log("Original points:", testPoints);
const rotated90 = rotate(testPoints, 90);
console.log("Rotated 90 degrees:", rotated90);

// Test rotate 180 degrees counter-clockwise around origin (0,0)
const rotated180 = rotate(testPoints, 180);
console.log("Rotated 180 degrees:", rotated180);

// Test rotate 90 degrees counter-clockwise around a different origin
const rotated90Origin = rotate(testPoints, 90, {x: 1, y: 1});
console.log("Rotated 90 degrees around (1,1):", rotated90Origin);

// Test that original points are unchanged
console.log("Original points after rotate:", testPoints);
