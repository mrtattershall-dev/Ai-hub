module.exports = {
    add: function(a, b) {
        // Implementation will go here
    },
multiply: function(a, b) {
    if (a[0].length !== b.length) {
        throw new Error("Matrix dimensions do not match for multiplication");
    }
    let result = [];
    for (let i = 0; i < a.length; i++) {
        let row = [];
        for (let j = 0; j < b[0].length; j++) {
            let sum = 0;
            for (let k = 0; k < b.length; k++) {
                sum += a[i][k] * b[k][j];
            }
            row.push(sum);
        }
        result.push(row);
    }
    return result;
}
};
    determinant: function determinant(matrix) {
        if (!Array.isArray(matrix) || matrix.length === 0) {
            throw new Error("Invalid matrix");
        }
        const n = matrix.length;
        for (let i = 0; i < n; i++) {
            if (!Array.isArray(matrix[i]) || matrix[i].length !== n) {
                throw new Error("Matrix must be square");
            }
        }
        if (n === 1) {
            return matrix[0][0];
        }
        if (n === 2) {
            return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
        }
        let det = 0;
        for (let col = 0; col < n; col++) {
            const subMatrix = [];
            for (let row = 1; row < n; row++) {
                const newRow = [];
                for (let c = 0; c < n; c++) {
                    if (c !== col) {
                        newRow.push(matrix[row][c]);
                    }
                }
                subMatrix.push(newRow);
            }
            det += Math.pow(-1, col) * matrix[0][col] * this.determinant(subMatrix);
        }
        return det;
    }
/**
 * Calculate the inverse of a matrix.
 * @param {number[][]} matrix - The matrix to invert.
 * @returns {number[][]} - The inverse of the matrix.
 * @throws {Error} - If the matrix is singular.
 */
function inverse(matrix) {
    const n = matrix.length;
    if (n !== matrix[0].length) {
        throw new Error("Matrix must be square");
    }

    const identity = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
    );

    const augmentedMatrix = matrix.map((row, i) => [...row, ...identity[i]]);

    for (let i = 0; i < n; i++) {
        let maxRow = i;
        for (let j = i + 1; j < n; j++) {
            if (Math.abs(augmentedMatrix[j][i]) > Math.abs(augmentedMatrix[maxRow][i])) {
                maxRow = j;
            }
        }

        [augmentedMatrix[i], augmentedMatrix[maxRow]] = [augmentedMatrix[maxRow], augmentedMatrix[i]];

        const pivot = augmentedMatrix[i][i];
        if (pivot === 0) {
            throw new Error("Matrix is singular");
        }

        for (let j = i; j < 2 * n; j++) {
            augmentedMatrix[i][j] /= pivot;
        }

        for (let k = 0; k < n; k++) {
            if (k !== i) {
                const factor = augmentedMatrix[k][i];
                for (let j = i; j < 2 * n; j++) {
                    augmentedMatrix[k][j] -= factor * augmentedMatrix[i][j];
                }
            }
        }
    }

    const inverseMatrix = augmentedMatrix.map(row => row.slice(n));
    return inverseMatrix;
}

module.exports = {
    add,
    multiply,
    determinant,
    inverse
};
/**
 * Test the inverse function.
 */
function testInverse() {
    const matrix = [
        [4, 7],
        [2, 6]
    ];

    const inverseMatrix = inverse(matrix);

    const identityMatrix = multiply(matrix, inverseMatrix);

    const identity = Array.from({ length: matrix.length }, (_, i) =>
        Array.from({ length: matrix.length }, (_, j) => (i === j ? 1 : 0))
    );

    const epsilon = 1e-10;
    for (let i = 0; i < identity.length; i++) {
        for (let j = 0; j < identity[i].length; j++) {
            if (Math.abs(identityMatrix[i][j] - identity[i][j]) > epsilon) {
                throw new Error("Inverse test failed: result is not the identity matrix");
            }
        }
    }

    console.log("Inverse test passed");
}

testInverse();
