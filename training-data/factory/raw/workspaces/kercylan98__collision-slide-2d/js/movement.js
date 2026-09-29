/**
 * Movement Engine - 移动计算引擎
 * 参考 Go 代码: typedefines/player_2d.go (282-326行)
 * 
 * 核心设计：基于时间的确定性移动计算
 * 只需要知道：起始位置、移动方向、移动速度、时间差
 * 就能精确计算出任意时间后的位置，即使时间差是几分钟、几小时
 */

/**
 * 玩家状态
 */
class PlayerState {
    constructor(position, angle, moveSpeed, isMoving = true) {
        this.position = position;      // 起始位置（Vector2D）
        this.angle = angle;            // 移动方向（度数，0°为向右）
        this.moveSpeed = moveSpeed;    // 移动速度（单位/秒）
        this.isMoving = isMoving;      // 是否在移动
    }
}

/**
 * 移动轨迹点
 */
class TrajectoryPoint {
    constructor(time, position, eventType = 'move') {
        this.time = time;              // 时间点（秒）
        this.position = position;      // 位置（Vector2D）
        this.eventType = eventType;    // 事件类型：'move', 'collision', 'slide'
        this.metadata = {};            // 额外元数据
    }
}

/**
 * 移动计算引擎
 */
class MovementEngine {
    constructor(playerRadius = 25) {
        this.playerRadius = playerRadius;  // 玩家碰撞半径
        this.obstacles = [];               // 障碍物列表
        this.spatialGrid = new SpatialGrid(200); // 空间网格加速
        this.useSpatialOptimization = true; // 是否使用空间优化
    }

    /**
     * 设置障碍物
     */
    setObstacles(obstacles) {
        this.obstacles = obstacles;
        // 重建空间网格
        if (this.useSpatialOptimization) {
            this.spatialGrid.build(obstacles);
        }
    }

    /**
     * 获取某个位置附近的障碍物
     */
    getNearbyObstacles(x, y) {
        if (!this.useSpatialOptimization) {
            return this.obstacles;
        }

        const indices = this.spatialGrid.query(x, y);
        return indices.map(i => this.obstacles[i]).filter(obs => obs !== undefined);
    }

    /**
     * 获取路径经过的障碍物
     */
    getPathObstacles(startPos, endPos) {
        if (!this.useSpatialOptimization) {
            return this.obstacles;
        }

        const indices = this.spatialGrid.queryPath(
            startPos.x, startPos.y,
            endPos.x, endPos.y
        );
        return indices.map(i => this.obstacles[i]).filter(obs => obs !== undefined);
    }

    /**
     * 计算实际位置（核心算法！优化版）
     * 参考 player_2d.go:282-326
     * 
     * 性能优化：使用空间网格只检测附近的障碍物
     */
    calculateActualPosition(playerState, timeDelta) {
        const lastPos = playerState.position;

        // 如果玩家没有移动，返回原位置
        if (!playerState.isMoving) {
            return lastPos;
        }

        // 计算移动方向
        const angleRad = playerState.angle * DEG_TO_RAD;
        const direction = new Vector2D(Math.cos(angleRad), Math.sin(angleRad));

        // 计算移动距离（核心公式：距离 = 速度 × 时间）
        const moveDistance = playerState.moveSpeed * timeDelta;

        // 计算目标位置
        const targetPos = lastPos.add(direction.mul(moveDistance));

        // 获取路径附近的障碍物（空间优化！）
        const nearbyObstacles = this.getPathObstacles(lastPos, targetPos);

        // 检查路径是否有碰撞
        const hasCollision = checkPathCollision(lastPos, targetPos, this.playerRadius, nearbyObstacles);
        if (!hasCollision) {
            return targetPos;
        }

        // 有碰撞时，尝试墙面滑行
        const slideResult = tryWallSlideMovement(
            lastPos, 
            targetPos, 
            this.playerRadius, 
            nearbyObstacles
        );

        // 验证滑行结果是否安全
        if (slideResult && !slideResult.equals(lastPos)) {
            if (validatePosition(slideResult, this.playerRadius, nearbyObstacles)) {
                return slideResult;
            }
        }

        return lastPos;
    }

