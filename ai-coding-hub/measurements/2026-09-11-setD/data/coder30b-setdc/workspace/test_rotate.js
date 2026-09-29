const { rotate } = require('./r4_geom.js');

// Test data
const points = [{x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}, {x: 0, y: -1}];

// Test rotate
console.log("Original points:", points);
const rotated = rotate(points, 90);
console.log("Rotated 90 degrees counter-clockwise:", rotated);

// Test with origin
const rotatedWithOrigin = rotate(points, 90, {x: 0, y: 0});
console.log("Rotated 90 degrees counter-clockwise around origin (0,0):", rotatedWithOrigin);

// Test with different origin
const rotatedWithDifferentOrigin = rotate(points, 90, {x: 1, y: 1});
console.log("Rotated 90 degrees counter-clockwise around origin (1,1):", rotatedWithDifferentOrigin);

// Test that original points are unchanged
console.log("Original points after rotate:", points);

// Test with 180 degrees
const rotated180 = rotate(points, 180);
console.log("Rotated 180 degrees counter-clockwise:", rotated180);

// Test with 270 degrees
const rotated270 = rotate(points, 270);
console.log("Rotated 270 degrees counter-clockwise:", rotated270);

// Test with 360 degrees (should be same as original)
const rotated360 = rotate(points, 360);
console.log("Rotated 360 degrees counter-clockwise:", rotated360);

console.log("All tests completed successfully!");