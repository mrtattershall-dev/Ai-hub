const { polygonArea, perimeter, centroid, pointInPolygon, convexHull } = require('./r4_geom.js');

console.log("Testing validation in r4_geom.js...");

// Test polygonArea with invalid inputs
try {
    polygonArea("not an array");
    console.log("ERROR: polygonArea should have thrown for non-array input");
} catch (e) {
    console.log("✓ polygonArea correctly rejects non-array input:", e.message);
}

try {
    polygonArea([]);
    console.log("ERROR: polygonArea should have thrown for array with less than 3 points");
} catch (e) {
    console.log("✓ polygonArea correctly rejects array with less than 3 points:", e.message);
}

try {
    polygonArea([{x: 0, y: 0}, {x: 1, y: 1}]);
    console.log("ERROR: polygonArea should have thrown for array with less than 3 points");
} catch (e) {
    console.log("✓ polygonArea correctly rejects array with less than 3 points:", e.message);
}

try {
    polygonArea([{x: 0, y: 0}, {x: 1, y: 1}, {x: 2, y: 2}]);
    console.log("✓ polygonArea accepts valid input");
} catch (e) {
    console.log("ERROR: polygonArea should accept valid input:", e.message);
}

// Test perimeter with invalid inputs
try {
    perimeter("not an array");
    console.log("ERROR: perimeter should have thrown for non-array input");
} catch (e) {
    console.log("✓ perimeter correctly rejects non-array input:", e.message);
}

try {
    perimeter([]);
    console.log("ERROR: perimeter should have thrown for array with less than 2 points");
} catch (e) {
    console.log("✓ perimeter correctly rejects array with less than 2 points:", e.message);
}

try {
    perimeter([{x: 0, y: 0}]);
    console.log("ERROR: perimeter should have thrown for array with less than 2 points");
} catch (e) {
    console.log("✓ perimeter correctly rejects array with less than 2 points:", e.message);
}

try {
    perimeter([{x: 0, y: 0}, {x: 1, y: 1}]);
    console.log("✓ perimeter accepts valid input");
} catch (e) {
    console.log("ERROR: perimeter should accept valid input:", e.message);
}

// Test centroid with invalid inputs
try {
    centroid("not an array");
    console.log("ERROR: centroid should have thrown for non-array input");
} catch (e) {
    console.log("✓ centroid correctly rejects non-array input:", e.message);
}

try {
    centroid([]);
    console.log("ERROR: centroid should have thrown for array with less than 3 points");
} catch (e) {
    console.log("✓ centroid correctly rejects array with less than 3 points:", e.message);
}

try {
    centroid([{x: 0, y: 0}, {x: 1, y: 1}]);
    console.log("ERROR: centroid should have thrown for array with less than 3 points");
} catch (e) {
    console.log("✓ centroid correctly rejects array with less than 3 points:", e.message);
}

try {
    centroid([{x: 0, y: 0}, {x: 1, y: 1}, {x: 2, y: 2}]);
    console.log("✓ centroid accepts valid input");
} catch (e) {
    console.log("ERROR: centroid should accept valid input:", e.message);
}

// Test pointInPolygon with invalid inputs
try {
    pointInPolygon({x: 0, y: 0}, "not an array");
    console.log("ERROR: pointInPolygon should have thrown for non-array input");
} catch (e) {
    console.log("✓ pointInPolygon correctly rejects non-array input:", e.message);
}

try {
    pointInPolygon({x: 0, y: 0}, []);
    console.log("ERROR: pointInPolygon should have thrown for array with less than 3 points");
} catch (e) {
    console.log("✓ pointInPolygon correctly rejects array with less than 3 points:", e.message);
}

try {
    pointInPolygon("not a point", [{x: 0, y: 0}, {x: 1, y: 1}, {x: 2, y: 2}]);
    console.log("ERROR: pointInPolygon should have thrown for non-point input");
} catch (e) {
    console.log("✓ pointInPolygon correctly rejects non-point input:", e.message);
}

try {
    pointInPolygon({x: 0, y: 0}, [{x: 0, y: 0}, {x: 1, y: 1}, {x: 2, y: 2}]);
    console.log("✓ pointInPolygon accepts valid input");
} catch (e) {
    console.log("ERROR: pointInPolygon should accept valid input:", e.message);
}

// Test convexHull with invalid inputs
try {
    convexHull("not an array");
    console.log("ERROR: convexHull should have thrown for non-array input");
} catch (e) {
    console.log("✓ convexHull correctly rejects non-array input:", e.message);
}

try {
    convexHull([]);
    console.log("ERROR: convexHull should have thrown for array with less than 3 points");
} catch (e) {
    console.log("✓ convexHull correctly rejects array with less than 3 points:", e.message);
}

try {
    convexHull([{x: 0, y: 0}, {x: 1, y: 1}]);
    console.log("ERROR: convexHull should have thrown for array with less than 3 points");
} catch (e) {
    console.log("✓ convexHull correctly rejects array with less than 3 points:", e.message);
}

try {
    convexHull([{x: 0, y: 0}, {x: 1, y: 1}, {x: 2, y: 2}]);
    console.log("✓ convexHull accepts valid input");
} catch (e) {
    console.log("ERROR: convexHull should accept valid input:", e.message);
}

console.log("Validation tests completed.");