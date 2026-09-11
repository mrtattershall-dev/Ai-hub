const assert = require('assert');

function transpose(m) {
    if (!Array.isArray(m) || m.length === 0 || !Array.isArray(m[0])) {
        throw new Error('Input must be a non-empty 2D array');
    }
    const rows = m.length;
    const cols = m[0].length;
    const transposed = Array.from({ length: cols }, () => Array(rows));
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            transposed[j][i] = m[i][j];
        }
    }
    return transposed;
}

// Test cases for transpose
assert.deepStrictEqual(transpose([[1, 2], [3, 4]]), [[1, 3], [2, 4]]);
assert.deepStrictEqual(transpose([[1, 2, 3], [4, 5, 6]]), [[1, 4], [2, 5], [3, 6]]);
assert.deepStrictEqual(transpose([[1]]), [[1]]);
assert.throws(() => transpose([]), { message: 'Input must be a non-empty 2D array' });
assert.throws(() => transpose([1, 2, 3]), { message: 'Input must be a non-empty 2D array' });

module.exports = { transpose };
function multiply(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0 || !Array.isArray(a[0]) || !Array.isArray(b[0])) {
        throw new Error('Inputs must be non-empty 2D arrays');
    }
    if (a[0].length !== b.length) {
        throw new Error('Number of columns in A must be equal to number of rows in B');
    }
    const rowsA = a.length;
    const colsA = a[0].length;
    const colsB = b[0].length;
    const result = Array.from({ length: rowsA }, () => Array(colsB).fill(0));
    for (let i = 0; i < rowsA; i++) {
        for (let j = 0; j < colsB; j++) {
            for (let k = 0; k < colsA; k++) {
                result[i][j] += a[i][k] * b[k][j];
            }
        }
    }
    return result;
}

// Test cases for multiply
assert.deepStrictEqual(multiply([[1, 2], [3, 4]], [[2, 0], [1, 2]]), [[4, 4], [10, 8]]);
assert.deepStrictEqual(multiply([[1, 2, 3], [4, 5, 6]], [[7, 8], [9, 10], [11, 12]]), [[58, 64], [139, 154]]);
assert.throws(() => multiply([[1, 2], [3, 4]], [[1, 2, 3]]), { message: 'Number of columns in A must be equal to number of rows in B' });
assert.throws(() => multiply([], [[1, 2]]), { message: 'Inputs must be non-empty 2D arrays' });
assert.throws(() => multiply([[1, 2], [3, 4]], []), { message: 'Inputs must be non-empty 2D arrays' });

module.exports = { transpose, multiply };
function identity(n) {
    return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
}

// Test cases for identity
assert.deepStrictEqual(identity(2), [[1, 0], [0, 1]]);
assert.deepStrictEqual(identity(3), [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
assert.deepStrictEqual(identity(1), [[1]]);

module.exports = { transpose, multiply, identity };
