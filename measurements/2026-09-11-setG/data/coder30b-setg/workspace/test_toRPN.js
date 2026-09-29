// Test script for toRPN function
const fs = require('fs');

// Read the s5_expr.js file and evaluate it
const exprCode = fs.readFileSync('s5_expr.js', 'utf8');
eval(exprCode);

// Test cases
console.log('Testing toRPN function:');
console.log('toRPN("1 + 2 * x"):', toRPN('1 + 2 * x'));
console.log('Expected: ["1", "2", "x", "*", "+"]');

console.log('toRPN("2 + 3 * 4"):', toRPN('2 + 3 * 4'));
console.log('Expected: ["2", "3", "4", "*", "+"]');

console.log('toRPN("(2 + 3) * 4"):', toRPN('(2 + 3) * 4'));
console.log('Expected: ["2", "3", "+", "4", "*"]');

console.log('toRPN("2 ^ 3 ^ 4"):', toRPN('2 ^ 3 ^ 4'));
console.log('Expected: ["2", "3", "4", "^", "^"]');