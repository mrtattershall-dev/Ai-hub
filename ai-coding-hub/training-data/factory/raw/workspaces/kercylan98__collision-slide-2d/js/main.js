/**
 * Main Controller - 专业编辑器版本 v2.1
 * 完整的调试工具：地图编辑、性能分析、高级调试
 */

class EditorApp {
    constructor() {
        // 初始化 Canvas（自适应大小）
        this.canvas = document.getElementById('gameCanvas');
        this.resizeCanvas();
        
        // 初始化视口
        this.viewport = new Viewport(this.canvas);
        
        // 初始化渲染器
        this.renderer = new Renderer(this.canvas);
        this.renderer.setViewport(this.viewport);
        
        // 初始化移动引擎
        this.movementEngine = new MovementEngine(25);
        
        // 初始化性能剖析器
        this.profiler = new Profiler();
        
        // 初始化编辑器
        this.editor = {
            viewport: this.viewport,
            app: this,
            tools: null
        };
        this.toolManager = new ToolManager(this.editor);
        this.editor.tools = this.toolManager.tools;
        
        // 当前模式
        this.editorMode = 'view'; // 'view', 'edit', 'debug'
        
        // 游戏状态
        this.obstacles = [];
        
        // 玩家默认位置：世界中心（考虑默认50%缩放）
        // 世界范围 3000x2000，所以中心是 (1500, 1000)
        this.playerState = new PlayerState(
            new Vector2D(1500, 1000),
            0,
            300,
            true
        );
        
        // 轨迹数据
        this.trajectory = [];
        this.currentTime = 0;
        this.maxTime = 30;        // 降低默认最大时间（30秒更合理）
        this.sampleRate = 0.2;    // 降低默认采样率（减少50%计算量）
        
        // 播放控制
        this.isPlaying = false;
        this.playbackSpeed = 1.0;
        this.animationId = null;
        this.lastPlaybackTime = 0;
        
        // FPS 计数
        this.fps = 60;
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.fpsUpdateTime = performance.now();
        
        // 鼠标状态
        this.mouseWorldX = 0;
        this.mouseWorldY = 0;
        this.isRotatingPlayer = false; // 右键拖拽旋转玩家的状态
        
        // 编辑器设置
        this.gridSize = 50;
        this.snapToGrid = true;
        
        // 初始化
        this.initializeUI();
        this.initializePresets();
        this.initializeKeyboard();
        this.generateRandomMap();
        this.updateTrajectory();
        this.startRenderLoop();
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => this.onWindowResize());
        
        // 初始化默认工具
        this.setTool('select');
        
        // 初始化时间显示
        this.updateMaxTimeDisplay();
        this.updateTimeDisplay();
        
