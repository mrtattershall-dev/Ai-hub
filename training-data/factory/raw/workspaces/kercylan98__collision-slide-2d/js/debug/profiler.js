/**
 * 性能剖析器
 * 展示算法的精妙之处：计算复杂度与时间无关！
 */

class Profiler {
    constructor() {
        this.metrics = {
            // 计算性能
            trajectoryCalculationTime: 0,    // 轨迹计算耗时（ms）
            collisionCheckCount: 0,          // 碰撞检测次数
            pathSampleCount: 0,              // 路径采样点数
            wallSlideCount: 0,               // 墙面滑行次数
            lastCalculationTime: '',         // 上次计算时间戳
            totalDetections: 0,              // 总检测次数
            
            // 帧率统计
            fps: 60,
            frameTime: 0,                    // 单帧耗时（ms）
        };
        
        this.history = {
            fps: [],
            calculations: [],
            times: []
        };
        
        this.maxHistoryLength = 100;
    }

    /**
     * 开始性能测量
     */
    startMeasure(name) {
        this[`_start_${name}`] = performance.now();
    }

    /**
     * 结束性能测量
     */
    endMeasure(name) {
        const startTime = this[`_start_${name}`];
        if (startTime !== undefined) {
            const elapsed = performance.now() - startTime;
            this.metrics[name] = elapsed;
            delete this[`_start_${name}`];
            return elapsed;
        }
        return 0;
    }

    /**
     * 记录轨迹计算性能（优化版：考虑空间网格）
     */
    recordTrajectoryCalculation(trajectory, maxTime, obstacleCount, spatialGrid = null) {
        this.metrics.pathSampleCount = trajectory.length;
        
        // 计算总检测次数
        // 使用空间网格后，实际检测次数远小于 采样点×总障碍物
        if (spatialGrid) {
            const stats = spatialGrid.getStats();
            // 假设每个采样点平均检测 avgObstaclesPerCell * 9 (3x3格子)
            this.metrics.totalDetections = Math.ceil(
                trajectory.length * parseFloat(stats.avgObstaclesPerCell) * 9
            );
        } else {
            this.metrics.totalDetections = trajectory.length * obstacleCount;
        }
        
        // 记录计算时间
        const now = new Date();
        this.metrics.lastCalculationTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        
        // 统计墙面滑行和碰撞
        this.metrics.collisionCheckCount = trajectory.filter(p => 
            p.eventType === 'collision' || p.eventType === 'slide'
        ).length;
        
        this.metrics.wallSlideCount = trajectory.filter(p => 
            p.eventType === 'slide'
        ).length;
    }

    /**
     * 更新FPS
     */
    updateFPS(fps, frameTime) {
        this.metrics.fps = fps;
        this.metrics.frameTime = frameTime;
        
        this.history.fps.push(fps);
        if (this.history.fps.length > this.maxHistoryLength) {
            this.history.fps.shift();
        }
    }

    /**
     * 获取性能报告
     */
    getReport() {
        return {
            // 计算效率对比
            efficiency: {
                label: '效率提升',
                value: `${this.metrics.efficiency.toFixed(1)}x`,
                description: '相比传统每帧计算方法的效率提升'
            },
            
            // 实际计算量
            actualCalc: {
                label: '实际计算次数',
                value: this.metrics.actualCalculations.toLocaleString(),
                description: '基于采样点的实际碰撞检测次数'
            },
            
            // 传统方法计算量
            traditionalCalc: {
                label: '传统方法计算',
                value: this.metrics.traditionalCalculations.toLocaleString(),
                description: `假设60fps × ${this.metrics.simulationTime}s`
            },
            
            // 采样点数
            sampleCount: {
                label: '路径采样点',
                value: this.metrics.pathSampleCount.toLocaleString(),
                description: '轨迹上的采样点数量'
            },
            
            // 计算耗时
            calcTime: {
                label: '轨迹计算耗时',
                value: `${this.metrics.trajectoryCalculationTime.toFixed(2)}ms`,
                description: '完整轨迹的计算时间'
            },
            
            // 墙面滑行次数
            wallSlide: {
                label: '墙面滑行次数',
                value: this.metrics.wallSlideCount,
                description: '发生墙面滑行的次数'
            },
            
            // 碰撞次数
            collision: {
                label: '碰撞检测次数',
                value: this.metrics.collisionCheckCount,
                description: '发生碰撞或滑行的点数'
            },
            
            // FPS
            fps: {
                label: 'FPS',
                value: this.metrics.fps,
                description: '渲染帧率'
            },
            
            // 单帧耗时
            frameTime: {
                label: '帧耗时',
                value: `${this.metrics.frameTime.toFixed(2)}ms`,
                description: '单帧渲染时间'
            }
        };
    }

    /**
     * 生成对比图表数据
     */
    generateComparisonChart(maxTime = 300) {
        const dataPoints = [];
        const timeSteps = [1, 5, 10, 30, 60, 120, 180, 300, 600, 1800, 3600];
        
        for (const t of timeSteps) {
            if (t > maxTime) break;
            
            // 采样间隔0.1秒
            const sampleCount = Math.ceil(t / 0.1);
            
            // 传统方法：60fps
            const traditionalCount = t * 60;
            
            dataPoints.push({
                time: t,
                traditional: traditionalCount,
                optimized: sampleCount,
                ratio: traditionalCount / sampleCount
            });
        }
        
        return dataPoints;
    }

    /**
     * 获取性能级别（用于UI显示）
     */
    getPerformanceLevel() {
        if (this.metrics.fps >= 55) {
            return { level: 'excellent', color: '#00ff00', text: '优秀' };
        } else if (this.metrics.fps >= 30) {
            return { level: 'good', color: '#ffff00', text: '良好' };
        } else if (this.metrics.fps >= 15) {
            return { level: 'poor', color: '#ff8800', text: '较差' };
        } else {
            return { level: 'critical', color: '#ff0000', text: '严重' };
        }
    }

    /**
     * 获取计算量对比文本
     */
    getComparisonText() {
        const traditional = this.metrics.traditionalCalculations;
        const actual = this.metrics.actualCalculations;
        const saved = traditional - actual;
        const savedPercent = (saved / traditional * 100).toFixed(1);
        
        return {
            traditional: `传统方法: ${traditional.toLocaleString()} 次`,
            actual: `本项目: ${actual.toLocaleString()} 次`,
            saved: `节省: ${saved.toLocaleString()} 次 (${savedPercent}%)`,
            efficiency: `效率提升: ${this.metrics.efficiency.toFixed(1)}x`
        };
    }

    /**
     * 重置统计
     */
    reset() {
        this.metrics.collisionCheckCount = 0;
        this.metrics.wallSlideCount = 0;
        this.metrics.pathSampleCount = 0;
        this.metrics.actualCalculations = 0;
    }
}

