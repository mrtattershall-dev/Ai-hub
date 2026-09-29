// 通用工具：确定性随机、数学、几何

/** xorshift32 确定性随机数发生器，保证同一 seed 生成同一层 */
export class RNG {
  constructor(seed = 1) {
    this.s = seed >>> 0 || 1;
  }
  next() {
    let x = this.s;
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    this.s = x;
    return x / 4294967296;
  }
  /** [0, n) 整数 */
  int(n) { return Math.floor(this.next() * n); }
  /** [a, b] 闭区间整数 */
  range(a, b) { return a + this.int(b - a + 1); }
  float(a, b) { return a + this.next() * (b - a); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[this.int(arr.length)]; }
  /** 带权重挑选：items 为 [{w:权重, ...}] */
  weighted(items) {
    let total = 0;
    for (const it of items) total += it.w;
    let r = this.next() * total;
    for (const it of items) { r -= it.w; if (r <= 0) return it; }
    return items[items.length - 1];
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const dist2 = (ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy;
};

/** 把向量归一化到长度 len，零向量返回 0,0 */
export function norm(dx, dy, len = 1) {
  const m = Math.hypot(dx, dy);
  if (m < 1e-6) return [0, 0];
  return [dx / m * len, dy / m * len];
}

/** 朝目标角度平滑转向 */
export function approach(cur, target, step) {
  if (cur < target) return Math.min(cur + step, target);
  return Math.max(cur - step, target);
}

/** 四方向常量，与门 / 朝向共用 */
export const DIR = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };
export const DIR_VEC = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const DIR_OPPOSITE = [2, 3, 0, 1];

/** 由向量得到主方向（用于选精灵朝向） */
export function vecToDir(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? DIR.RIGHT : DIR.LEFT;
  return dy > 0 ? DIR.DOWN : DIR.UP;
}
