// Temperature conversion functions with assertions

function cToF(celsius) {
    return (celsius * 9/5) + 32;
}

function fToC(fahrenheit) {
    return (fahrenheit - 32) * 5/9;
}

// Assertions to verify correctness
console.assert(cToF(0) === 32, "0°C should equal 32°F");
console.assert(cToF(100) === 212, "100°C should equal 212°F");
console.assert(fToC(32) === 0, "32°F should equal 0°C");
console.assert(fToC(212) === 100, "212°F should equal 100°C");

// Additional test cases
console.assert(cToF(-40) === -40, "-40°C should equal -40°F");
console.assert(fToC(-40) === -40, "-40°F should equal -40°C");

console.log("All tests passed");
function kToC(k) {
    if (k < 0) {
        throw new Error("Temperature in Kelvin cannot be negative");
    }
    return k - 273.15;
}
