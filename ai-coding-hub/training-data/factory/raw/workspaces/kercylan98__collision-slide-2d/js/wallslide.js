/**
 * Wall Slide - 墙面滑行算法
 * 参考 Go 代码: typedefines/player_2d.go (1150-1396行)
 */

/**
 * 碰撞信息结构
 */
class CollisionInfo {
    constructor(normal, separationVector, penetration) {
        this.normal = normal;               // 碰撞法向量
        this.separationVector = separationVector; // 分离向量
        this.penetration = penetration;     // 穿透深度
    }
}

/**
 * 检测碰撞并获取分离向量
 * 参考 player_2d.go:1322-1360
 */
function detectCollisionAndGetSeparationVector(startPos, targetPos, radius, obstacles) {
    let bestCollision = null;
    let minDistanceToCollision = Infinity;

    for (const obstacle of obstacles) {
        // 首先检查路径碰撞
        const pathResult = circlePathPolygonCollision(startPos, targetPos, radius, obstacle);
        if (pathResult.isColliding) {
            // 计算到碰撞点的距离
            const distanceToCollision = startPos.distance(pathResult.collisionPoint);

            // 记录最近的碰撞
            if (distanceToCollision < minDistanceToCollision) {
                minDistanceToCollision = distanceToCollision;

                // 计算法向量（从碰撞点指向多边形外部）
                const normal = pathResult.normal.normalize();

                // 计算分离向量（推出玩家到安全位置）
                const separationDistance = radius * 1.1; // 添加安全边距
                const separationVector = normal.mul(separationDistance);

                bestCollision = new CollisionInfo(
                    normal,
                    separationVector,
                    radius // 使用玩家半径作为穿透深度
                );
            }
        }
    }

    return bestCollision;
}

/**
 * 计算墙面滑行向量
 * 参考 player_2d.go:1362-1396
 * 
 * 核心原理：
 * 1. 将输入向量分解为垂直和平行于墙面的两个分量
 * 2. 移除垂直分量（撞墙的部分）
 * 3. 保留平行分量（沿墙滑行的部分）
 * 4. 公式：slideVector = inputDirection - (inputDirection · normal) * normal
 */
function calculateWallSlideVector(inputDirection, wallNormal, originalDistance) {
    // 确保法向量是单位向量
    wallNormal = wallNormal.normalize();

    // 计算输入向量在墙面法向量上的投影（垂直分量）
    const normalProjection = inputDirection.dot(wallNormal);

    // 如果移动方向远离墙面，不需要滑行
    if (normalProjection >= 0) {
        return null;
    }

    // 计算平行于墙面的滑行向量
    // slideVector = inputDirection - (inputDirection · normal) * normal
    let slideVector = inputDirection.sub(wallNormal.mul(normalProjection));

    // 计算滑行向量的长度（平行于墙面的分量）
    const slideLength = slideVector.length();
    if (slideLength > 0) {
        // 保持90-95%的滑行分量，提供非常丝滑的感觉
        const slideSpeedMultiplier = 0.95;
        slideVector = slideVector.normalize().mul(slideLength * originalDistance * slideSpeedMultiplier);
        return slideVector;
    }

    return null;
}

/**
 * 尝试墙面滑行移动（简化版本）
 * 参考 player_2d.go:1150-1295
 * 
 * 多策略尝试：
 * 1. 基于碰撞法向量的精确滑行
 * 2. 角度扫描（从小角度到大角度）
 * 3. 沿原方向的部分移动
 */
