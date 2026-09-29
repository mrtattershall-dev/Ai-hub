const assert = require('assert');
const { add, multiply } = require('./s4_matrix.js');

// Test add function
try {
    assert.deepStrictEqual(add([[1, 2], [3, 4]], [[5, 6], [7, 8]]), [[6, 8], [10, 12]]);
    console.log("add function passed");
} catch (e) {
    console.error("add function failed:", e.message);
}

try {
    add([[1, 2], [3, 4]], [[5, 6]]);
    console.error("add function should have thrown an error for mismatched dimensions");
} catch (e) {
    console.log("add function correctly threw an error for mismatched dimensions");
}

// Test multiply function
try {
    assert.deepStrictEqual(multiply([[1, 2], [3, 4]], [[5, 6], [7, 8]]), [[19, 22], [43, 50]]);
    console.log("multiply function passed");
} catch (e) {
    console.error("multiply function failed:", e.message);
}

try {
    multiply([[1, 2], [3, 4]], [[5, 6], [7, 8], [9, 10]]);
    console.error("multiply function should have thrown an error for mismatched dimensions");
} catch (e) {
    console.log("multiply function correctly threw an error for mismatched dimensions");
}