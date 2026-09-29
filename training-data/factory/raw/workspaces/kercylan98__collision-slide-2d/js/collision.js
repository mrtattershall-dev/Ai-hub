/**
 * Collision Detection - 碰撞检测算法
 * 参考 Go 代码: calcutils/collision.go
 */

const EPSILON = 1e-10;

/**
 * 多边形类
 */
class Polygon {
    constructor(vertices) {
        this.vertices = vertices; // Vector2D 数组
    }

    // 获取顶点（支持循环索引）
    getVertex(index) {
        const i = ((index % this.vertices.length) + this.vertices.length) % this.vertices.length;
        return this.vertices[i];
    }

    // 获取边的法向量
    getEdgeNormal(index) {
        const v1 = this.getVertex(index);
        const v2 = this.getVertex(index + 1);
        const edge = v2.sub(v1);
        // 法向量是边向量逆时针旋转90度
        const normal = new Vector2D(-edge.y, edge.x);
        return normal.normalize();
    }

    // 获取中心点
    getCenter() {
        let sumX = 0, sumY = 0;
        for (const v of this.vertices) {
            sumX += v.x;
            sumY += v.y;
        }
        return new Vector2D(sumX / this.vertices.length, sumY / this.vertices.length);
    }

    // 获取边界框
    getBounds() {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        for (const v of this.vertices) {
            minX = Math.min(minX, v.x);
            minY = Math.min(minY, v.y);
            maxX = Math.max(maxX, v.x);
            maxY = Math.max(maxY, v.y);
        }
        return {
            min: new Vector2D(minX, minY),
            max: new Vector2D(maxX, maxY)
        };
    }
}

/**
 * 点在多边形内检测（射线法）
 * 参考 collision.go:15-37
 */
function pointInPolygon(point, polygon) {
    if (polygon.vertices.length < 3) {
        return false;
    }

    let inside = false;
    const n = polygon.vertices.length;

    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const v1 = polygon.vertices[i];
        const v2 = polygon.vertices[j];

        if (((v1.y > point.y) !== (v2.y > point.y)) &&
            (point.x < (v2.x - v1.x) * (point.y - v1.y) / (v2.y - v1.y) + v1.x)) {
            inside = !inside;
        }
    }

    return inside;
}

/**
 * 计算点到线段的最近点
 * 参考 collision.go:102-116
 */
function closestPointOnSegment(point, segmentStart, segmentEnd) {
    const segment = segmentEnd.sub(segmentStart);
    const toPoint = point.sub(segmentStart);

    const segmentLengthSq = segment.lengthSquared();
    if (segmentLengthSq < EPSILON) {
        return segmentStart; // 线段退化为点
    }

    let t = toPoint.dot(segment) / segmentLengthSq;
    t = clamp(t, 0, 1); // 限制在线段范围内

    return segmentStart.add(segment.mul(t));
}

/**
 * 计算点到多边形的最近点
 * 参考 collision.go:76-100
 */
function closestPointOnPolygon(point, polygon) {
    if (polygon.vertices.length === 0) {
        return point;
    }

    let minDistSq = Infinity;
    let closestPoint = polygon.vertices[0];

    for (let i = 0; i < polygon.vertices.length; i++) {
        const v1 = polygon.getVertex(i);
        const v2 = polygon.getVertex(i + 1);

        const closest = closestPointOnSegment(point, v1, v2);
        const distSq = point.distanceSquared(closest);

        if (distSq < minDistSq) {
            minDistSq = distSq;
            closestPoint = closest;
        }
    }

    return closestPoint;
}

/**
 * AABB快速排斥检测（性能优化）
 */
function aabbQuickReject(center, radius, polygon) {
    const bounds = polygon.getBounds();
    
    // 快速排除明显不碰撞的情况
    if (center.x + radius < bounds.min.x) return true;
    if (center.x - radius > bounds.max.x) return true;
    if (center.y + radius < bounds.min.y) return true;
    if (center.y - radius > bounds.max.y) return true;
    
    return false; // 可能碰撞，需要详细检测
}

/**
 * 圆形与多边形碰撞检测（优化版）
 * 参考 collision.go:236-278
 */
function circlePolygonCollision(center, radius, polygon) {
    const result = {
        isColliding: false,
        penetration: 0,
        normal: new Vector2D(0, 0),
        contactPoint: new Vector2D(0, 0)
    };

    // AABB快速排斥（性能优化：50-70%的情况可以快速跳过）
    if (aabbQuickReject(center, radius, polygon)) {
        return result;
    }

    // 首先检查圆心是否在多边形内部
    if (pointInPolygon(center, polygon)) {
        result.isColliding = true;

        // 找到圆心到多边形边界的最近点
        const closestPoint = closestPointOnPolygon(center, polygon);
        const distance = center.distance(closestPoint);
        result.penetration = radius + distance;
        result.contactPoint = closestPoint;

        // 法向量从圆心指向最近点（向外）
        if (distance > EPSILON) {
            result.normal = closestPoint.sub(center).normalize();
        } else {
            result.normal = findNearestEdgeNormal(center, polygon);
        }

        return result;
    }

    // 圆心在多边形外部，找到圆心到多边形的最近点
    const closestPoint = closestPointOnPolygon(center, polygon);
    const distance = center.distance(closestPoint);

    if (distance <= radius) {
        result.isColliding = true;
        result.penetration = radius - distance;
        result.contactPoint = closestPoint;
        result.normal = center.sub(closestPoint).normalize();
    }

    return result;
}

