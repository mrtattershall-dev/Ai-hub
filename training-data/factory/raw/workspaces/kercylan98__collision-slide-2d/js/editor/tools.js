/**
 * 编辑工具系统
 * 包括选择、创建、编辑工具
 */

// 工具类型枚举
const ToolType = {
    SELECT: 'select',
    RECTANGLE: 'rectangle',
    POLYGON: 'polygon',
    MOVE: 'move'
};

/**
 * 基础工具类
 */
class Tool {
    constructor(editor) {
        this.editor = editor;
        this.isActive = false;
    }

    activate() {
        this.isActive = true;
    }

    deactivate() {
        this.isActive = false;
    }

    onMouseDown(worldX, worldY, e) {}
    onMouseMove(worldX, worldY, e) {}
    onMouseUp(worldX, worldY, e) {}
    onKeyDown(e) {}
    
    render(ctx) {}
}

/**
 * 选择工具
 */
class SelectTool extends Tool {
    constructor(editor) {
        super(editor);
        this.selectedIndices = [];
    }

    onMouseDown(worldX, worldY, e) {
        const clickedIndex = this.findObstacleAt(worldX, worldY);
        
        if (clickedIndex !== -1) {
            if (e.shiftKey) {
                // Shift多选
                const index = this.selectedIndices.indexOf(clickedIndex);
                if (index > -1) {
                    this.selectedIndices.splice(index, 1);
                } else {
                    this.selectedIndices.push(clickedIndex);
                }
            } else if (!this.selectedIndices.includes(clickedIndex)) {
                this.selectedIndices = [clickedIndex];
            }
        } else if (!e.shiftKey) {
            this.selectedIndices = [];
        }
    }

    findObstacleAt(x, y) {
        const point = new Vector2D(x, y);
        const obstacles = this.editor.app.obstacles;
        
        for (let i = obstacles.length - 1; i >= 0; i--) {
            if (pointInPolygon(point, obstacles[i])) {
                return i;
            }
        }
        
        return -1;
    }

    render(ctx) {
        if (this.selectedIndices.length === 0) return;
        
        // 应用视口变换
        this.editor.viewport.applyTransform(ctx);
        
        ctx.strokeStyle = '#0e639c';
        ctx.lineWidth = 2 / this.editor.viewport.scale;
        ctx.setLineDash([5 / this.editor.viewport.scale, 5 / this.editor.viewport.scale]);
        
        const obstacles = this.editor.app.obstacles;
        for (const index of this.selectedIndices) {
            if (index < obstacles.length) {
                const obstacle = obstacles[index];
                this.drawSelectionBox(ctx, obstacle);
            }
        }
        
        ctx.setLineDash([]);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    drawSelectionBox(ctx, polygon) {
        const bounds = polygon.getBounds();
        const padding = 5 / this.editor.viewport.scale;
        
        ctx.strokeRect(
            bounds.min.x - padding,
            bounds.min.y - padding,
            bounds.max.x - bounds.min.x + padding * 2,
            bounds.max.y - bounds.min.y + padding * 2
        );
    }

    getSelectedObstacles() {
        return this.selectedIndices.map(i => this.editor.app.obstacles[i]);
    }

    clearSelection() {
        this.selectedIndices = [];
    }
}

/**
 * 矩形创建工具
 */
class RectangleTool extends Tool {
    constructor(editor) {
        super(editor);
        this.startX = 0;
        this.startY = 0;
        this.isDrawing = false;
        this.currentX = 0;
        this.currentY = 0;
    }

    onMouseDown(worldX, worldY, e) {
        this.startX = worldX;
        this.startY = worldY;
        this.currentX = worldX;
        this.currentY = worldY;
        this.isDrawing = true;
    }

    onMouseMove(worldX, worldY, e) {
        if (this.isDrawing) {
            this.currentX = worldX;
            this.currentY = worldY;
        }
    }

    onMouseUp(worldX, worldY, e) {
        if (this.isDrawing) {
            this.currentX = worldX;
            this.currentY = worldY;
            this.createRectangle();
            this.isDrawing = false;
        }
    }

    createRectangle() {
        const minX = Math.min(this.startX, this.currentX);
        const minY = Math.min(this.startY, this.currentY);
        const maxX = Math.max(this.startX, this.currentX);
        const maxY = Math.max(this.startY, this.currentY);
        
        // 至少10x10的矩形
        if (maxX - minX < 10 || maxY - minY < 10) {
            return;
        }
        
        const polygon = new Polygon([
            new Vector2D(minX, minY),
            new Vector2D(maxX, minY),
            new Vector2D(maxX, maxY),
            new Vector2D(minX, maxY)
        ]);
        
        this.editor.app.obstacles.push(polygon);
        this.editor.app.movementEngine.setObstacles(this.editor.app.obstacles);
        this.editor.app.updateTrajectory();
        this.editor.app.updateObstacleCount();
    }

