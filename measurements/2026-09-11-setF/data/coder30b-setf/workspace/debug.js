const { evaluate } = require('./s5_expr.js');

// Simple test
try {
    console.log("Testing min function...");
    const result = evaluate("min(1, 2, 3)");
    console.log("Result:", result);
} catch (e) {
    console.log("Error:", e.message);
}