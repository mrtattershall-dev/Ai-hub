/**
 * Renderer - Canvas 渲染器（专业版）
 * 支持视口变换、高级可视化
 */

class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
        // 视口（将由外部设置）
        this.viewport = null;
        
        // 渲染选项
        this.options = {
            showGrid: true,
            showTrajectory: true,
            showCollisionPoints: true,
            showPlayerRadius: true,
            showVectors: true,
            showStats: true
        };
        
        // 颜色配置（专业深色主题）
        this.colors = {
            background: '#1e1e1e',
            grid: '#2a2a2a',
            gridMajor: '#3a3a3a',
            obstacle: '#4a4a4a',
            obstacleBorder: '#666666',
            obstacleSelected: 'rgba(14, 99, 156, 0.3)',
            obstacleSelectedBorder: '#0e639c',
            player: '#4a9eff',
            playerDirection: '#ff4a4a',
            trajectory: '#4aff4a',
            trajectoryCollision: '#ff8844',
            trajectorySlide: '#ffff00',
            collisionPoint: '#ff4a4a',
            playerRadius: 'rgba(74, 158, 255, 0.15)',
            vectorInput: '#ff6b6b',
            vectorNormal: '#51cf66',
            vectorSlide: '#ffd43b',
            text: '#cccccc',
            textSecondary: '#9d9d9d'
        };
    }

    /**
     * 设置视口
     */
    setViewport(viewport) {
        this.viewport = viewport;
    }

    /**
     * 清空画布
     */
    clear() {
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * 绘制网格（支持缩放）
     */
    drawGrid(gridSize = 50) {
        if (!this.options.showGrid || !this.viewport) return;

        const ctx = this.ctx;
        this.viewport.applyTransform(ctx);

        // 计算可见区域
        const topLeft = this.viewport.screenToWorld(0, 0);
        const bottomRight = this.viewport.screenToWorld(this.width, this.height);

        const startX = Math.floor(topLeft.x / gridSize) * gridSize;
        const startY = Math.floor(topLeft.y / gridSize) * gridSize;
        const endX = Math.ceil(bottomRight.x / gridSize) * gridSize;
        const endY = Math.ceil(bottomRight.y / gridSize) * gridSize;

        ctx.lineWidth = 1 / this.viewport.scale;

        // 绘制小网格
        ctx.strokeStyle = this.colors.grid;
        ctx.beginPath();
        
        for (let x = startX; x <= endX; x += gridSize) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        
        for (let y = startY; y <= endY; y += gridSize) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        
        ctx.stroke();

        // 绘制主网格（每5个小格）
        ctx.strokeStyle = this.colors.gridMajor;
        ctx.lineWidth = 2 / this.viewport.scale;
        ctx.beginPath();
        
        const majorSize = gridSize * 5;
        const majorStartX = Math.floor(topLeft.x / majorSize) * majorSize;
        const majorStartY = Math.floor(topLeft.y / majorSize) * majorSize;
        
        for (let x = majorStartX; x <= endX; x += majorSize) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        
        for (let y = majorStartY; y <= endY; y += majorSize) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        
        ctx.stroke();

        // 绘制原点
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2 / this.viewport.scale;
        ctx.beginPath();
        ctx.moveTo(0, startY);
        ctx.lineTo(0, endY);
        ctx.stroke();

        ctx.strokeStyle = '#51cf66';
        ctx.beginPath();
        ctx.moveTo(startX, 0);
        ctx.lineTo(endX, 0);
        ctx.stroke();

        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    /**
     * 绘制多边形
     */
    drawPolygon(polygon, fillColor = null, strokeColor = null, isSelected = false) {
        if (polygon.vertices.length < 3) return;

        const ctx = this.ctx;
        this.viewport.applyTransform(ctx);

        ctx.fillStyle = isSelected ? this.colors.obstacleSelected : (fillColor || this.colors.obstacle);
        ctx.strokeStyle = isSelected ? this.colors.obstacleSelectedBorder : (strokeColor || this.colors.obstacleBorder);
        ctx.lineWidth = (isSelected ? 3 : 2) / this.viewport.scale;

        ctx.beginPath();
        ctx.moveTo(polygon.vertices[0].x, polygon.vertices[0].y);
        
        for (let i = 1; i < polygon.vertices.length; i++) {
            ctx.lineTo(polygon.vertices[i].x, polygon.vertices[i].y);
        }
        
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    /**
     * 检查障碍物是否在可见范围内（视锥剔除）
     */
    isObstacleVisible(obstacle) {
        if (!this.viewport) return true;

        const bounds = obstacle.getBounds();
        const screenMin = this.viewport.worldToScreen(bounds.min.x, bounds.min.y);
        const screenMax = this.viewport.worldToScreen(bounds.max.x, bounds.max.y);

        // 添加缓冲区
        const buffer = 50;

        // 检查是否在屏幕范围内
        return !(screenMax.x < -buffer || screenMin.x > this.width + buffer ||
                 screenMax.y < -buffer || screenMin.y > this.height + buffer);
    }

    /**
     * 绘制所有障碍物（优化版：视锥剔除）
     */
    drawObstacles(obstacles, selectedIndices = []) {
        let visibleCount = 0;
        let totalCount = obstacles.length;

        for (let i = 0; i < obstacles.length; i++) {
            // 视锥剔除：只绘制可见的障碍物
            if (this.isObstacleVisible(obstacles[i])) {
                const isSelected = selectedIndices.includes(i);
                this.drawPolygon(obstacles[i], null, null, isSelected);
                visibleCount++;
            }
        }

        // 可选：在控制台输出剔除统计
        if (window.debugCulling && totalCount > 0) {
            console.log(`视锥剔除: 绘制 ${visibleCount}/${totalCount} (${(visibleCount/totalCount*100).toFixed(1)}%)`);
        }
    }

    /**
     * 绘制玩家
     */
    drawPlayer(position, angle, radius, showDirection = true) {
        const ctx = this.ctx;
        this.viewport.applyTransform(ctx);

        // 绘制玩家圆形
        ctx.fillStyle = this.colors.player;
        ctx.strokeStyle = this.colors.playerDirection;
        ctx.lineWidth = 2 / this.viewport.scale;
        
        ctx.beginPath();
        ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 绘制方向箭头
        if (showDirection) {
            const angleRad = angle * DEG_TO_RAD;
            const directionLength = radius * 1.8;
            const endX = position.x + Math.cos(angleRad) * directionLength;
            const endY = position.y + Math.sin(angleRad) * directionLength;

            ctx.strokeStyle = this.colors.playerDirection;
            ctx.lineWidth = 3 / this.viewport.scale;
            ctx.beginPath();
            ctx.moveTo(position.x, position.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // 箭头头部
            const arrowSize = 10 / this.viewport.scale;
            const arrowAngle = 0.5;
            
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(
                endX - arrowSize * Math.cos(angleRad - arrowAngle),
                endY - arrowSize * Math.sin(angleRad - arrowAngle)
            );
            ctx.moveTo(endX, endY);
            ctx.lineTo(
                endX - arrowSize * Math.cos(angleRad + arrowAngle),
                endY - arrowSize * Math.sin(angleRad + arrowAngle)
            );
            ctx.stroke();
        }

        // 绘制玩家半径
        if (this.options.showPlayerRadius) {
            ctx.strokeStyle = this.colors.playerRadius;
            ctx.lineWidth = 1 / this.viewport.scale;
            ctx.setLineDash([5 / this.viewport.scale, 5 / this.viewport.scale]);
            ctx.beginPath();
            ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    /**
     * 检查点是否在可见范围内
     */
    isPointVisible(point) {
        if (!this.viewport) return true;

        const screen = this.viewport.worldToScreen(point.x, point.y);
        const buffer = 50;

        return screen.x >= -buffer && screen.x <= this.width + buffer &&
               screen.y >= -buffer && screen.y <= this.height + buffer;
    }

    /**
     * 绘制轨迹（优化版：修复闪现 + 视锥剔除）
     */
    drawTrajectory(trajectory) {
        if (!this.options.showTrajectory || trajectory.length < 2) return;

        const ctx = this.ctx;
        this.viewport.applyTransform(ctx);

        ctx.lineWidth = 2 / this.viewport.scale;

        let drawnSegments = 0;

        // 绘制线段（只绘制可见的）
        for (let i = 0; i < trajectory.length - 1; i++) {
            const point = trajectory[i];
            const nextPoint = trajectory[i + 1];

            // 快速剔除：如果线段两端都不可见，跳过
            if (!this.isPointVisible(point.position) && !this.isPointVisible(nextPoint.position)) {
                continue;
            }

            drawnSegments++;

            // 根据事件类型选择颜色
            let color = this.colors.trajectory;
            if (nextPoint.eventType === 'collision') {
                color = this.colors.trajectoryCollision;
            } else if (nextPoint.eventType === 'slide') {
                color = this.colors.trajectorySlide;
            }

            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.moveTo(point.position.x, point.position.y);
            ctx.lineTo(nextPoint.position.x, nextPoint.position.y);
            ctx.stroke();
        }

        // 绘制轨迹点（只绘制可见的）
        for (const point of trajectory) {
            if (!this.isPointVisible(point.position)) continue;

            let radius = 2 / this.viewport.scale;
            let color = this.colors.trajectory;

            if (point.eventType === 'start') {
                radius = 4 / this.viewport.scale;
                color = this.colors.player;
            } else if (point.eventType === 'collision') {
                radius = 4 / this.viewport.scale;
                color = this.colors.trajectoryCollision;
            } else if (point.eventType === 'slide') {
                radius = 3 / this.viewport.scale;
                color = this.colors.trajectorySlide;
            }

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(point.position.x, point.position.y, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    /**
     * 绘制碰撞点标记（使用玩家半径 + 视锥剔除）
     */
    drawCollisionPoints(collisionPoints, playerRadius) {
        if (!this.options.showCollisionPoints) return;

        const ctx = this.ctx;
        this.viewport.applyTransform(ctx);

        for (const point of collisionPoints) {
            // 视锥剔除
            if (!this.isPointVisible(point.position)) continue;

            // 使用玩家半径作为碰撞点圆圈大小
            const radius = playerRadius;
            const crossSize = 8 / this.viewport.scale;

            // 绘制碰撞半径圆圈（半透明）
            ctx.fillStyle = 'rgba(255, 74, 74, 0.1)';
            ctx.strokeStyle = this.colors.collisionPoint;
            ctx.lineWidth = 2 / this.viewport.scale;
            ctx.beginPath();
            ctx.arc(point.position.x, point.position.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 绘制中心叉叉
            ctx.lineWidth = 2 / this.viewport.scale;
            ctx.beginPath();
            ctx.moveTo(point.position.x - crossSize, point.position.y - crossSize);
            ctx.lineTo(point.position.x + crossSize, point.position.y + crossSize);
            ctx.moveTo(point.position.x + crossSize, point.position.y - crossSize);
            ctx.lineTo(point.position.x - crossSize, point.position.y + crossSize);
            ctx.stroke();
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    /**
     * 绘制向量分解（用于展示墙面滑行原理）
     */
    drawVectorDecomposition(position, inputVec, normalVec, slideVec) {
        if (!this.options.showVectors) return;

        const ctx = this.ctx;
        this.viewport.applyTransform(ctx);

        const scale = 50; // 向量显示缩放

        // 输入向量（红色）
        this.drawArrow(ctx, position, 
            position.add(inputVec.mul(scale)), 
            this.colors.vectorInput, 
            '输入', 3);

        // 法向量（绿色）
        this.drawArrow(ctx, position, 
            position.add(normalVec.mul(scale)), 
            this.colors.vectorNormal, 
            '法向', 2);

        // 滑行向量（黄色）
        if (slideVec) {
            this.drawArrow(ctx, position, 
                position.add(slideVec.mul(scale)), 
                this.colors.vectorSlide, 
                '滑行', 3);
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    /**
     * 绘制箭头
     */
    drawArrow(ctx, start, end, color, label, lineWidth = 2) {
        const actualLineWidth = lineWidth / this.viewport.scale;
        
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = actualLineWidth;
        
        // 绘制线
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        // 绘制箭头
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const arrowSize = 10 / this.viewport.scale;
        const arrowAngle = 0.5;

        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
            end.x - arrowSize * Math.cos(angle - arrowAngle),
            end.y - arrowSize * Math.sin(angle - arrowAngle)
        );
        ctx.lineTo(
            end.x - arrowSize * Math.cos(angle + arrowAngle),
            end.y - arrowSize * Math.sin(angle + arrowAngle)
        );
        ctx.closePath();
        ctx.fill();

        // 标签
        if (label) {
            ctx.fillStyle = color;
            ctx.font = `${12 / this.viewport.scale}px Arial`;
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            ctx.fillText(label, midX + 5, midY - 5);
        }
    }

    /**
     * 绘制世界坐标文本（会随缩放调整大小）
     */
    drawWorldText(text, x, y, color = null, fontSize = 14) {
        const ctx = this.ctx;
        this.viewport.applyTransform(ctx);

        ctx.fillStyle = color || this.colors.text;
        ctx.font = `${fontSize / this.viewport.scale}px Arial`;
        ctx.fillText(text, x, y);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    /**
     * 绘制屏幕坐标文本（固定大小）
     */
    drawScreenText(text, x, y, color = null, fontSize = 14) {
        this.ctx.fillStyle = color || this.colors.text;
        this.ctx.font = `${fontSize}px Arial`;
        this.ctx.fillText(text, x, y);
    }

    /**
     * 绘制时间指示器
     */
    drawTimeIndicator(currentTime, maxTime, position) {
        const text = `时间: ${currentTime.toFixed(2)}s / ${maxTime.toFixed(0)}s`;
        this.drawScreenText(text, position.x, position.y, '#ffffff', 16);
    }

    /**
     * 绘制位置信息
     */
    drawPositionInfo(position, text = '') {
        const infoText = text || `位置: (${position.x.toFixed(0)}, ${position.y.toFixed(0)})`;
        this.drawScreenText(infoText, 10, this.height - 10, '#ffffff', 14);
    }

    /**
     * 设置渲染选项
     */
    setOption(option, value) {
        if (option in this.options) {
            this.options[option] = value;
        }
    }

    /**
     * 获取渲染选项
     */
    getOption(option) {
        return this.options[option];
    }

    /**
     * 更新Canvas尺寸
     */
    updateSize(width, height) {
        this.width = width;
        this.height = height;
    }
}
