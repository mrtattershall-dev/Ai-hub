const { evaluate } = require('./s5_expr.js');

// Test cases for syntax errors
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
    evaluate('2 + 3 +');
} catch (e) {
    console.log('Error 3:', e.message);
}

try {
    evaluate('2 + 3 + + 4');
} catch (e) {
    console.log('Error 4:', e.message);
}