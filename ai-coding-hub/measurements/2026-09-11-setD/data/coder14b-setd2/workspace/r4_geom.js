// r4_geom.js

/**
 * Calculate the distance between two points.
 * @param {Object} a - Point A with {x, y}.
 * @param {Object} b - Point B with {x, y}.
 * @returns {number} - The distance between points A and B.
 */
function distance(a, b) {
  if (typeof a !== 'object' || typeof b !== 'object' || typeof a.x !== 'number' || typeof a.y !== 'number' || typeof b.x !== 'number' || typeof b.y !== 'number' || !isFinite(a.x) || !isFinite(a.y) || !isFinite(b.x) || !isFinite(b.y)) {
    throw new Error('Both points must be objects with finite numeric x and y');
  }
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));


// Export the distance function
module.exports = {
    distance
};
/**
 * Calculate the area of a simple polygon given its corners in order.
 * @param {Array<Object>} points - Array of points with {x, y}.
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

// Export the polygonArea function
module.exports.polygonArea = polygonArea;
// Assertions to test the distance function
const assert = require('assert');

// Test distance function
assert.strictEqual(distance({x: 0, y: 0}, {x: 3, y: 4}), 5);
assert.strictEqual(distance({x: 1, y: 1}, {x: 4, y: 5}), 5);
assert.strictEqual(distance({x: -1, y: -1}, {x: 2, y: 3}), 5);

// Assertions to test the polygonArea function
// Test polygonArea function with a square
const squarePoints = [{x: 0, y: 0}, {x: 4, y: 0}, {x: 4, y: 4}, {x: 0, y: 4}];
assert.strictEqual(polygonArea(squarePoints), 16);

// Test polygonArea function with a triangle
const trianglePoints = [{x: 0, y: 0}, {x: 4, y: 0}, {x: 2, y: 3}];
assert.strictEqual(polygonArea(trianglePoints), 6);

console.log("All tests passed!");
/**
 * Calculate the perimeter of a polygon given its points.
 * @param {Array} points - An array of objects with x and y properties representing the vertices of the polygon.
 * @returns {number} The perimeter of the polygon.
 */
function perimeter(points) {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    total += distance(current, next);
  }
  return total;
}
/**
 * Calculate the centroid of a polygon given its points.
 * @param {Array} points - An array of objects with x and y properties representing the vertices of the polygon.
 * @returns {Object} The centroid of the polygon as {x, y}.
 * @throws {Error} If the polygon has zero area.
 */
function centroid(points) {
    const area = polygonArea(points);
    if (area === 0) {
        throw new Error("Polygon has zero area");
    }

    let cx = 0;
    let cy = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        cx += (points[i].x + points[j].x) * (points[i].x * points[j].y - points[j].x * points[i].y);
        cy += (points[i].y + points[j].y) * (points[i].x * points[j].y - points[j].x * points[i].y);
    }
    cx /= 6 * area;
    cy /= 6 * area;

    return { x: cx, y: cy };
}

module.exports.centroid = centroid;
function boundingBox(points) {
    if (points.length === 0) {
        throw new Error("Empty list of points");
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let point of points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    }

    return { minX, minY, maxX, maxY };
}

module.exports.boundingBox = boundingBox;
function pointInPolygon(p, points) {
    const x = p.x;
    const y = p.y;
    let inside = false;

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x;
        const yi = points[i].y;
        const xj = points[j].x;
        const yj = points[j].y;

        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
}

module.exports.pointInPolygon = pointInPolygon;
function convexHull(points) {
    if (points.length < 3) {
        throw new Error("At least three points are required to form a convex hull");
    }

    // Sort points by x-coordinate, and by y-coordinate if x-coordinates are equal
    points.sort((a, b) => {
        if (a.x === b.x) {
            return a.y - b.y;
        }
        return a.x - b.x;
    });

    const lowerHull = [];
    const upperHull = [];

    // Build lower hull
    for (let point of points) {
        while (lowerHull.length >= 2 && orientation(lowerHull[lowerHull.length - 2], lowerHull[lowerHull.length - 1], point) <= 0) {
            lowerHull.pop();
        }
        lowerHull.push(point);
    }

    // Build upper hull
    for (let i = points.length - 1; i >= 0; i--) {
        let point = points[i];
        while (upperHull.length >= 2 && orientation(upperHull[upperHull.length - 2], upperHull[upperHull.length - 1], point) <= 0) {
            upperHull.pop();
        }
        upperHull.push(point);
    }

    // Combine lower and upper hulls
    const hull = lowerHull.concat(upperHull);
    hull.pop(); // Remove the last point which is repeated in both hulls

    return hull;
}

