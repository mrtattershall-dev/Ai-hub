function cToF(c) {
    return (c * 9/5) + 32;
}

function fToC(f) {
    return (f - 32) * 5/9;
}

module.exports = {
    cToF,
    fToC
};
const assert = require('assert');

// Test cToF function
assert.strictEqual(cToF(0), 32);
assert.strictEqual(cToF(100), 212);
assert.strictEqual(cToF(-40), -40);

// Test fToC function
assert.strictEqual(fToC(32), 0);
assert.strictEqual(fToC(212), 100);
assert.strictEqual(fToC(-40), -40);

console.log("All tests passed!");
function kToC(k) {
    if (k < 0) {
        throw new Error("Temperature in Kelvin cannot be negative");
    }
    return k - 273.15;
}