    render(ctx) {
        if (!this.isDrawing) return;
        
        const minX = Math.min(this.startX, this.currentX);
        const minY = Math.min(this.startY, this.currentY);
        const width = Math.abs(this.currentX - this.startX);
        const height = Math.abs(this.currentY - this.startY);
        
        // 绘制预览矩形
        ctx.fillStyle = 'rgba(74, 158, 255, 0.2)';
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 2 / this.editor.viewport.scale;
        
        ctx.fillRect(minX, minY, width, height);
        ctx.strokeRect(minX, minY, width, height);
        
        // 显示尺寸
        ctx.fillStyle = '#ffffff';
        ctx.font = `${12 / this.editor.viewport.scale}px Arial`;
        ctx.fillText(`${Math.round(width)} x ${Math.round(height)}`, 
                     minX + 5, minY - 5);
    }
}

/**
 * 多边形创建工具
 */
class PolygonTool extends Tool {
    constructor(editor) {
        super(editor);
        this.vertices = [];
        this.currentX = 0;
        this.currentY = 0;
    }

    onMouseDown(worldX, worldY, e) {
        if (e.detail === 2) {
            // 双击完成多边形
            this.completePolygon();
        } else {
            // 添加顶点
            this.vertices.push(new Vector2D(worldX, worldY));
        }
    }

    onMouseMove(worldX, worldY, e) {
        this.currentX = worldX;
        this.currentY = worldY;
    }

    onKeyDown(e) {
        if (e.key === 'Enter') {
            this.completePolygon();
        } else if (e.key === 'Escape') {
            this.cancel();
        }
    }

    completePolygon() {
        if (this.vertices.length >= 3) {
            const polygon = new Polygon([...this.vertices]);
            this.editor.app.obstacles.push(polygon);
            this.editor.app.movementEngine.setObstacles(this.editor.app.obstacles);
            this.editor.app.updateTrajectory();
            this.editor.app.updateObstacleCount();
        }
        this.vertices = [];
    }

    cancel() {
        this.vertices = [];
    }

