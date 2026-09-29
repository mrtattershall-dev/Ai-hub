/**
 * 场景序列化系统
 * 保存和加载场景
 */

class SceneSerializer {
    /**
     * 序列化场景为JSON
     */
    static serialize(app) {
        const scene = {
            version: '2.1',
            timestamp: new Date().toISOString(),
            player: {
                position: { x: app.playerState.position.x, y: app.playerState.position.y },
                angle: app.playerState.angle,
                moveSpeed: app.playerState.moveSpeed,
                isMoving: app.playerState.isMoving
            },
            playerRadius: app.movementEngine.getPlayerRadius(),
            obstacles: app.obstacles.map(obs => ({
                vertices: obs.vertices.map(v => ({ x: v.x, y: v.y }))
            })),
            simulation: {
                maxTime: app.maxTime,
                sampleRate: app.sampleRate
            }
        };
        
        return JSON.stringify(scene, null, 2);
    }

    /**
     * 从JSON反序列化场景
     */
    static deserialize(json, app) {
        try {
            const scene = JSON.parse(json);
            
            if (!scene.version || !scene.player || !scene.obstacles) {
                throw new Error('无效的场景格式');
            }
            
            // 恢复玩家状态
            app.playerState.position.x = scene.player.position.x;
            app.playerState.position.y = scene.player.position.y;
            app.playerState.angle = scene.player.angle;
            app.playerState.moveSpeed = scene.player.moveSpeed;
            app.playerState.isMoving = scene.player.isMoving !== false;
            
            // 恢复玩家半径
            if (scene.playerRadius) {
                app.movementEngine.setPlayerRadius(scene.playerRadius);
            }
            
            // 恢复障碍物
            app.obstacles = scene.obstacles.map(obs => {
                const vertices = obs.vertices.map(v => new Vector2D(v.x, v.y));
                return new Polygon(vertices);
            });
            
            app.movementEngine.setObstacles(app.obstacles);
            
            // 恢复模拟设置
            if (scene.simulation) {
                app.maxTime = scene.simulation.maxTime || 60;
                app.sampleRate = scene.simulation.sampleRate || 0.1;
            }
            
            // 更新UI和轨迹
            app.updateAllUI();
            app.resetPlayback();
            app.updateTrajectory();
            
            return true;
        } catch (error) {
            console.error('场景加载失败:', error);
            return false;
        }
    }

    /**
     * 下载场景文件
     */
    static download(app, filename = 'scene.json') {
        const json = this.serialize(app);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    /**
     * 从文件加载场景
     */
    static loadFromFile(app, file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const success = this.deserialize(e.target.result, app);
                if (success) {
                    resolve();
                } else {
                    reject(new Error('场景加载失败'));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('文件读取失败'));
            };
            
            reader.readAsText(file);
        });
    }

    /**
     * 复制到剪贴板
     */
    static copyToClipboard(app) {
        const json = this.serialize(app);
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(json).then(() => {
                console.log('场景已复制到剪贴板');
            });
        } else {
            // 降级方案
            const textarea = document.createElement('textarea');
            textarea.value = json;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            console.log('场景已复制到剪贴板（降级方案）');
        }
    }

    /**
     * 从剪贴板粘贴
     */
    static pasteFromClipboard(app) {
        if (navigator.clipboard) {
            navigator.clipboard.readText().then(text => {
                this.deserialize(text, app);
            });
        } else {
            console.warn('浏览器不支持从剪贴板读取');
        }
    }
}

