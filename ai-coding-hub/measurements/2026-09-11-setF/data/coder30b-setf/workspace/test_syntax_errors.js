const { evaluate } = require('./s5_expr.js');

// Test syntax error with position information
try {
    evaluate('2 + * 3');
} catch (e) {
    console.log('Error message:', e.message);
}

// Test unclosed parenthesis error
try {
    evaluate('(1+2');
} catch (e) {
    console.log('Error message:', e.message);
}

// Test invalid number error
try {
    evaluate('2.5.3');
} catch (e) {
    console.log('Error message:', e.message);
}