/**
 * 找到最近边的法向量
 */
function findNearestEdgeNormal(point, polygon) {
    let minDist = Infinity;
    let normal = new Vector2D(0, 0);

    for (let i = 0; i < polygon.vertices.length; i++) {
        const v1 = polygon.getVertex(i);
        const v2 = polygon.getVertex(i + 1);

        const closest = closestPointOnSegment(point, v1, v2);
        const dist = point.distance(closest);

        if (dist < minDist) {
            minDist = dist;
            normal = polygon.getEdgeNormal(i);
        }
    }

    return normal;
}

/**
 * 线段相交检测
 * 参考 collision.go:301-320
 */
function lineSegmentIntersection(p1, p2, p3, p4) {
    const d1 = p2.sub(p1);
    const d2 = p4.sub(p3);

    const cross = d1.cross(d2);
    if (Math.abs(cross) < EPSILON) {
        return { intersects: false, point: null }; // 平行线段
    }

    const t1 = p3.sub(p1).cross(d2) / cross;
    const t2 = p3.sub(p1).cross(d1) / cross;

    if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
        const intersection = p1.add(d1.mul(t1));
        return { intersects: true, point: intersection };
    }

    return { intersects: false, point: null };
}

/**
 * 圆形沿路径移动与线段的碰撞检测
 * 参考 collision.go:436-502
 */
function circlePathSegmentCollision(startPos, endPos, radius, segStart, segEnd) {
    const pathVec = endPos.sub(startPos);
    const pathLength = pathVec.length();
    
    if (pathLength < EPSILON) {
        const closest = closestPointOnSegment(startPos, segStart, segEnd);
        const dist = startPos.sub(closest).length();
        if (dist <= radius) {
            return { time: 0, point: startPos, hasCollision: true };
        }
        return { time: 0, point: null, hasCollision: false };
    }

    let minTime = 1.0;
    let collisionPoint = null;
    let hasCollision = false;

    // 使用密集采样来确保不遗漏碰撞
    const steps = Math.max(100, Math.floor(pathLength / radius * 10));
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const circleCenter = startPos.lerp(endPos, t);

        // 找到线段上距离圆心最近的点
        const closest = closestPointOnSegment(circleCenter, segStart, segEnd);
        const dist = circleCenter.sub(closest).length();

        if (dist <= radius && t < minTime) {
            minTime = t;
            collisionPoint = circleCenter;
            hasCollision = true;
            break; // 找到第一个碰撞点就退出
        }
    }

    return { time: minTime, point: collisionPoint, hasCollision };
}

/**
 * 圆形路径与多边形碰撞检测（核心算法！）
 * 参考 collision.go:538-598
 */
function circlePathPolygonCollision(startPos, endPos, radius, polygon) {
    const result = {
        isColliding: false,
        collisionTime: 0,
        collisionPoint: new Vector2D(0, 0),
        normal: new Vector2D(0, 0),
        safePosition: endPos.clone()
    };

    // 检查起点是否在多边形内（考虑圆形半径）
    const startCollision = circlePolygonCollision(startPos, radius, polygon);
    if (startCollision.isColliding) {
        result.isColliding = true;
        result.collisionTime = 0;
        result.collisionPoint = startPos.clone();
        result.normal = startCollision.normal;
        result.safePosition = startPos.clone();
        return result;
    }

    // 检查终点是否在多边形内
    const endCollision = circlePolygonCollision(endPos, radius, polygon);
    if (endCollision.isColliding) {
        // 使用二分法找到精确的碰撞时间
        const collisionTime = findCirclePathCollisionTime(startPos, endPos, radius, polygon);
        result.isColliding = true;
        result.collisionTime = collisionTime;
        result.collisionPoint = startPos.lerp(endPos, collisionTime);
        result.normal = endCollision.normal;
        result.safePosition = startPos.lerp(endPos, Math.max(0, collisionTime - 0.001));
        return result;
    }

    // 检查圆形路径是否与多边形的每条边相交
    let minTime = 1.0;
    let collisionPoint = null;
    let normal = new Vector2D(0, 0);

    for (let i = 0; i < polygon.vertices.length; i++) {
        const v1 = polygon.getVertex(i);
        const v2 = polygon.getVertex(i + 1);

        const segCollision = circlePathSegmentCollision(startPos, endPos, radius, v1, v2);
        if (segCollision.hasCollision && segCollision.time < minTime) {
            minTime = segCollision.time;
            collisionPoint = segCollision.point;
            normal = polygon.getEdgeNormal(i);
            result.isColliding = true;
        }
    }

    if (result.isColliding) {
        result.collisionTime = minTime;
        result.collisionPoint = collisionPoint;
        result.normal = normal;
        result.safePosition = startPos.lerp(endPos, Math.max(0, minTime - 0.001));
    }

    return result;
}

/**
 * 使用二分法找到圆形路径与多边形的碰撞时间
 */
function findCirclePathCollisionTime(startPos, endPos, radius, polygon) {
    let left = 0.0, right = 1.0;
    let iterations = 0;
    const maxIterations = 20;

    while (right - left > 0.001 && iterations < maxIterations) {
        const mid = (left + right) * 0.5;
        const midPos = startPos.lerp(endPos, mid);

        const collision = circlePolygonCollision(midPos, radius, polygon);
        if (collision.isColliding) {
            right = mid;
        } else {
            left = mid;
        }
        iterations++;
    }

    return (left + right) * 0.5;
}

