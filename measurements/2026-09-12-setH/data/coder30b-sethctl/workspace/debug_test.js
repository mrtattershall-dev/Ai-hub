const { evaluate } = require('./s5_expr.js');

console.log('Testing simple expression...');
try {
    console.log('2 + 3 =', evaluate('2 + 3'));
} catch (e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
}