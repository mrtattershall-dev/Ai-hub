function cToF(c) {
    return (c * 9/5) + 32;
}

function fToC(f) {
    return (f - 32) * 5/9;
}
const assert = require('assert');

// Test cToF function
assert.strictEqual(cToF(0), 32, '0°C should be 32°F');
assert.strictEqual(cToF(100), 212, '100°C should be 212°F');
assert.strictEqual(cToF(-40), -40, '-40°C should be -40°F');

// Test fToC function
assert.strictEqual(fToC(32), 0, '32°F should be 0°C');
assert.strictEqual(fToC(212), 100, '212°F should be 100°C');
assert.strictEqual(fToC(-40), -40, '-40°F should be -40°C');
function kToC(k) {
    if (k < 0) {
        throw new Error("Temperature in Kelvin cannot be negative");
    }
    return k - 273.15;
}

// Test kToC function
try {
    assert.strictEqual(kToC(0), -273.15, '0K should be -273.15°C');
    assert.strictEqual(kToC(273.15), 0, '273.15K should be 0°C');
    assert.strictEqual(kToC(373.15), 100, '373.15K should be 100°C');
    console.log("All tests passed.");
} catch (error) {
    console.error(error.message);
}