function orientation(p, q, r) {
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (val === 0) {
        return 0; // Collinear
    }
    return (val > 0) ? 1 : 2; // Clockwise or Counterclockwise
}

module.exports.convexHull = convexHull;
/**
 * Translate a set of points by a given offset.
 * @param {Array<Object>} points - Array of points with {x, y}.
 * @param {number} dx - Horizontal offset.
 * @param {number} dy - Vertical offset.
 * @returns {Array<Object>} - New array of translated points.
 */
function translate(points, dx, dy) {
    return points.map(point => ({ x: point.x + dx, y: point.y + dy }));
}

module.exports.translate = translate;
/**
 * Scale a set of points by a given factor around an origin.
 * @param {Array<Object>} points - Array of points with {x, y}.
 * @param {number} factor - Scaling factor.
 * @param {Object} origin - Origin point with {x, y}. Defaults to {x: 0, y: 0}.
 * @returns {Array<Object>} - New array of scaled points.
 */
function scale(points, factor, origin = { x: 0, y: 0 }) {
    return points.map(point => ({
        x: origin.x + (point.x - origin.x) * factor,
        y: origin.y + (point.y - origin.y) * factor
    }));
}

module.exports.scale = scale;
/**
 * Determines if a polygon is convex.
 * @param {Array} points - An array of points representing the polygon's corners.
 * @returns {boolean} - True if the polygon is convex, false otherwise.
 */
function isConvex(points) {
    const n = points.length;
    if (n < 3) return false;

    let orientation = 0;

    for (let i = 0; i < n; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % n];
        const p3 = points[(i + 2) % n];

        const o = orientation(p1, p2, p3);

        if (orientation === 0) {
            orientation = o;
        } else if (orientation !== o) {
            return false;
        }
    }

    return true;
}

module.exports.isConvex = isConvex;

function testIsConvex() {
    const convexPoints = [{x: 0, y: 0}, {x: 4, y: 0}, {x: 4, y: 4}, {x: 0, y: 4}];
    const concavePoints = [{x: 0, y: 0}, {x: 4, y: 0}, {x: 2, y: 3}, {x: 0, y: 4}];

    console.log("Convex points:", isConvex(convexPoints)); // Expected: true
    console.log("Concave points:", isConvex(concavePoints)); // Expected: false
}

testIsConvex();

function testIsConvex() {
    const convexPoints = [{x: 0, y: 0}, {x: 4, y: 0}, {x: 4, y: 4}, {x: 0, y: 4}];
    const concavePoints = [{x: 0, y: 0}, {x: 4, y: 0}, {x: 2, y: 3}, {x: 0, y: 4}];

    console.log("Convex points:", isConvex(convexPoints)); // Expected: true
    console.log("Concave points:", isConvex(concavePoints)); // Expected: false
}

testIsConvex();
/**
 * Rotate a set of points counter-clockwise by a given number of degrees around an origin.
 * @param {Array<Object>} points - Array of points with {x, y}.
 * @param {number} degrees - Degrees to rotate.
 * @param {Object} origin - Origin point with {x, y}. Defaults to {x: 0, y: 0}.
 * @returns {Array<Object>} - New array of rotated points.
 */
function rotate(points, degrees, origin = { x: 0, y: 0 }) {
    const radians = (degrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    return points.map(point => ({
        x: origin.x + (point.x - origin.x) * cos - (point.y - origin.y) * sin,
        y: origin.y + (point.x - origin.x) * sin + (point.y - origin.y) * cos
    }));
}

module.exports.rotate = rotate;
