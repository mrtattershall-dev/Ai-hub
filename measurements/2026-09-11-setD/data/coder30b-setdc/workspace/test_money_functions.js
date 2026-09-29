const { sumMoney, compareMoney } = require('./r8_money.js');

// Test sumMoney
console.log("Testing sumMoney:");
console.log("sumMoney([]):", sumMoney([])); // Should be 0
console.log("sumMoney([100, 200]):", sumMoney([100, 200])); // Should be 300
console.log("sumMoney([50, -25, 75]):", sumMoney([50, -25, 75])); // Should be 100

// Test compareMoney
console.log("\nTesting compareMoney:");
console.log("compareMoney(100, 200):", compareMoney(100, 200)); // Should be -1
console.log("compareMoney(200, 100):", compareMoney(200, 100)); // Should be 1
console.log("compareMoney(100, 100):", compareMoney(100, 100)); // Should be 0

// Test error handling for sumMoney
try {
    sumMoney([100, 200.5]);
} catch (e) {
    console.log("sumMoney error handling works:", e.message);
}

// Test error handling for compareMoney
try {
    compareMoney(100, 200.5);
} catch (e) {
    console.log("compareMoney error handling works:", e.message);
}