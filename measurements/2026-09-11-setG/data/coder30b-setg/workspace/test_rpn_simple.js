// Simple test for toRPN function
const fs = require('fs');

// Read the s5_expr.js file and evaluate it
const exprCode = fs.readFileSync('s5_expr.js', 'utf8');
eval(exprCode);

// Test the toRPN function directly
console.log('Testing toRPN function:');
try {
    console.log('toRPN("1 + 2 * x"):', toRPN('1 + 2 * x'));
    console.log('toRPN("2 + 3 * 4"):', toRPN('2 + 3 * 4'));
    console.log('toRPN("(2 + 3) * 4"):', toRPN('(2 + 3) * 4'));
    console.log('toRPN("2 ^ 3 ^ 4"):', toRPN('2 ^ 3 ^ 4'));
    console.log('toRPN("-5"):', toRPN('-5'));
    console.log('toRPN("-(2 + 3)"):', toRPN('-(2 + 3)'));
} catch (e) {
    console.error('Error:', e.message);
}