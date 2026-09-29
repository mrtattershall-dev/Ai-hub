// r4_geom.js - Geometric utilities

// Calculate Euclidean distance between two points
function distance(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Calculate area of a simple polygon given its vertices in order
function polygonArea(points) {
    if (points.length < 3) return 0;
    
    let area = 0;
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    
    return Math.abs(area) / 2;
}

// Calculate the perimeter of a closed polygon
function perimeter(points) {
    if (points.length < 2) return 0;
    
    let total = 0;
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        total += distance(points[i], points[j]);
    }
    
    return total;
}

// Calculate the centroid (center of mass) of a polygon's area
function centroid(points) {
    if (points.length < 3) {
        throw new Error("A polygon must have at least 3 vertices to calculate centroid");
    }
    
    let cx = 0;
    let cy = 0;
    let area = 0;
    
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        
        const cross = points[i].x * points[j].y - points[j].x * points[i].y;
        area += cross;
        
        cx += (points[i].x + points[j].x) * cross;
        cy += (points[i].y + points[j].y) * cross;
    }
    
    area = Math.abs(area) / 2;
    
    if (area === 0) {
        throw new Error("Cannot calculate centroid of a polygon with zero area");
    }
    
    cx = cx / (6 * area);
    cy = cy / (6 * area);
    
    return { x: cx, y: cy };
}

// Calculate the bounding box of a set of points
function boundingBox(points) {
    if (points.length === 0) {
        throw new Error("Cannot calculate bounding box of an empty set of points");
    }
    
    let minX = points[0].x;
    let minY = points[0].y;
    let maxX = points[0].x;
    let maxY = points[0].y;
    
    for (let i = 1; i < points.length; i++) {
        const point = points[i];
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.y > maxY) maxY = point.y;
    }
    
    return { minX, minY, maxX, maxY };
}

// Determine if a point is inside a polygon using ray casting algorithm
function pointInPolygon(p, points) {
    // If we have less than 3 points, it's not a valid polygon
    if (points.length < 3) {
        return false;
    }
    
    let inside = false;
    
    // Ray casting algorithm
    // We cast a ray from point p to the right (positive x direction)
    // and count how many times it intersects with polygon edges
    const n = points.length;
    let p1 = points[0];
    
    for (let i = 1; i <= n; i++) {
        const p2 = points[i % n];
        
        // Check if point p is on the edge
        if (isPointOnLineSegment(p, p1, p2)) {
            return true;
        }
        
        // Check if ray intersects with edge
        if (((p1.y > p.y) !== (p2.y > p.y)) &&
            (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
            inside = !inside;
        }
        
        p1 = p2;
    }
    
    return inside;
}

// Helper function to check if a point is on a line segment
function isPointOnLineSegment(p, p1, p2) {
    // Check if point p is collinear with p1 and p2
    const crossProduct = (p.y - p1.y) * (p2.x - p1.x) - (p.x - p1.x) * (p2.y - p1.y);
    if (Math.abs(crossProduct) > Number.EPSILON) {
        return false;
    }
    
    // Check if point p is within the bounding box of the line segment
    const dotProduct = (p.x - p1.x) * (p2.x - p1.x) + (p.y - p1.y) * (p2.y - p1.y);
    if (dotProduct < 0) {
        return false;
    }
    
    const squaredLength = (p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y);
    if (dotProduct > squaredLength) {
        return false;
    }
    
    return true;
}

// Calculate the convex hull of a set of points using Graham scan algorithm
function convexHull(points) {
    if (points.length < 3) {
        return points.slice(); // Return a copy of the points array
    }
    
    // Find the point with the lowest y-coordinate (and lowest x if tie)
    let start = 0;
    for (let i = 1; i < points.length; i++) {
        if (points[i].y < points[start].y || 
            (points[i].y === points[start].y && points[i].x < points[start].x)) {
            start = i;
        }
    }
    
    // Swap the starting point to the first position
    [points[0], points[start]] = [points[start], points[0]];
    
    // Sort points by polar angle with respect to the starting point
    const sortedPoints = points.slice(1);
    sortedPoints.sort((a, b) => {
        const cross = (a.y - points[0].y) * (b.x - points[0].x) - (a.x - points[0].x) * (b.y - points[0].y);
        if (cross === 0) {
            // If collinear, sort by distance from the starting point
            const distA = (a.x - points[0].x) ** 2 + (a.y - points[0].y) ** 2;
            const distB = (b.x - points[0].x) ** 2 + (b.y - points[0].y) ** 2;
            return distA - distB;
        }
        return cross > 0 ? -1 : 1; // Counter-clockwise order
    });
    
    // Add the starting point back to the beginning
    const hullPoints = [points[0], ...sortedPoints];
    
    // Graham scan algorithm
    const stack = [hullPoints[0], hullPoints[1], hullPoints[2]];
    
    for (let i = 3; i < hullPoints.length; i++) {
        let top = stack.length - 1;
        let nextToTop = stack.length - 2;
        
        // Keep removing points from stack while the orientation of the triplet
        // (stack[nextToTop], stack[top], hullPoints[i]) is not counterclockwise
        while (stack.length > 2 && 
               crossProduct(stack[nextToTop], stack[top], hullPoints[i]) <= 0) {
            stack.pop();
            top = stack.length - 1;
            nextToTop = stack.length - 2;
        }
        
        stack.push(hullPoints[i]);
    }
    
    // Remove duplicate points that lie on the same edge
    const result = [];
    for (let i = 0; i < stack.length; i++) {
        const current = stack[i];
        const next = stack[(i + 1) % stack.length];
        const prev = stack[(i - 1 + stack.length) % stack.length];
        
        // Check if current point lies on the edge between prev and next
        const cross = crossProduct(prev, current, next);
        if (cross !== 0) {
            result.push(current);
        }
    }
    
    return result;
}

// Helper function to calculate cross product of three points
function crossProduct(p1, p2, p3) {
    return (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);
}

/**
 * Translates a set of points by dx and dy
 * @param {Array<{x: number, y: number}>} points - Array of point objects
 * @param {number} dx - X translation
 * @param {number} dy - Y translation
 * @returns {Array<{x: number, y: number}>} New array with translated points
 */
function translate(points, dx, dy) {
    return points.map(point => ({ x: point.x + dx, y: point.y + dy }));
}

/**
 * Scales a set of points by a factor around an origin point
 * @param {Array<{x: number, y: number}>} points - Array of point objects
 * @param {number} factor - Scaling factor
 * @param {{x: number, y: number}} origin - Origin point for scaling (default: {x: 0, y: 0})
 * @returns {Array<{x: number, y: number}>} New array with scaled points
 */
function scale(points, factor, origin = {x: 0, y: 0}) {
    return points.map(point => ({
        x: origin.x + (point.x - origin.x) * factor,
        y: origin.y + (point.y - origin.y) * factor
    }));
}

// Export functions for use in other modules
module.exports = {
    distance,
    polygonArea,
    perimeter,
    centroid,
    boundingBox,
    pointInPolygon,
    convexHull,
    translate,
    scale
};