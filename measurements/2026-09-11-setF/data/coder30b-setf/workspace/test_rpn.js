const { toRPN } = require('./s5_expr.js');

console.log('Testing toRPN function:');
try {
    const result = toRPN('1 + 2 * x');
    console.log('Input: "1 + 2 * x"');
    console.log('Output:', result);
    console.log('Expected: ["1", "2", "x", "*", "+"]');
    console.log('Match:', JSON.stringify(result) === JSON.stringify(['1', '2', 'x', '*', '+']));
} catch (error) {
    console.error('Error:', error.message);
}