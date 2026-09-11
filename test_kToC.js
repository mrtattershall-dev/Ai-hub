const { kToC } = require('./t1_temp.js');

// Test valid conversion
console.log("273.15 K =", kToC(273.15), "°C"); // Should be 0
console.log("373.15 K =", kToC(373.15), "°C"); // Should be 100

// Test error case
try {
    console.log(kToC(-10));
} catch (e) {
    console.log("Error caught:", e.message);
}