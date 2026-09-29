/**
 * Viewport - 视口管理系统
 * 处理缩放、平移、坐标转换
 */

class Viewport {
    constructor(canvas) {
        this.canvas = canvas;
        this.defaultScale = 0.5;   // 默认缩放比例
        this.scale = this.defaultScale;  // 当前缩放比例
        this.offsetX = 0;          // X轴偏移
        this.offsetY = 0;          // Y轴偏移
        this.minScale = 0.1;       // 最小缩放
        this.maxScale = 10.0;      // 最大缩放
        
        // 平移状态
        this.isPanning = false;
        this.lastPanX = 0;
        this.lastPanY = 0;
        
        this.initializeEvents();
    }

    /**
     * 初始化事件监听
     */
    initializeEvents() {
        // 滚轮缩放
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        
        // 中键平移
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1) { // 中键
                e.preventDefault();
                this.startPan(e);
            }
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                this.updatePan(e);
            }
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 1) {
                this.endPan();
            }
        });
        
        // 双击重置视图 - 移除，改由main.js统一处理
        // this.canvas.addEventListener('dblclick', (e) => {
        //     if (e.button === 0) {
        //         this.reset();
        //     }
        // });
    }

    /**
     * 滚轮缩放处理
     */
    onWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // 计算缩放前的世界坐标
        const worldBefore = this.screenToWorld(mouseX, mouseY);
        
        // 计算缩放因子
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = this.scale * delta;
        
        // 限制缩放范围
        if (newScale >= this.minScale && newScale <= this.maxScale) {
            this.scale = newScale;
            
            // 计算缩放后的世界坐标
            const worldAfter = this.screenToWorld(mouseX, mouseY);
            
            // 调整偏移使鼠标位置保持不变
            this.offsetX += (worldAfter.x - worldBefore.x) * this.scale;
            this.offsetY += (worldAfter.y - worldBefore.y) * this.scale;
        }
    }

    /**
     * 开始平移
     */
    startPan(e) {
        this.isPanning = true;
        this.lastPanX = e.clientX;
        this.lastPanY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
    }

    /**
     * 更新平移
     */
    updatePan(e) {
        const dx = e.clientX - this.lastPanX;
        const dy = e.clientY - this.lastPanY;
        
        this.offsetX += dx;
        this.offsetY += dy;
        
        this.lastPanX = e.clientX;
        this.lastPanY = e.clientY;
    }

    /**
     * 结束平移
     */
    endPan() {
        this.isPanning = false;
        this.canvas.style.cursor = 'crosshair';
    }

    /**
     * 屏幕坐标转世界坐标
     */
    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.offsetX) / this.scale,
            y: (screenY - this.offsetY) / this.scale
        };
    }

    /**
     * 世界坐标转屏幕坐标
     */
    worldToScreen(worldX, worldY) {
        return {
            x: worldX * this.scale + this.offsetX,
            y: worldY * this.scale + this.offsetY
        };
    }

    /**
     * 应用视口变换到 Canvas 上下文
     */
    applyTransform(ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); // 重置变换
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, this.scale);
    }

    /**
     * 重置视口
     */
    reset() {
        this.scale = this.defaultScale;
        this.offsetX = 0;
        this.offsetY = 0;
    }

    /**
     * 获取缩放比例（百分比）
     */
    getScalePercent() {
        return Math.round(this.scale * 100);
    }

    /**
     * 设置缩放比例
     */
    setScale(scale) {
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, scale));
    }

    /**
     * 缩放到适应内容
     */
    fitContent(bounds) {
        const padding = 50;
        const scaleX = (this.canvas.width - padding * 2) / (bounds.maxX - bounds.minX);
        const scaleY = (this.canvas.height - padding * 2) / (bounds.maxY - bounds.minY);
        
        this.scale = Math.min(scaleX, scaleY, this.maxScale);
        
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        
        this.offsetX = this.canvas.width / 2 - centerX * this.scale;
        this.offsetY = this.canvas.height / 2 - centerY * this.scale;
    }
}