function tryWallSlideMovement(startPos, targetPos, radius, obstacles) {
    // 首先检查起始位置是否安全
    if (!validatePosition(startPos, radius, obstacles)) {
        // 起始位置不安全，返回起始位置（简化处理）
        return startPos;
    }

    // 检查目标位置是否安全且路径无碰撞
    if (validatePosition(targetPos, radius, obstacles) && 
        !checkPathCollision(startPos, targetPos, radius, obstacles)) {
        return targetPos;
    }

    // 计算移动方向和距离
    const moveDirection = targetPos.sub(startPos);
    const moveDistance = moveDirection.length();

    if (moveDistance === 0) {
        return startPos;
    }

    const direction = moveDirection.normalize();

    // 策略1: 基于向量投影的精确墙面滑行（主策略）
    const collisionInfo = detectCollisionAndGetSeparationVector(startPos, targetPos, radius, obstacles);
    if (collisionInfo) {
        // 计算平行于墙面的滑行向量
        const slideVector = calculateWallSlideVector(direction, collisionInfo.normal, moveDistance);
        if (slideVector) {
            // 尝试不同强度的滑行（从100%到30%）
            for (let ratio = 1.0; ratio >= 0.3; ratio -= 0.1) {
                const scaledSlideVector = slideVector.mul(ratio);
                const finalPos = startPos.add(scaledSlideVector);

                // 验证最终移动方向的角度是否合理（放宽到90度）
                const finalDirection = finalPos.sub(startPos);
                if (finalDirection.length() > 0) {
                    const originalAngle = Math.atan2(direction.y, direction.x);
                    const finalAngle = Math.atan2(finalDirection.y, finalDirection.x);
                    let angleDiff = Math.abs(finalAngle - originalAngle);
                    if (angleDiff > Math.PI) {
                        angleDiff = 2 * Math.PI - angleDiff;
                    }
                    
                    // 放宽角度限制到90度
                    if (angleDiff <= 90 * DEG_TO_RAD) {
                        // 验证最终位置的安全性
                        if (validatePosition(finalPos, radius, obstacles) &&
                            !checkPathCollision(startPos, finalPos, radius, obstacles)) {
                            return finalPos;
                        }
                    }
                }
            }
        }
    }

    // 策略2: 连续角度扫描（备用方案）
    const maxSlideDistance = moveDistance * 0.9;

    // 从5度开始，每次增加5度，最大到70度
    for (let angleMagnitude = 5.0; angleMagnitude <= 70.0; angleMagnitude += 5.0) {
        // 尝试正负两个方向
        for (const sign of [1.0, -1.0]) {
            const angleOffset = angleMagnitude * sign;
            const slideAngle = Math.atan2(direction.y, direction.x) + angleOffset * DEG_TO_RAD;
            const slideDirection = new Vector2D(Math.cos(slideAngle), Math.sin(slideAngle));

            // 尝试不同的滑行距离（从大到小）
            for (let distRatio = 1.0; distRatio >= 0.5; distRatio -= 0.1) {
                const slideDistance = maxSlideDistance * distRatio;
                const slidePos = startPos.add(slideDirection.mul(slideDistance));

                // 检查滑行位置是否安全且路径无碰撞
                if (validatePosition(slidePos, radius, obstacles) &&
                    !checkPathCollision(startPos, slidePos, radius, obstacles)) {
                    // 额外验证：确保滑行角度不会偏离太多
                    const actualSlideDir = slidePos.sub(startPos);
                    const actualAngle = Math.atan2(actualSlideDir.y, actualSlideDir.x);
                    const originalAngle = Math.atan2(direction.y, direction.x);
                    let angleDiff = Math.abs(actualAngle - originalAngle);
                    if (angleDiff > Math.PI) {
                        angleDiff = 2 * Math.PI - angleDiff;
                    }
                    
                    // 限制最大角度偏差为85度
                    if (angleDiff <= 85 * DEG_TO_RAD) {
                        return slidePos;
                    }
                }
            }
        }
    }

    // 策略3: 沿原方向的部分移动
    for (let ratio = 0.8; ratio >= 0.2; ratio -= 0.1) {
        const partialPos = startPos.add(direction.mul(moveDistance * ratio));
        if (validatePosition(partialPos, radius, obstacles) &&
            !checkPathCollision(startPos, partialPos, radius, obstacles)) {
            return partialPos;
        }
    }

    // 所有策略都失败，返回起始位置
    return startPos;
}

/**
 * 验证位置是否安全（不与障碍物碰撞）
 */
function validatePosition(position, radius, obstacles) {
    for (const obstacle of obstacles) {
        const collision = circlePolygonCollision(position, radius, obstacle);
        if (collision.isColliding) {
            return false;
        }
    }
    return true;
}

/**
 * 检查路径是否发生碰撞
 */
function checkPathCollision(startPos, endPos, radius, obstacles) {
    for (const obstacle of obstacles) {
        const result = circlePathPolygonCollision(startPos, endPos, radius, obstacle);
        if (result.isColliding) {
            return true;
        }
    }
    return false;
}

