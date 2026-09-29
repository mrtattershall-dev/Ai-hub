const { evaluate } = require('./s5_expr.js');

// Test cases that should produce errors with position information
try {
    evaluate('2 + * 3');
} catch (e) {
    console.log('Error 1:', e.message);
}

try {
    evaluate('(1+2');
} catch (e) {
    console.log('Error 2:', e.message);
}

try {
    evaluate('invalid');
} catch (e) {
    console.log('Error 3:', e.message);
}