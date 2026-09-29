// 键盘输入。沿用原作布局：WASD 移动、方向键射击，两套互不干扰。

const MOVE_KEYS = {
  KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0],
};
const FIRE_KEYS = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  KeyI: [0, -1], KeyK: [0, 1], KeyJ: [-1, 0], KeyL: [1, 0],
};

export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set();
    this.fireOrder = [];      // 记录按下顺序，让后按的方向优先（原作手感）

    target.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      // 方向键与空格会滚动页面，拦掉
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      this.down.add(e.code);
      this.pressed.add(e.code);
      if (FIRE_KEYS[e.code]) {
        this.fireOrder = this.fireOrder.filter((c) => c !== e.code);
        this.fireOrder.push(e.code);
      }
    });
    target.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.fireOrder = this.fireOrder.filter((c) => c !== e.code);
    });
    target.addEventListener('blur', () => { this.down.clear(); this.fireOrder.length = 0; });
  }

  isDown(code) { return this.down.has(code); }

  /** 本帧刚按下（消费一次） */
  wasPressed(code) {
    if (this.pressed.has(code)) { this.pressed.delete(code); return true; }
    return false;
  }

  endFrame() { this.pressed.clear(); }

  moveVector() {
    let x = 0, y = 0;
    for (const [code, v] of Object.entries(MOVE_KEYS)) {
      if (this.down.has(code)) { x += v[0]; y += v[1]; }
    }
    if (x && y) { const m = Math.SQRT1_2; x *= m; y *= m; }
    return [x, y];
  }

  fireVector() {
    // 只取最后按下的那个方向，避免斜向射击时手感发飘
    for (let i = this.fireOrder.length - 1; i >= 0; i--) {
      const v = FIRE_KEYS[this.fireOrder[i]];
      if (v && this.down.has(this.fireOrder[i])) return v;
    }
    return [0, 0];
  }
}
