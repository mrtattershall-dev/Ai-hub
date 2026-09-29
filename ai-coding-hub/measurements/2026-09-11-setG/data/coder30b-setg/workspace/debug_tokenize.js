// Debug script to understand tokenize function
const fs = require('fs');

// Read the s5_expr.js file and evaluate it
const exprCode = fs.readFileSync('s5_expr.js', 'utf8');
eval(exprCode);

// Debug tokenize function
console.log('Testing tokenize function:');
console.log('tokenize("1 + 2 * x"):', tokenize('1 + 2 * x'));
console.log('tokenize("2 + 3 * 4"):', tokenize('2 + 3 * 4'));
console.log('tokenize("(2 + 3) * 4"):', tokenize('(2 + 3) * 4'));
console.log('tokenize("2 ^ 3 ^ 4"):', tokenize('2 ^ 3 ^ 4'));