const { evaluate } = require('./s5_expr.js');

console.log('=== Comprehensive Test for s5_expr.js Variable Support ===\n');

// Test 1: Basic operations still work
console.log('Test 1: Basic operations');
console.log('2 + 3 =', evaluate('2 + 3')); // Should be 5
console.log('10 - 4 =', evaluate('10 - 4')); // Should be 6
console.log('3 * 4 =', evaluate('3 * 4')); // Should be 12
console.log('15 / 3 =', evaluate('15 / 3')); // Should be 5
console.log();

// Test 2: Variable evaluation
console.log('Test 2: Variable evaluation');
console.log('x + 5 where x=10:', evaluate('x + 5', {x: 10})); // Should be 15
console.log('a * b where a=3, b=4:', evaluate('a * b', {a: 3, b: 4})); // Should be 12
console.log('x + y - z where x=10, y=5, z=3:', evaluate('x + y - z', {x: 10, y: 5, z: 3})); // Should be 12
console.log();

// Test 3: Complex expressions with variables
console.log('Test 3: Complex expressions with variables');
console.log('2 * x + 3 where x=5:', evaluate('2 * x + 3', {x: 5})); // Should be 13
console.log('x^2 where x=3:', evaluate('x^2', {x: 3})); // Should be 9
console.log('x * y / z where x=10, y=4, z=2:', evaluate('x * y / z', {x: 10, y: 4, z: 2})); // Should be 20
console.log();

// Test 4: Unknown variable error
console.log('Test 4: Unknown variable error');
try {
    evaluate('unknown_var + 5');
    console.log('ERROR: Should have thrown an exception');
} catch (e) {
    console.log('Correctly caught error:', e.message);
    if (e.message.includes('unknown_var')) {
        console.log('Error message contains variable name as required');
    } else {
        console.log('ERROR: Error message does not contain variable name');
    }
}
console.log();

// Test 5: Empty vars object
console.log('Test 5: Empty vars object');
try {
    evaluate('x + 5', {});
    console.log('ERROR: Should have thrown an exception');
} catch (e) {
    console.log('Correctly caught error:', e.message);
}
console.log();

// Test 6: Complex expressions with parentheses and variables
console.log('Test 6: Complex expressions with parentheses and variables');
console.log('(x + y) * z where x=2, y=3, z=4:', evaluate('(x + y) * z', {x: 2, y: 3, z: 4})); // Should be 20
console.log('x^(y + 1) where x=2, y=3:', evaluate('x^(y + 1)', {x: 2, y: 3})); // Should be 16
console.log();

console.log('=== All tests completed ===');