    render(ctx) {
        if (this.vertices.length === 0) return;
        
        ctx.strokeStyle = '#4a9eff';
        ctx.fillStyle = 'rgba(74, 158, 255, 0.2)';
        ctx.lineWidth = 2 / this.editor.viewport.scale;
        
        // 绘制已有的顶点和边
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        
        // 连接到当前鼠标位置
        ctx.lineTo(this.currentX, this.currentY);
        
        // 如果有3个以上顶点，显示闭合预览
        if (this.vertices.length >= 3) {
            ctx.lineTo(this.vertices[0].x, this.vertices[0].y);
            ctx.fill();
        }
        
        ctx.stroke();
        
        // 绘制顶点
        for (const vertex of this.vertices) {
            ctx.fillStyle = '#4a9eff';
            ctx.beginPath();
            ctx.arc(vertex.x, vertex.y, 4 / this.editor.viewport.scale, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 提示文字
        ctx.fillStyle = '#ffffff';
        ctx.font = `${12 / this.editor.viewport.scale}px Arial`;
        ctx.fillText(`顶点: ${this.vertices.length} (双击或Enter完成)`, 
                     this.currentX + 10, this.currentY - 10);
    }
}

/**
 * 移动工具
 */
class MoveTool extends Tool {
    constructor(editor) {
        super(editor);
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.originalPositions = [];
    }

    getSelectTool() {
        return this.editor.app.toolManager.tools.select;
    }

    onMouseDown(worldX, worldY, e) {
        const selectTool = this.getSelectTool();
        const clickedIndex = selectTool.findObstacleAt(worldX, worldY);
        
        if (clickedIndex !== -1) {
            if (!selectTool.selectedIndices.includes(clickedIndex)) {
                selectTool.selectedIndices = [clickedIndex];
            }
            
            this.isDragging = true;
            this.dragStartX = worldX;
            this.dragStartY = worldY;
            
            // 保存原始位置
            this.originalPositions = selectTool.getSelectedObstacles().map(obs => ({
                vertices: obs.vertices.map(v => v.clone())
            }));
        }
    }

    onMouseMove(worldX, worldY, e) {
        if (this.isDragging) {
            const selectTool = this.getSelectTool();
            const dx = worldX - this.dragStartX;
            const dy = worldY - this.dragStartY;
            
            const obstacles = this.editor.app.obstacles;
            selectTool.selectedIndices.forEach((index, i) => {
                const obstacle = obstacles[index];
                const original = this.originalPositions[i];
                
                for (let j = 0; j < obstacle.vertices.length; j++) {
                    obstacle.vertices[j].x = original.vertices[j].x + dx;
                    obstacle.vertices[j].y = original.vertices[j].y + dy;
                }
            });
            
            this.editor.app.movementEngine.setObstacles(obstacles);
            this.editor.app.updateTrajectory();
        }
    }

    onMouseUp(worldX, worldY, e) {
        this.isDragging = false;
    }

    render(ctx) {
        const selectTool = this.getSelectTool();
        selectTool.render(ctx);
        
        if (this.isDragging) {
            // 显示移动向量
            ctx.strokeStyle = '#ffaa00';
            ctx.lineWidth = 2 / this.editor.viewport.scale;
            ctx.setLineDash([5 / this.editor.viewport.scale, 5 / this.editor.viewport.scale]);
            
            const obstacles = this.editor.app.obstacles;
            selectTool.selectedIndices.forEach((index, i) => {
                if (index < obstacles.length) {
                    const obstacle = obstacles[index];
                    const original = this.originalPositions[i];
                    const center = obstacle.getCenter();
                    const originalCenter = new Polygon(original.vertices).getCenter();
                    
                    ctx.beginPath();
                    ctx.moveTo(originalCenter.x, originalCenter.y);
                    ctx.lineTo(center.x, center.y);
                    ctx.stroke();
                }
            });
            
            ctx.setLineDash([]);
        }
    }
}

/**
 * 顶点编辑工具
 */
class VertexEditTool extends Tool {
    constructor(editor) {
        super(editor);
        this.editingIndex = -1;
        this.draggingVertexIndex = -1;
        this.hoverVertexIndex = -1;
        this.hoverEdgeIndex = -1;
        this.snapToGrid = true;
        this.gridSize = 50;
    }

    activate() {
        super.activate();
        const selectTool = this.editor.app.toolManager.tools.select;
        if (selectTool.selectedIndices.length === 1) {
            this.editingIndex = selectTool.selectedIndices[0];
        }
    }

    deactivate() {
        super.deactivate();
        this.editingIndex = -1;
        this.draggingVertexIndex = -1;
    }

    onMouseDown(worldX, worldY, e) {
        if (this.editingIndex === -1) return;

        const obstacle = this.editor.app.obstacles[this.editingIndex];
        if (!obstacle) return;

        // 检查是否点击顶点
        const vertexIndex = this.findVertexAt(worldX, worldY, obstacle);
        if (vertexIndex !== -1) {
            if (e.button === 0) {
                // 左键拖动顶点
                this.draggingVertexIndex = vertexIndex;
            } else if (e.button === 2 && obstacle.vertices.length > 3) {
                // 右键删除顶点（至少保留3个顶点）
                obstacle.vertices.splice(vertexIndex, 1);
                this.editor.app.movementEngine.setObstacles(this.editor.app.obstacles);
                this.editor.app.updateTrajectory();
            }
            return;
        }

        // 检查是否点击边的中点（添加顶点）
        const edgeIndex = this.findEdgeAt(worldX, worldY, obstacle);
        if (edgeIndex !== -1 && e.button === 0) {
            const newVertex = new Vector2D(worldX, worldY);
            if (this.snapToGrid) {
                newVertex.x = Math.round(newVertex.x / this.gridSize) * this.gridSize;
                newVertex.y = Math.round(newVertex.y / this.gridSize) * this.gridSize;
            }
            obstacle.vertices.splice(edgeIndex + 1, 0, newVertex);
            this.draggingVertexIndex = edgeIndex + 1;
            this.editor.app.movementEngine.setObstacles(this.editor.app.obstacles);
            this.editor.app.updateTrajectory();
        }
    }

    onMouseMove(worldX, worldY, e) {
        if (this.editingIndex === -1) return;

        const obstacle = this.editor.app.obstacles[this.editingIndex];
        if (!obstacle) return;

        if (this.draggingVertexIndex !== -1) {
            // 拖动顶点
            let newX = worldX;
            let newY = worldY;
            
            if (this.snapToGrid) {
                newX = Math.round(newX / this.gridSize) * this.gridSize;
                newY = Math.round(newY / this.gridSize) * this.gridSize;
            }
            
            obstacle.vertices[this.draggingVertexIndex].x = newX;
            obstacle.vertices[this.draggingVertexIndex].y = newY;
            
            this.editor.app.movementEngine.setObstacles(this.editor.app.obstacles);
            this.editor.app.updateTrajectory();
        } else {
            // 更新悬停状态
            this.hoverVertexIndex = this.findVertexAt(worldX, worldY, obstacle);
            this.hoverEdgeIndex = this.findEdgeAt(worldX, worldY, obstacle);
        }
    }

    onMouseUp(worldX, worldY, e) {
        this.draggingVertexIndex = -1;
    }

    onKeyDown(e) {
        if (e.key === 'Escape') {
            this.editor.app.setTool('select');
        }
    }

    findVertexAt(worldX, worldY, polygon) {
        const threshold = 10 / this.editor.viewport.scale;
        const point = new Vector2D(worldX, worldY);
        
        for (let i = 0; i < polygon.vertices.length; i++) {
            if (point.distance(polygon.vertices[i]) < threshold) {
                return i;
            }
        }
        return -1;
    }

    findEdgeAt(worldX, worldY, polygon) {
        const threshold = 8 / this.editor.viewport.scale;
        const point = new Vector2D(worldX, worldY);
        
        for (let i = 0; i < polygon.vertices.length; i++) {
            const v1 = polygon.vertices[i];
            const v2 = polygon.vertices[(i + 1) % polygon.vertices.length];
            const midpoint = v1.add(v2).mul(0.5);
            
            if (point.distance(midpoint) < threshold) {
                return i;
            }
        }
        return -1;
    }

    render(ctx) {
        if (this.editingIndex === -1) return;

        const obstacle = this.editor.app.obstacles[this.editingIndex];
        if (!obstacle) return;

        this.editor.viewport.applyTransform(ctx);

        const scale = this.editor.viewport.scale;

        // 绘制顶点
        for (let i = 0; i < obstacle.vertices.length; i++) {
            const vertex = obstacle.vertices[i];
            const isHover = i === this.hoverVertexIndex;
            const isDragging = i === this.draggingVertexIndex;

            ctx.fillStyle = isDragging ? '#ff6b6b' : (isHover ? '#ffd43b' : '#4a9eff');
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2 / scale;
            
            ctx.beginPath();
            ctx.arc(vertex.x, vertex.y, (isDragging ? 6 : 5) / scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 顶点编号
            ctx.fillStyle = '#ffffff';
            ctx.font = `${10 / scale}px Arial`;
            ctx.fillText(i.toString(), vertex.x + 8 / scale, vertex.y - 8 / scale);
        }

        // 绘制边的中点（可添加顶点）
        ctx.fillStyle = '#51cf66';
        for (let i = 0; i < obstacle.vertices.length; i++) {
            const v1 = obstacle.vertices[i];
            const v2 = obstacle.vertices[(i + 1) % obstacle.vertices.length];
            const midpoint = v1.add(v2).mul(0.5);
            const isHover = i === this.hoverEdgeIndex;

            if (isHover) {
                ctx.fillStyle = '#ffd43b';
            }

            ctx.fillRect(
                midpoint.x - 3 / scale,
                midpoint.y - 3 / scale,
                6 / scale,
                6 / scale
            );

            if (!isHover) {
                ctx.fillStyle = '#51cf66';
            }
        }

        // 提示文字
        ctx.fillStyle = '#ffffff';
        ctx.font = `${12 / scale}px Arial`;
        const center = obstacle.getCenter();
        ctx.fillText('顶点编辑模式 (ESC退出)', center.x, center.y - 30 / scale);
        ctx.fillText('点击边中点添加顶点，右键顶点删除', center.x, center.y - 15 / scale);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
}

/**
 * 工具管理器
 */
class ToolManager {
    constructor(editor) {
        this.editor = editor;
        this.tools = {
            select: new SelectTool(editor),
            rectangle: new RectangleTool(editor),
            polygon: new PolygonTool(editor),
            move: new MoveTool(editor),
            vertexEdit: new VertexEditTool(editor)
        };
        
        this.currentTool = this.tools.select;
        this.currentTool.activate();
    }

    setTool(toolType) {
        if (this.currentTool) {
            this.currentTool.deactivate();
        }
        
        this.currentTool = this.tools[toolType];
        if (this.currentTool) {
            this.currentTool.activate();
        }
    }

    getCurrentTool() {
        return this.currentTool;
    }

    handleMouseDown(worldX, worldY, e) {
        if (this.currentTool) {
            this.currentTool.onMouseDown(worldX, worldY, e);
        }
    }

    handleMouseMove(worldX, worldY, e) {
        if (this.currentTool) {
            this.currentTool.onMouseMove(worldX, worldY, e);
        }
    }

    handleMouseUp(worldX, worldY, e) {
        if (this.currentTool) {
            this.currentTool.onMouseUp(worldX, worldY, e);
        }
    }

    handleKeyDown(e) {
        if (this.currentTool) {
            this.currentTool.onKeyDown(e);
        }
    }

    render(ctx) {
        if (this.currentTool) {
            this.currentTool.render(ctx);
        }
    }
}

