const { evaluate } = require('./s5_expr.js');

console.log("Testing '-(2+3)*2':");
try {
    const result = evaluate('-(2+3)*2');
    console.log("Result:", result);
    console.assert(result === -10, "Expected -10");
    console.log("✓ Test passed!");
} catch (e) {
    console.log("Error:", e.message);
}

console.log("\nTesting '2*-3':");
try {
    const result = evaluate('2*-3');
    console.log("Result:", result);
    console.assert(result === -6, "Expected -6");
    console.log("✓ Test passed!");
} catch (e) {
    console.log("Error:", e.message);
}

console.log("\nAll tests completed!");