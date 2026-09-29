const { evaluate } = require('./s5_expr.js');

// Test 1: Basic evaluation without variables
console.log('Test 1: Basic evaluation');
try {
    console.log('2 + 3 =', evaluate('2 + 3'));
    console.log('OK');
} catch (e) {
    console.log('FAIL:', e.message);
}

// Test 2: Evaluation with variables
console.log('\nTest 2: Evaluation with variables');
try {
    console.log('x + y where x=5, y=3 =', evaluate('x + y', {x: 5, y: 3}));
    console.log('OK');
} catch (e) {
    console.log('FAIL:', e.message);
}

// Test 3: Complex expression with variables
console.log('\nTest 3: Complex expression with variables');
try {
    console.log('a * b + c where a=2, b=3, c=4 =', evaluate('a * b + c', {a: 2, b: 3, c: 4}));
    console.log('OK');
} catch (e) {
    console.log('FAIL:', e.message);
}

// Test 4: Unknown variable should throw error
console.log('\nTest 4: Unknown variable should throw error');
try {
    evaluate('x + y', {x: 5});
    console.log('FAIL: Should have thrown an error');
} catch (e) {
    if (e.message.includes('Unknown variable: y')) {
        console.log('OK');
    } else {
        console.log('FAIL: Wrong error message:', e.message);
    }
}

// Test 5: Variable with special characters
console.log('\nTest 5: Variable with underscore');
try {
    console.log('my_var where my_var=10 =', evaluate('my_var', {my_var: 10}));
    console.log('OK');
} catch (e) {
    console.log('FAIL:', e.message);
}

// Test 6: Variable with numbers in name
console.log('\nTest 6: Variable with numbers');
try {
    console.log('var123 where var123=456 =', evaluate('var123', {var123: 456}));
    console.log('OK');
} catch (e) {
    console.log('FAIL:', e.message);
}

// Test 7: Expression with parentheses and variables
console.log('\nTest 7: Expression with parentheses and variables');
try {
    console.log('(x + y) * z where x=2, y=3, z=4 =', evaluate('(x + y) * z', {x: 2, y: 3, z: 4}));
    console.log('OK');
} catch (e) {
    console.log('FAIL:', e.message);
}

// Test 8: Expression with power operator and variables
console.log('\nTest 8: Expression with power operator and variables');
try {
    console.log('x^y where x=2, y=3 =', evaluate('x^y', {x: 2, y: 3}));
    console.log('OK');
} catch (e) {
    console.log('FAIL:', e.message);
}

console.log('\nAll tests completed');