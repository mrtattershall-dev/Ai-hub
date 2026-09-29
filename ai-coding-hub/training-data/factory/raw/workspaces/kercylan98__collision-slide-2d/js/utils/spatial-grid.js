/**
 * 空间网格加速结构
 * 用于快速查询特定位置附近的障碍物
 * 将 O(n) 的碰撞检测优化到 O(1) 查询 + O(k) 检测（k << n）
 */

class SpatialGrid {
    constructor(cellSize = 200) {
        this.cellSize = cellSize;
        this.cells = new Map(); // key: "x,y", value: obstacles[]
    }

    /**
     * 清空所有数据
     */
    clear() {
        this.cells.clear();
    }

    /**
     * 获取位置所在的格子坐标
     */
    getCell(x, y) {
        return {
            x: Math.floor(x / this.cellSize),
            y: Math.floor(y / this.cellSize)
        };
    }

    /**
     * 获取格子的key
     */
    getCellKey(cellX, cellY) {
        return `${cellX},${cellY}`;
    }

    /**
     * 插入障碍物到网格
     */
    insert(obstacle, index) {
        const bounds = obstacle.getBounds();
        const minCell = this.getCell(bounds.min.x, bounds.min.y);
        const maxCell = this.getCell(bounds.max.x, bounds.max.y);

        // 将障碍物添加到所有相交的格子
        for (let x = minCell.x; x <= maxCell.x; x++) {
            for (let y = minCell.y; y <= maxCell.y; y++) {
                const key = this.getCellKey(x, y);
                if (!this.cells.has(key)) {
                    this.cells.set(key, []);
                }
                // 存储障碍物索引而不是对象本身（节省内存）
                this.cells.get(key).push(index);
            }
        }
    }

    /**
     * 批量插入障碍物
     */
    build(obstacles) {
        this.clear();
        for (let i = 0; i < obstacles.length; i++) {
            this.insert(obstacles[i], i);
        }
    }

    /**
     * 查询某个位置附近的障碍物索引
     * 返回该位置所在格子及相邻8个格子中的所有障碍物
     */
    query(x, y) {
        const cell = this.getCell(x, y);
        const indices = new Set(); // 使用Set去重

        // 查询3x3范围的格子
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const key = this.getCellKey(cell.x + dx, cell.y + dy);
                const cellObstacles = this.cells.get(key);
                if (cellObstacles) {
                    for (const index of cellObstacles) {
                        indices.add(index);
                    }
                }
            }
        }

        return Array.from(indices);
    }

    /**
     * 查询线段路径经过的所有障碍物
     */
    queryPath(startX, startY, endX, endY) {
        const startCell = this.getCell(startX, startY);
        const endCell = this.getCell(endX, endY);

        const minCellX = Math.min(startCell.x, endCell.x) - 1;
        const maxCellX = Math.max(startCell.x, endCell.x) + 1;
        const minCellY = Math.min(startCell.y, endCell.y) - 1;
        const maxCellY = Math.max(startCell.y, endCell.y) + 1;

        const indices = new Set();

        for (let x = minCellX; x <= maxCellX; x++) {
            for (let y = minCellY; y <= maxCellY; y++) {
                const key = this.getCellKey(x, y);
                const cellObstacles = this.cells.get(key);
                if (cellObstacles) {
                    for (const index of cellObstacles) {
                        indices.add(index);
                    }
                }
            }
        }

        return Array.from(indices);
    }

    /**
     * 获取统计信息
     */
    getStats() {
        let totalObstacles = 0;
        let maxPerCell = 0;
        let avgPerCell = 0;

        for (const obstacles of this.cells.values()) {
            totalObstacles += obstacles.length;
            maxPerCell = Math.max(maxPerCell, obstacles.length);
        }

        if (this.cells.size > 0) {
            avgPerCell = totalObstacles / this.cells.size;
        }

        return {
            totalCells: this.cells.size,
            maxObstaclesPerCell: maxPerCell,
            avgObstaclesPerCell: avgPerCell.toFixed(1)
        };
    }
}

