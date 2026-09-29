// Debug the invalid expression case
const { evaluate } = require('./s5_expr.js');

try {
    console.log("Testing 'invalid':");
    const result = evaluate("invalid");
    console.log("Result:", result);
} catch (e) {
    console.log("Error:", e.message);
    console.log("Error type:", e.constructor.name);
}