    /**
     * 计算完整轨迹（优化版：修复闪现问题）
     * 从时间0到maxTime，采样计算每个时间点的位置
     * 
     * @param {PlayerState} playerState - 玩家初始状态
     * @param {number} maxTime - 最大时间（秒）
     * @param {number} sampleInterval - 采样间隔（秒），默认0.1秒
     * @returns {Array<TrajectoryPoint>} 轨迹点数组
     */
    calculateTrajectory(playerState, maxTime, sampleInterval = 0.1) {
        const trajectory = [];
        let currentState = new PlayerState(
            playerState.position.clone(),
            playerState.angle,
            playerState.moveSpeed,
            playerState.isMoving
        );

        // 起点
        trajectory.push(new TrajectoryPoint(0, currentState.position.clone(), 'start'));

        if (!playerState.isMoving) {
            return trajectory;
        }

        let currentTime = 0;
        let lastEventType = 'start';
        
        // 逐段计算轨迹
        while (currentTime < maxTime) {
            // 动态调整采样间隔：碰撞附近使用更小的间隔
            let adaptiveSampleInterval = sampleInterval;
            if (lastEventType === 'collision' || lastEventType === 'slide') {
                adaptiveSampleInterval = sampleInterval * 0.5; // 碰撞附近加密采样
            }
            
            const deltaTime = Math.min(adaptiveSampleInterval, maxTime - currentTime);
            
            // 计算下一个位置
            const nextPosition = this.calculateActualPosition(currentState, deltaTime);
            currentTime += deltaTime;

            // 检查是否发生了碰撞或滑行
            const angleRad = currentState.angle * DEG_TO_RAD;
            const direction = new Vector2D(Math.cos(angleRad), Math.sin(angleRad));
            const expectedPos = currentState.position.add(
                direction.mul(currentState.moveSpeed * deltaTime)
            );

            let eventType = 'move';
            const positionDelta = nextPosition.distance(expectedPos);
            
            // 使用更精确的判定：位置偏差超过1单位就认为发生了碰撞/滑行
            if (positionDelta > 1.0) {
                if (nextPosition.distance(currentState.position) < 0.1) {
                    eventType = 'collision'; // 几乎没移动，完全碰撞
                } else {
                    eventType = 'slide';     // 有移动但方向改变，墙面滑行
                }
            }

            // 添加轨迹点
            const point = new TrajectoryPoint(currentTime, nextPosition.clone(), eventType);
            
            // 添加元数据
            if (eventType !== 'move') {
                point.metadata.expectedPosition = expectedPos;
                point.metadata.actualPosition = nextPosition;
                point.metadata.deviation = positionDelta;
            }
            
            trajectory.push(point);

            // 更新当前状态
            currentState.position = nextPosition;
            lastEventType = eventType;

            // 如果连续多次位置不变，提前结束
            if (trajectory.length >= 3) {
                const p1 = trajectory[trajectory.length - 3].position;
                const p2 = trajectory[trajectory.length - 2].position;
                const p3 = trajectory[trajectory.length - 1].position;
                if (p1.equals(p2) && p2.equals(p3)) {
                    break; // 完全卡住
                }
            }
        }

        return trajectory;
    }

    /**
     * 计算指定时间点的位置
     * 
     * @param {PlayerState} playerState - 玩家初始状态
     * @param {number} targetTime - 目标时间（秒）
     * @returns {Vector2D} 指定时间点的位置
     */
    calculatePositionAtTime(playerState, targetTime) {
        if (targetTime <= 0 || !playerState.isMoving) {
            return playerState.position.clone();
        }

        // 为了精确计算，使用较小的步长逐步推进
        const stepSize = 0.1; // 0.1秒步长
        let currentState = new PlayerState(
            playerState.position.clone(),
            playerState.angle,
            playerState.moveSpeed,
            playerState.isMoving
        );

        let currentTime = 0;
        while (currentTime < targetTime) {
            const deltaTime = Math.min(stepSize, targetTime - currentTime);
            const nextPosition = this.calculateActualPosition(currentState, deltaTime);
            currentState.position = nextPosition;
            currentTime += deltaTime;
        }

        return currentState.position;
    }

    /**
     * 获取所有碰撞点
     * 从轨迹中提取所有发生碰撞或滑行的点
     */
    getCollisionPoints(trajectory) {
        return trajectory.filter(point => 
            point.eventType === 'collision' || point.eventType === 'slide'
        );
    }

    /**
     * 获取玩家半径
     */
    getPlayerRadius() {
        return this.playerRadius;
    }

    /**
     * 设置玩家半径
     */
    setPlayerRadius(radius) {
        this.playerRadius = radius;
    }
}

