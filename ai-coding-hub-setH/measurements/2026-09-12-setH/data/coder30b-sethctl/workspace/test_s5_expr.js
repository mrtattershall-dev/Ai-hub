const { evaluate } = require('./s5_expr.js');

// Test basic functionality
console.log('Testing basic functionality...');
try {
    console.log('2 + 3 =', evaluate('2 + 3')); // Should be 5
    console.log('10 - 4 =', evaluate('10 - 4')); // Should be 6
    console.log('3 * 7 =', evaluate('3 * 7')); // Should be 21
    console.log('15 / 3 =', evaluate('15 / 3')); // Should be 5
    console.log('(2 + 3) * 4 =', evaluate('(2 + 3) * 4')); // Should be 20
} catch (e) {
    console.error('Error in basic tests:', e.message);
}

// Test variable functionality
console.log('\nTesting variable functionality...');
try {
    console.log('x + y where x=5, y=3:', evaluate('x + y', {x: 5, y: 3})); // Should be 8
    console.log('a * b where a=2, b=6:', evaluate('a * b', {a: 2, b: 6})); // Should be 12
    console.log('x + y * z where x=1, y=2, z=3:', evaluate('x + y * z', {x: 1, y: 2, z: 3})); // Should be 7
} catch (e) {
    console.error('Error in variable tests:', e.message);
}

// Test error handling
console.log('\nTesting error handling...');
try {
    evaluate('x + y', {x: 5}); // Should throw error for unknown variable y
} catch (e) {
    console.log('Correctly caught error for unknown variable:', e.message);
}

try {
    evaluate('5 / 0'); // Should throw error for division by zero
} catch (e) {
    console.log('Correctly caught error for division by zero:', e.message);
}

try {
    evaluate('invalid+expr'); // Should throw error for invalid expression
} catch (e) {
    console.log('Correctly caught error for invalid expression:', e.message);
}