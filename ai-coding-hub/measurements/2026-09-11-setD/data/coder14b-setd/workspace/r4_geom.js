// r4_geom.js

/**
 * Calculate the distance between two points.
 * @param {Object} a - The first point with {x, y}.
 * @param {Object} b - The second point with {x, y}.
 * @returns {number} - The distance between the two points.
 */
function distance(a, b) {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

/**
 * Calculate the area of a simple polygon given its corners in order.
 * @param {Array} points - An array of points with {x, y}.
 * @returns {number} - The area of the polygon.
 */
function polygonArea(points) {
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
}

module.exports = {
    distance,
    polygonArea
};
// Asserts for distance function
const assert = require('assert');

assert.strictEqual(distance({x: 0, y: 0}, {x: 3, y: 4}), 5);
assert.strictEqual(distance({x: 1, y: 1}, {x: 4, y: 5}), 5);
assert.strictEqual(distance({x: -1, y: -1}, {x: 1, y: 1}), Math.sqrt(8));

// Asserts for polygonArea function
assert.strictEqual(polygonArea([{x: 0, y: 0}, {x: 4, y: 0}, {x: 4, y: 3}, {x: 0, y: 3}]), 12);
assert.strictEqual(polygonArea([{x: 0, y: 0}, {x: 5, y: 0}, {x: 5, y: 5}, {x: 0, y: 5}]), 25);
assert.strictEqual(polygonArea([{x: 0, y: 0}, {x: 3, y: 0}, {x: 3, y: 4}, {x: 0, y: 4}]), 12);