        // 调整视口使玩家居中显示
        this.centerViewOnPlayer();
    }

    /**
     * 将视口居中到玩家位置
     */
    centerViewOnPlayer() {
        const playerWorldX = this.playerState.position.x;
        const playerWorldY = this.playerState.position.y;
        
        // 计算偏移，使玩家在屏幕中心
        this.viewport.offsetX = this.canvas.width / 2 - playerWorldX * this.viewport.scale;
        this.viewport.offsetY = this.canvas.height / 2 - playerWorldY * this.viewport.scale;
    }

    /**
     * 调整 Canvas 大小
     */
    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    /**
     * 窗口大小变化
     */
    onWindowResize() {
        this.resizeCanvas();
        this.renderer.updateSize(this.canvas.width, this.canvas.height);
    }

    /**
     * 初始化UI
     */
    initializeUI() {
        // 工具栏
        document.getElementById('btnGenerateMap').addEventListener('click', () => {
            this.generateRandomMap();
        });
        
        document.getElementById('btnClearMap').addEventListener('click', () => {
            this.obstacles = [];
            this.movementEngine.setObstacles(this.obstacles);
            this.updateTrajectory();
        });

        document.getElementById('btnToggleGrid').addEventListener('click', () => {
            const checkbox = document.getElementById('showGrid');
            checkbox.checked = !checkbox.checked;
            this.renderer.setOption('showGrid', checkbox.checked);
        });

        document.getElementById('btnHelp').addEventListener('click', () => {
            this.showHelp();
        });

        document.getElementById('btnSaveScene').addEventListener('click', () => {
            SceneSerializer.download(this, 'scene.json');
        });

        document.getElementById('btnLoadScene').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        document.getElementById('fileInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                SceneSerializer.loadFromFile(this, file);
            }
        });

        // 工具按钮
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                this.setTool(tool);
            });
        });

        // 工具选项
        document.getElementById('gridSizeSelect').addEventListener('change', (e) => {
            this.gridSize = parseInt(e.target.value);
            if (this.toolManager.tools.vertexEdit) {
                this.toolManager.tools.vertexEdit.gridSize = this.gridSize;
            }
        });

        document.getElementById('snapToGrid').addEventListener('change', (e) => {
            this.snapToGrid = e.target.checked;
            if (this.toolManager.tools.vertexEdit) {
                this.toolManager.tools.vertexEdit.snapToGrid = this.snapToGrid;
            }
        });

        // 快速操作
        document.getElementById('btnDuplicate').addEventListener('click', () => {
            this.duplicateSelected();
        });

        document.getElementById('btnSelectAll').addEventListener('click', () => {
            this.selectAll();
        });

        // 属性绑定
        this.bindProperty('playerX', 'playerXSlider', (value) => {
            this.playerState.position.x = parseFloat(value);
            this.updateTrajectory();
        });

        this.bindProperty('playerY', 'playerYSlider', (value) => {
            this.playerState.position.y = parseFloat(value);
            this.updateTrajectory();
        });

        this.bindProperty('playerAngle', 'playerAngleSlider', (value) => {
            this.playerState.angle = parseFloat(value);
            this.updateTrajectory();
        });

        this.bindProperty('playerSpeed', 'playerSpeedSlider', (value) => {
            this.playerState.moveSpeed = parseFloat(value);
            this.updateTrajectory();
        });

        this.bindProperty('playerRadius', 'playerRadiusSlider', (value) => {
            this.movementEngine.setPlayerRadius(parseFloat(value));
            this.updateTrajectory();
        });

        document.getElementById('playerIsMoving').addEventListener('change', (e) => {
            this.playerState.isMoving = e.target.checked;
            this.updateTrajectory();
        });

        this.bindProperty('maxTime', 'maxTimeSlider', (value) => {
            this.maxTime = parseFloat(value);
            document.getElementById('timeSlider').max = this.maxTime;
            this.updateMaxTimeDisplay();
            this.updateTrajectory();
        });

        this.bindProperty('sampleRate', 'sampleRateSlider', (value) => {
            this.sampleRate = parseFloat(value);
            this.updateTrajectory();
        });

        // 时间轴控制 - 关键修复：播放时也能调整
        const timeSlider = document.getElementById('timeSlider');
        timeSlider.addEventListener('input', (e) => {
            this.currentTime = parseFloat(e.target.value);
            this.updateTimeDisplay();
            // 不需要调用render()，渲染循环会自动更新
        });

        // 鼠标按下时暂停播放（如果正在播放）
        timeSlider.addEventListener('mousedown', () => {
            if (this.isPlaying) {
                this.wasPlayingBeforeScrub = true;
                this.stopPlayback();
            } else {
                this.wasPlayingBeforeScrub = false;
            }
        });

        // 鼠标释放后继续播放
        timeSlider.addEventListener('mouseup', () => {
            if (this.wasPlayingBeforeScrub) {
                this.startPlayback();
                this.wasPlayingBeforeScrub = false;
            }
        });

        document.getElementById('btnPlay').addEventListener('click', () => {
            this.startPlayback();
        });

        document.getElementById('btnPause').addEventListener('click', () => {
            this.stopPlayback();
        });

        document.getElementById('btnReset').addEventListener('click', () => {
            this.resetPlayback();
        });

        // 播放速度
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.playbackSpeed = parseFloat(e.target.dataset.speed);
                document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        // 显示选项
        ['showGrid', 'showTrajectory', 'showCollisionPoints', 
         'showPlayerRadius', 'showVectors', 'showStats'].forEach(option => {
            const elem = document.getElementById(option);
            if (elem) {
                elem.addEventListener('change', (e) => {
                    this.renderer.setOption(option, e.target.checked);
                });
            }
        });

        // Canvas 鼠标事件
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // 帮助模态框
        document.getElementById('closeHelp').addEventListener('click', () => {
            this.hideHelp();
        });

        document.getElementById('helpModal').addEventListener('click', (e) => {
            if (e.target.id === 'helpModal') {
                this.hideHelp();
            }
        });
    }

    /**
     * 绑定属性（双向同步）
     */
    bindProperty(inputId, sliderId, callback) {
        const input = document.getElementById(inputId);
        const slider = document.getElementById(sliderId);

        input.addEventListener('input', (e) => {
            const value = e.target.value;
            if (slider.max && parseFloat(value) <= parseFloat(slider.max)) {
                slider.value = value;
            }
            callback(value);
        });

        slider.addEventListener('input', (e) => {
            input.value = e.target.value;
            callback(e.target.value);
        });
    }

    /**
     * 初始化键盘快捷键
     */
    initializeKeyboard() {
        document.addEventListener('keydown', (e) => {
            // 在输入框中忽略
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                return;
            }

            switch (e.key.toLowerCase()) {
                case ' ':
                    e.preventDefault();
                    this.isPlaying ? this.stopPlayback() : this.startPlayback();
                    break;
                case 'r':
                    if (e.ctrlKey) return; // Ctrl+R 是浏览器刷新
                    if (!e.shiftKey) {
                        this.resetPlayback();
                    } else {
                        // Shift+R 切换到矩形工具
                        this.setTool('rectangle');
                    }
                    break;
                case 'g':
                    this.toggleOption('showGrid');
                    break;
                case 't':
                    this.toggleOption('showTrajectory');
                    break;
                case 'h':
                    this.showHelp();
                    break;
                case 'escape':
                    this.hideHelp();
                    break;
                case 'delete':
                    this.deleteSelected();
                    break;
                case 'v':
                    this.setTool('select');
                    break;
                case 'm':
                    if (!e.ctrlKey) {
                        this.setTool('move');
                    }
                    break;
                case 'p':
                    if (!e.ctrlKey) {
                        this.setTool('polygon');
                    }
                    break;
                case 'd':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.duplicateSelected();
                    }
                    break;
                case 'a':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.selectAll();
                    }
                    break;
                case 's':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        SceneSerializer.download(this, 'scene.json');
                    }
                    break;
            }

            // 传递给当前工具
            this.toolManager.handleKeyDown(e);
        });
    }

    /**
     * 切换显示选项
     */
    toggleOption(option) {
        const checkbox = document.getElementById(option);
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            this.renderer.setOption(option, checkbox.checked);
        }
    }

    /**
     * 删除选中的障碍物
     */
    deleteSelected() {
        const selected = this.toolManager.tools.select.selectedIndices;
        if (selected.length === 0) return;

        // 从后往前删除，避免索引问题
        selected.sort((a, b) => b - a);
        for (const index of selected) {
            this.obstacles.splice(index, 1);
        }

        this.toolManager.tools.select.clearSelection();
        this.movementEngine.setObstacles(this.obstacles);
        this.updateTrajectory();
        this.updateObstacleCount();
    }

    /**
     * 复制选中的障碍物
     */
    duplicateSelected() {
        const selected = this.toolManager.tools.select.selectedIndices;
        if (selected.length === 0) return;

        const newIndices = [];
        const offset = 20; // 偏移量

        for (const index of selected) {
            const obstacle = this.obstacles[index];
            const newVertices = obstacle.vertices.map(v => 
                new Vector2D(v.x + offset, v.y + offset)
            );
            const newObstacle = new Polygon(newVertices);
            this.obstacles.push(newObstacle);
            newIndices.push(this.obstacles.length - 1);
        }

        // 选中新创建的对象
        this.toolManager.tools.select.selectedIndices = newIndices;
        this.movementEngine.setObstacles(this.obstacles);
        this.updateTrajectory();
        this.updateObstacleCount();
    }

    /**
     * 全选障碍物
     */
    selectAll() {
        const selectTool = this.toolManager.tools.select;
        selectTool.selectedIndices = this.obstacles.map((_, i) => i);
    }

    /**
     * 初始化预设
     */
    initializePresets() {
        const select = document.getElementById('presetSelect');
        const presets = getPresetNames();
        
        for (const preset of presets) {
            const option = document.createElement('option');
            option.value = preset.key;
            option.textContent = preset.name;
            select.appendChild(option);
        }

        select.addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadPreset(e.target.value);
            }
        });
    }

    /**
     * 加载预设（自动居中视野）
     */
    loadPreset(key) {
        const preset = loadPreset(key);
        if (!preset) return;
        
        this.obstacles = preset.obstacles;
        this.movementEngine.setObstacles(this.obstacles);
        
        this.playerState = new PlayerState(
            preset.playerState.position.clone(),
            preset.playerState.angle,
            preset.playerState.moveSpeed,
            preset.playerState.isMoving
        );
        
        this.updateAllUI();
        this.resetPlayback();
        this.updateTrajectory();
        
        // 自动居中视野到场景
        this.centerViewOnScene();
    }

    /**
     * 居中视野到场景（包含所有障碍物和玩家）
     */
    centerViewOnScene() {
        if (this.obstacles.length === 0) {
            // 没有障碍物，居中到玩家
            this.centerViewOnPlayer();
            return;
        }

        // 计算场景边界
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        // 包含所有障碍物
        for (const obstacle of this.obstacles) {
            const bounds = obstacle.getBounds();
            minX = Math.min(minX, bounds.min.x);
            minY = Math.min(minY, bounds.min.y);
            maxX = Math.max(maxX, bounds.max.x);
            maxY = Math.max(maxY, bounds.max.y);
        }

        // 包含玩家
        const playerPos = this.playerState.position;
        minX = Math.min(minX, playerPos.x);
        minY = Math.min(minY, playerPos.y);
        maxX = Math.max(maxX, playerPos.x);
        maxY = Math.max(maxY, playerPos.y);

        // 计算场景中心和大小
        const sceneCenterX = (minX + maxX) / 2;
        const sceneCenterY = (minY + maxY) / 2;
        const sceneWidth = maxX - minX;
        const sceneHeight = maxY - minY;

        // 添加边距
        const padding = 100;
        const paddedWidth = sceneWidth + padding * 2;
        const paddedHeight = sceneHeight + padding * 2;

        // 计算合适的缩放比例
        const scaleX = this.canvas.width / paddedWidth;
        const scaleY = this.canvas.height / paddedHeight;
        const targetScale = Math.min(scaleX, scaleY, 1.5); // 最大1.5倍

        // 应用缩放和平移
        this.viewport.scale = targetScale;
        this.viewport.offsetX = this.canvas.width / 2 - sceneCenterX * targetScale;
        this.viewport.offsetY = this.canvas.height / 2 - sceneCenterY * targetScale;
    }

    /**
     * 鼠标事件
     */
    onMouseDown(e) {
        if (e.button === 1 || this.viewport.isPanning) {
            return; // 中键由视口处理
        }

        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const world = this.viewport.screenToWorld(screenX, screenY);

        if (e.button === 0) {
            // 左键：根据当前工具处理
            this.toolManager.handleMouseDown(world.x, world.y, e);
        } else if (e.button === 2) {
            // 右键：开始旋转玩家方向
            this.isRotatingPlayer = true;
            this.updatePlayerRotation(world.x, world.y);
        }
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const world = this.viewport.screenToWorld(screenX, screenY);

        this.mouseWorldX = world.x;
        this.mouseWorldY = world.y;

        // 右键拖拽旋转
        if (this.isRotatingPlayer) {
            this.updatePlayerRotation(world.x, world.y);
        } else {
            // 传递给工具管理器
            this.toolManager.handleMouseMove(world.x, world.y, e);
        }
    }

    onMouseUp(e) {
        if (e.button === 1) return;

        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const world = this.viewport.screenToWorld(screenX, screenY);

        // 结束右键旋转
        if (e.button === 2) {
            this.isRotatingPlayer = false;
        }

        this.toolManager.handleMouseUp(world.x, world.y, e);
    }

    /**
     * 双击进入顶点编辑模式 / 重置视图
     */
    onDoubleClick(e) {
        if (e.button !== 0) return;

        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const world = this.viewport.screenToWorld(screenX, screenY);

        const selectTool = this.toolManager.tools.select;
        const clickedIndex = selectTool.findObstacleAt(world.x, world.y);

        if (clickedIndex !== -1) {
            // 双击障碍物，进入顶点编辑模式
            selectTool.selectedIndices = [clickedIndex];
            this.setTool('vertexEdit');
        } else {
            // 双击空白处，重置视图
            this.viewport.reset();
        }
    }

    /**
     * 更新玩家旋转
     */
    updatePlayerRotation(worldX, worldY) {
        const dx = worldX - this.playerState.position.x;
        const dy = worldY - this.playerState.position.y;
        const angle = Math.atan2(dy, dx) * RAD_TO_DEG;
        this.playerState.angle = normalizeAngle(angle);
        
        document.getElementById('playerAngle').value = this.playerState.angle.toFixed(0);
        document.getElementById('playerAngleSlider').value = this.playerState.angle;
        
        this.updateTrajectory();
    }

    /**
     * 更新所有UI
     */
    updateAllUI() {
        document.getElementById('playerX').value = this.playerState.position.x.toFixed(0);
        document.getElementById('playerXSlider').value = this.playerState.position.x;
        document.getElementById('playerY').value = this.playerState.position.y.toFixed(0);
        document.getElementById('playerYSlider').value = this.playerState.position.y;
        document.getElementById('playerAngle').value = this.playerState.angle.toFixed(0);
        document.getElementById('playerAngleSlider').value = this.playerState.angle;
        document.getElementById('playerSpeed').value = this.playerState.moveSpeed;
        document.getElementById('playerSpeedSlider').value = this.playerState.moveSpeed;
        document.getElementById('playerRadius').value = this.movementEngine.getPlayerRadius();
        document.getElementById('playerRadiusSlider').value = this.movementEngine.getPlayerRadius();
        document.getElementById('playerIsMoving').checked = this.playerState.isMoving;
        document.getElementById('maxTime').value = this.maxTime;
        document.getElementById('maxTimeSlider').value = this.maxTime;
        document.getElementById('sampleRate').value = this.sampleRate;
        document.getElementById('sampleRateSlider').value = this.sampleRate;
    }

    /**
     * 生成随机地图（大范围分散生成，避开玩家）
     */
    generateRandomMap() {
        this.obstacles = [];
        
        // 定义更大的世界范围（不限于可见Canvas）
        const worldWidth = 3000;
        const worldHeight = 2000;
        const numObstacles = 50 + Math.floor(Math.random() * 151); // 50-200个

        const playerPos = this.playerState.position;
        const playerSafeRadius = 150; // 玩家周围150单位半径内不生成障碍物

        for (let i = 0; i < numObstacles; i++) {
            const type = Math.floor(Math.random() * 6);
            let obstacle = null;
            let attempts = 0;
            const maxAttempts = 20;

            // 尝试生成不与玩家冲突的障碍物
            while (attempts < maxAttempts) {
                switch (type) {
                    case 0: obstacle = this.createRectangleWall(worldWidth, worldHeight); break;
                    case 1: obstacle = this.createLShapeWall(worldWidth, worldHeight); break;
                    case 2: obstacle = this.createTShapeWall(worldWidth, worldHeight); break;
                    case 3: obstacle = this.createTriangleObstacle(worldWidth, worldHeight); break;
                    case 4: obstacle = this.createCrossWall(worldWidth, worldHeight); break;
                    case 5: obstacle = this.createHShapeWall(worldWidth, worldHeight); break;
                }

                // 检查是否与玩家冲突
                if (obstacle) {
                    const obstacleCenter = obstacle.getCenter();
                    const distanceToPlayer = playerPos.distance(obstacleCenter);
                    
                    if (distanceToPlayer > playerSafeRadius) {
                        break; // 安全距离，可以添加
                    }
                }
                
                obstacle = null;
                attempts++;
            }

            if (obstacle) this.obstacles.push(obstacle);
        }

        this.movementEngine.setObstacles(this.obstacles);
        this.updateTrajectory();
        this.updateObstacleCount();
    }

    createRectangleWall(worldWidth, worldHeight) {
        const x = 100 + Math.random() * (worldWidth - 200);
        const y = 100 + Math.random() * (worldHeight - 200);
        const width = 10 + Math.random() * 40;
        const height = 60 + Math.random() * 200;

        return new Polygon([
            new Vector2D(x, y),
            new Vector2D(x + width, y),
            new Vector2D(x + width, y + height),
            new Vector2D(x, y + height)
        ]);
    }

    createLShapeWall(worldWidth, worldHeight) {
        const x = 100 + Math.random() * (worldWidth - 300);
        const y = 100 + Math.random() * (worldHeight - 300);
        const width1 = 60 + Math.random() * 140;
        const width2 = 12 + Math.random() * 10;
        const height1 = 12 + Math.random() * 10;
        const height2 = 60 + Math.random() * 140;

        return new Polygon([
            new Vector2D(x, y),
            new Vector2D(x + width1, y),
            new Vector2D(x + width1, y + height1),
            new Vector2D(x + width2, y + height1),
            new Vector2D(x + width2, y + height2),
            new Vector2D(x, y + height2)
        ]);
    }

    createTShapeWall(worldWidth, worldHeight) {
        const x = 100 + Math.random() * (worldWidth - 300);
        const y = 100 + Math.random() * (worldHeight - 300);
        const width1 = 80 + Math.random() * 150;
        const width2 = 12 + Math.random() * 10;
        const height1 = 12 + Math.random() * 10;
        const height2 = 50 + Math.random() * 100;
        const centerX = x + width1 / 2;

        return new Polygon([
            new Vector2D(x, y),
            new Vector2D(x + width1, y),
            new Vector2D(x + width1, y + height1),
            new Vector2D(centerX + width2 / 2, y + height1),
            new Vector2D(centerX + width2 / 2, y + height1 + height2),
            new Vector2D(centerX - width2 / 2, y + height1 + height2),
            new Vector2D(centerX - width2 / 2, y + height1),
            new Vector2D(x, y + height1)
        ]);
    }

    createTriangleObstacle(worldWidth, worldHeight) {
        const x = 100 + Math.random() * (worldWidth - 200);
        const y = 100 + Math.random() * (worldHeight - 200);
        const size = 40 + Math.random() * 120;

        return new Polygon([
            new Vector2D(x, y),
            new Vector2D(x + size, y + size / 2),
            new Vector2D(x, y + size)
        ]);
    }

    createCrossWall(worldWidth, worldHeight) {
        const x = 100 + Math.random() * (worldWidth - 250);
        const y = 100 + Math.random() * (worldHeight - 250);
        const size = 80 + Math.random() * 100;
        const thickness = 15;

        const halfSize = size / 2;
        const halfThick = thickness / 2;

        return new Polygon([
            new Vector2D(x, y + halfSize - halfThick),
            new Vector2D(x + size, y + halfSize - halfThick),
            new Vector2D(x + size, y + halfSize + halfThick),
            new Vector2D(x + halfSize + halfThick, y + halfSize + halfThick),
            new Vector2D(x + halfSize + halfThick, y + size),
            new Vector2D(x + halfSize - halfThick, y + size),
            new Vector2D(x + halfSize - halfThick, y + halfSize + halfThick),
            new Vector2D(x, y + halfSize + halfThick),
            new Vector2D(x, y + halfSize - halfThick)
        ]);
    }

    createHShapeWall(worldWidth, worldHeight) {
        const x = 100 + Math.random() * (worldWidth - 300);
        const y = 100 + Math.random() * (worldHeight - 300);
        const width = 100 + Math.random() * 100;
        const height = 80 + Math.random() * 120;
        const thickness = 15;
        const midHeight = height / 2;
        const crossThick = 12;

        return new Polygon([
            new Vector2D(x, y),
            new Vector2D(x + thickness, y),
            new Vector2D(x + thickness, y + midHeight - crossThick/2),
            new Vector2D(x + width - thickness, y + midHeight - crossThick/2),
            new Vector2D(x + width - thickness, y),
            new Vector2D(x + width, y),
            new Vector2D(x + width, y + height),
            new Vector2D(x + width - thickness, y + height),
            new Vector2D(x + width - thickness, y + midHeight + crossThick/2),
            new Vector2D(x + thickness, y + midHeight + crossThick/2),
            new Vector2D(x + thickness, y + height),
            new Vector2D(x, y + height)
        ]);
    }

    /**
     * 更新轨迹（性能优化版）
     */
    updateTrajectory() {
        this.profiler.startMeasure('trajectoryCalculationTime');
        
        this.trajectory = this.movementEngine.calculateTrajectory(
            this.playerState,
            this.maxTime,
            this.sampleRate
        );
        
        this.profiler.endMeasure('trajectoryCalculationTime');
        this.profiler.recordTrajectoryCalculation(
            this.trajectory, 
            this.maxTime, 
            this.obstacles.length,
            this.movementEngine.spatialGrid // 传递空间网格以获取准确统计
        );
        
        this.updateTrajectoryInfo();
        this.updateObstacleCount();
        this.updatePerformanceDisplay();
    }

    /**
     * 更新轨迹信息
     */
    updateTrajectoryInfo() {
        const collisions = this.movementEngine.getCollisionPoints(this.trajectory);
        const slides = this.trajectory.filter(p => p.eventType === 'slide');
        
        let pathLength = 0;
        for (let i = 1; i < this.trajectory.length; i++) {
            pathLength += this.trajectory[i-1].position.distance(this.trajectory[i].position);
        }

        document.getElementById('totalCollisions').textContent = collisions.length;
        document.getElementById('slideEvents').textContent = slides.length;
        document.getElementById('pathLength').textContent = pathLength.toFixed(0);
        document.getElementById('trajectoryCount').textContent = `(${this.trajectory.length})`;
        document.getElementById('collisionDisplay').textContent = collisions.length;
    }

    /**
     * 更新障碍物数量
     */
    updateObstacleCount() {
        document.getElementById('obstacleCount').textContent = `(${this.obstacles.length})`;
    }

    /**
     * 更新性能显示
     */
    updatePerformanceDisplay() {
        // 更新统计面板
        document.getElementById('calcTimeValue').textContent = 
            `${this.profiler.metrics.trajectoryCalculationTime.toFixed(2)}ms`;
        document.getElementById('samplePointsValue').textContent = 
            this.profiler.metrics.pathSampleCount.toLocaleString();
        document.getElementById('detectionCountValue').textContent = 
            this.profiler.metrics.totalDetections.toLocaleString();
        document.getElementById('lastCalcTime').textContent = 
            this.profiler.metrics.lastCalculationTime || '--:--';
    }

    /**
     * 播放控制
     */
    startPlayback() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        document.getElementById('btnPlay').disabled = true;
        document.getElementById('btnPause').disabled = false;
        
        this.lastPlaybackTime = performance.now();
        const startTime = this.currentTime;
        
        const animate = (timestamp) => {
            if (!this.isPlaying) return;
            
            const elapsed = (timestamp - this.lastPlaybackTime) / 1000 * this.playbackSpeed;
            this.lastPlaybackTime = timestamp;
            this.currentTime = Math.min(this.currentTime + elapsed, this.maxTime);
            
            if (this.currentTime >= this.maxTime) {
                this.currentTime = this.maxTime;
                this.stopPlayback();
            }
            
            document.getElementById('timeSlider').value = this.currentTime;
            this.updateTimeDisplay();
            
            this.animationId = requestAnimationFrame(animate);
        };
        
        this.animationId = requestAnimationFrame(animate);
    }

    stopPlayback() {
        this.isPlaying = false;
        document.getElementById('btnPlay').disabled = false;
        document.getElementById('btnPause').disabled = true;
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    resetPlayback() {
        this.stopPlayback();
        this.currentTime = 0;
        document.getElementById('timeSlider').value = 0;
        this.updateTimeDisplay();
    }

    /**
     * 更新时间显示
     */
    updateTimeDisplay() {
        const formatted = this.formatTime(this.currentTime);
        document.getElementById('timeDisplay').textContent = formatted;
        document.getElementById('currentTimeDisplay').textContent = this.currentTime.toFixed(2) + 's';
    }

    updateMaxTimeDisplay() {
        const formatted = this.formatTime(this.maxTime);
        document.getElementById('maxTimeDisplay').textContent = formatted;
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(2);
        return `${mins.toString().padStart(2, '0')}:${secs.padStart(5, '0')}`;
    }

    /**
     * 切换工具
     */
    setTool(toolType) {
        this.toolManager.setTool(toolType);
        
        // 更新工具按钮状态
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`.tool-btn[data-tool="${toolType}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }


    /**
     * 显示/隐藏帮助
     */
    showHelp() {
        document.getElementById('helpModal').classList.add('show');
    }

    hideHelp() {
        document.getElementById('helpModal').classList.remove('show');
    }

    /**
     * 渲染循环（独立于播放）
     */
    startRenderLoop() {
        const renderFrame = (timestamp) => {
            // 计算帧耗时
            const frameTime = timestamp - this.lastFrameTime;
            this.lastFrameTime = timestamp;

            // 更新FPS
            this.frameCount++;
            if (timestamp - this.fpsUpdateTime >= 1000) {
                this.fps = Math.round(this.frameCount * 1000 / (timestamp - this.fpsUpdateTime));
                this.frameCount = 0;
                this.fpsUpdateTime = timestamp;
                
                this.profiler.updateFPS(this.fps, frameTime);
                document.getElementById('fpsValue').textContent = this.fps;
                document.getElementById('frameTimeValue').textContent = `${frameTime.toFixed(2)}ms`;
            }

            this.render();
            requestAnimationFrame(renderFrame);
        };

        requestAnimationFrame(renderFrame);
    }

    /**
     * 渲染
     */
    render() {
        // 清空画布
        this.renderer.clear();
        
        // 绘制网格
        this.renderer.drawGrid(this.gridSize);
        
        // 绘制障碍物
        const selectedIndices = this.toolManager.tools.select.selectedIndices;
        this.renderer.drawObstacles(this.obstacles, selectedIndices);
        
        // 绘制轨迹
        this.renderer.drawTrajectory(this.trajectory);
        
        // 绘制碰撞点（传递玩家半径）
        const collisionPoints = this.movementEngine.getCollisionPoints(this.trajectory);
        const playerRadius = this.movementEngine.getPlayerRadius();
        this.renderer.drawCollisionPoints(collisionPoints, playerRadius);
        
        // 计算当前位置（修复：使用插值以避免闪现）
        const currentPosition = this.calculateInterpolatedPosition();
        
        // 绘制玩家
        this.renderer.drawPlayer(
            currentPosition,
            this.playerState.angle,
            this.movementEngine.getPlayerRadius(),
            true
        );
        
        // 绘制当前工具
        this.toolManager.render(this.renderer.ctx);
        
        // 更新位置显示
        document.getElementById('positionDisplay').textContent = 
            `(${currentPosition.x.toFixed(0)}, ${currentPosition.y.toFixed(0)})`;
        
        const distance = this.playerState.position.distance(currentPosition);
        document.getElementById('distanceDisplay').textContent = distance.toFixed(0);
        
        // 绘制缩放比例
        this.renderer.drawScreenText(
            `${this.viewport.getScalePercent()}%`,
            this.canvas.width - 60,
            this.canvas.height - 10,
            '#9d9d9d',
            11
        );
    }

    /**
     * 计算插值位置（修复闪现）
     */
    calculateInterpolatedPosition() {
        if (this.trajectory.length === 0) {
            return this.playerState.position.clone();
        }

        // 在轨迹点之间进行线性插值
        for (let i = 0; i < this.trajectory.length - 1; i++) {
            const current = this.trajectory[i];
            const next = this.trajectory[i + 1];

            if (this.currentTime >= current.time && this.currentTime <= next.time) {
                const t = (this.currentTime - current.time) / (next.time - current.time);
                return current.position.lerp(next.position, t);
            }
        }

        // 如果超出范围，返回最后一个位置
        if (this.currentTime >= this.trajectory[this.trajectory.length - 1].time) {
            return this.trajectory[this.trajectory.length - 1].position.clone();
        }

        return this.trajectory[0].position.clone();
    }
}

// 应用启动
window.addEventListener('DOMContentLoaded', () => {
    const app = new EditorApp();
    window.editorApp = app;
});
