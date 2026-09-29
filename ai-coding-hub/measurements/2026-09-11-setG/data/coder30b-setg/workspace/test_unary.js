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

console.log("\nTesting '2*x' with x=5:");
try {
    const result = evaluate('2*x', {x: 5});
    console.log("Result:", result);
    console.assert(result === 10, "Expected 10");
    console.log("✓ Test passed!");
} catch (e) {
    console.log("Error:", e.message);
}

console.log("\nTesting 'x+y' with x=3, y=4:");
try {
    const result = evaluate('x+y', {x: 3, y: 4});
    console.log("Result:", result);
    console.assert(result === 7, "Expected 7");
    console.log("✓ Test passed!");
} catch (e) {
    console.log("Error:", e.message);
}

console.log("\nTesting 'x+y*z' with x=2, y=3, z=4:");
try {
    const result = evaluate('x+y*z', {x: 2, y: 3, z: 4});
    console.log("Result:", result);
    console.assert(result === 14, "Expected 14");
    console.log("✓ Test passed!");
} catch (e) {
    console.log("Error:", e.message);
}

console.log("\nTesting 'unknown_var' (should throw error):");
try {
    const result = evaluate('unknown_var', {x: 5});
    console.log("Result:", result);
    console.log("✗ Test failed - should have thrown error");
} catch (e) {
    console.log("Error:", e.message);
    if (e.message.includes('unknown_var')) {
        console.log("✓ Test passed!");
    } else {
        console.log("✗ Test failed - wrong error message");
    }
}

console.log("\nTesting 'x+y' with x=10, y=20:");
try {
    const result = evaluate('x+y', {x: 10, y: 20});
    console.log("Result:", result);
    console.assert(result === 30, "Expected 30");
    console.log("✓ Test passed!");
} catch (e) {
    console.log("Error:", e.message);
}

console.log("\nAll tests completed!");