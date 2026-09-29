/**
 * Vector2D - 2D 向量运算库
 * 参考 Go 代码: calcutils/vector2d.go
 */

class Vector2D {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    // 向量加法
    add(other) {
        return new Vector2D(this.x + other.x, this.y + other.y);
    }

    // 向量减法
    sub(other) {
        return new Vector2D(this.x - other.x, this.y - other.y);
    }

    // 标量乘法
    mul(scalar) {
        return new Vector2D(this.x * scalar, this.y * scalar);
    }

    // 点积
    dot(other) {
        return this.x * other.x + this.y * other.y;
    }

    // 叉积（2D中返回标量）
    cross(other) {
        return this.x * other.y - this.y * other.x;
    }

    // 向量长度
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    // 向量长度的平方（避免开方运算）
    lengthSquared() {
        return this.x * this.x + this.y * this.y;
    }

    // 向量归一化
    normalize() {
        const len = this.length();
        if (len === 0) {
            return new Vector2D(0, 0);
        }
        return new Vector2D(this.x / len, this.y / len);
    }

    // 计算到另一个向量的距离
    distance(other) {
        return this.sub(other).length();
    }

    // 计算到另一个向量的距离平方
    distanceSquared(other) {
        return this.sub(other).lengthSquared();
    }

    // 向量旋转（角度制）
    rotate(angleDegrees) {
        const radian = angleDegrees * Math.PI / 180;
        const cos = Math.cos(radian);
        const sin = Math.sin(radian);
        return new Vector2D(
            this.x * cos - this.y * sin,
            this.x * sin + this.y * cos
        );
    }

    // 计算向量角度（角度制，-180到180）
    angle() {
        return Math.atan2(this.y, this.x) * 180 / Math.PI;
    }

    // 获取垂直向量（逆时针90度）
    perpendicular() {
        return new Vector2D(-this.y, this.x);
    }

    // 向量投影到另一个向量上
    project(onto) {
        const dot = this.dot(onto);
        const lengthSq = onto.lengthSquared();
        if (lengthSq === 0) {
            return new Vector2D(0, 0);
        }
        return onto.mul(dot / lengthSq);
    }

    // 线性插值
    lerp(other, t) {
        return new Vector2D(
            this.x + (other.x - this.x) * t,
            this.y + (other.y - this.y) * t
        );
    }

    // 判断是否为零向量
    isZero() {
        const epsilon = 1e-10;
        return Math.abs(this.x) < epsilon && Math.abs(this.y) < epsilon;
    }

    // 判断两个向量是否相等
    equals(other) {
        const epsilon = 1e-10;
        return Math.abs(this.x - other.x) < epsilon && 
               Math.abs(this.y - other.y) < epsilon;
    }

    // 复制向量
    clone() {
        return new Vector2D(this.x, this.y);
    }

    // 转换为字符串
    toString() {
        return `(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
    }
}

// 辅助函数
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function degreesToRadians(degrees) {
    return degrees * DEG_TO_RAD;
}

function radiansToDegrees(radians) {
    return radians * RAD_TO_DEG;
}

function normalizeAngle(angle) {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

