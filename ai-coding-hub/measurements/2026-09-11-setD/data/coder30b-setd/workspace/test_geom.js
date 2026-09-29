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