/**
 * Presets - 预设场景
 * 提供一些精心设计的演示场景
 * 坐标范围：1000-2000 (适配世界中心3000x2000)
 */

const DemoPresets = {
    /**
     * 场景1：简单墙面滑行
     */
    simpleWallSlide: {
        name: '简单墙面滑行',
        description: '展示基本的墙面滑行效果',
        obstacles: [
            // 一面垂直墙
            new Polygon([
                new Vector2D(1600, 700),
                new Vector2D(1640, 700),
                new Vector2D(1640, 1300),
                new Vector2D(1600, 1300)
            ])
        ],
        playerState: {
            position: new Vector2D(1200, 1000),
            angle: 45,  // 斜向撞墙
            moveSpeed: 300,
            isMoving: true
        }
    },

    /**
     * 场景2：L型拐角
     */
    lCorner: {
        name: 'L型拐角滑行',
        description: '展示在L型拐角处的流畅滑行',
        obstacles: [
            new Polygon([
                new Vector2D(1400, 800),
                new Vector2D(1800, 800),
                new Vector2D(1800, 840),
                new Vector2D(1440, 840),
                new Vector2D(1440, 1200),
                new Vector2D(1400, 1200)
            ])
        ],
        playerState: {
            position: new Vector2D(1200, 700),
            angle: 60,
            moveSpeed: 300,
            isMoving: true
        }
    },

    /**
     * 场景3：狭窄通道
     */
    narrowCorridor: {
        name: '狭窄通道',
        description: '展示在狭窄通道中的移动',
        obstacles: [
            // 上墙
            new Polygon([
                new Vector2D(1200, 850),
                new Vector2D(1800, 850),
                new Vector2D(1800, 890),
                new Vector2D(1200, 890)
            ]),
            // 下墙
            new Polygon([
                new Vector2D(1200, 1110),
                new Vector2D(1800, 1110),
                new Vector2D(1800, 1150),
                new Vector2D(1200, 1150)
            ])
        ],
        playerState: {
            position: new Vector2D(1100, 1000),
            angle: 10,  // 略微向上
            moveSpeed: 300,
            isMoving: true
        }
    },

    /**
     * 场景4：十字路口
     */
    crossroads: {
        name: '十字路口',
        description: '展示在复杂十字路口的移动',
        obstacles: [
            // 左上
            new Polygon([
                new Vector2D(1100, 700),
                new Vector2D(1450, 700),
                new Vector2D(1450, 950),
                new Vector2D(1100, 950)
            ]),
            // 右上
            new Polygon([
                new Vector2D(1600, 700),
                new Vector2D(1950, 700),
                new Vector2D(1950, 950),
                new Vector2D(1600, 950)
            ]),
            // 左下
            new Polygon([
                new Vector2D(1100, 1050),
                new Vector2D(1450, 1050),
                new Vector2D(1450, 1300),
                new Vector2D(1100, 1300)
            ]),
            // 右下
            new Polygon([
                new Vector2D(1600, 1050),
                new Vector2D(1950, 1050),
                new Vector2D(1950, 1300),
                new Vector2D(1600, 1300)
            ])
        ],
        playerState: {
            position: new Vector2D(1100, 1000),
            angle: 0,
            moveSpeed: 300,
            isMoving: true
        }
    },

    /**
     * 场景5：长距离移动
     */
    longDistance: {
        name: '长距离移动',
        description: '展示30秒长距离移动的精确性',
        obstacles: [
            // 中间的一些障碍物
            new Polygon([
                new Vector2D(1400, 950),
                new Vector2D(1440, 950),
                new Vector2D(1440, 1050),
                new Vector2D(1400, 1050)
            ]),
            new Polygon([
                new Vector2D(1700, 900),
                new Vector2D(1740, 900),
                new Vector2D(1740, 1100),
                new Vector2D(1700, 1100)
            ])
        ],
        playerState: {
            position: new Vector2D(1100, 1000),
            angle: 0,
            moveSpeed: 300,
            isMoving: true
        }
    },

    /**
     * 场景6：迷宫
     */
    maze: {
        name: '复杂迷宫',
        description: '展示在复杂迷宫中的路径计算',
        obstacles: [
            // 外墙
            new Polygon([
                new Vector2D(1100, 700),
                new Vector2D(1900, 700),
                new Vector2D(1900, 740),
                new Vector2D(1140, 740),
                new Vector2D(1140, 1260),
                new Vector2D(1900, 1260),
                new Vector2D(1900, 1300),
                new Vector2D(1100, 1300)
            ]),
            // 内部墙1
            new Polygon([
                new Vector2D(1250, 800),
                new Vector2D(1290, 800),
                new Vector2D(1290, 1200),
                new Vector2D(1250, 1200)
            ]),
            // 内部墙2
            new Polygon([
                new Vector2D(1500, 750),
                new Vector2D(1540, 750),
                new Vector2D(1540, 1150),
                new Vector2D(1500, 1150)
            ]),
            // 内部墙3
            new Polygon([
                new Vector2D(1700, 800),
                new Vector2D(1740, 800),
                new Vector2D(1740, 1250),
                new Vector2D(1700, 1250)
            ])
        ],
        playerState: {
            position: new Vector2D(1180, 1000),
            angle: 30,
            moveSpeed: 300,
            isMoving: true
        }
    }
};

/**
 * 获取所有预设场景的名称列表
 */
function getPresetNames() {
    return Object.keys(DemoPresets).map(key => ({
        key: key,
        name: DemoPresets[key].name,
        description: DemoPresets[key].description
    }));
}

/**
 * 加载预设场景
 */
function loadPreset(presetKey) {
    if (presetKey in DemoPresets) {
        return DemoPresets[presetKey];
    }
    return null;
}

