const assert = require('assert');
const { evaluate } = require('./s5_expr.js');

// Test basic arithmetic operations
assert.strictEqual(evaluate('1 + 2'), 3);
assert.strictEqual(evaluate('3 - 2'), 1);
assert.strictEqual(evaluate('2 * 3'), 6);
assert.strictEqual(evaluate('6 / 2'), 3);

// Test operator precedence
assert.strictEqual(evaluate('1 + 2 * 3'), 7);
assert.strictEqual(evaluate('2 * 3 + 1'), 7);
assert.strictEqual(evaluate('1 + 2 / 2'), 2);
assert.strictEqual(evaluate('2 / 2 + 1'), 2);

// Test left-to-right order for same precedence
assert.strictEqual(evaluate('1 + 2 + 3'), 6);
assert.strictEqual(evaluate('1 - 2 - 3'), -4);
assert.strictEqual(evaluate('2 * 3 * 4'), 24);
assert.strictEqual(evaluate('8 / 4 / 2'), 1);

// Test with spaces
assert.strictEqual(evaluate('1 + 2 * 3'), 7);
assert.strictEqual(evaluate('1 + 2 * 3 '), 7);
assert.strictEqual(evaluate(' 1 + 2 * 3'), 7);
assert.strictEqual(evaluate(' 1 + 2 * 3 '), 7);

// Test division by zero
assert.throws(() => evaluate('1 / 0'), /Cannot parse expression: 1\/0/);
assert.throws(() => evaluate('1 / (2 - 2)'), /Cannot parse expression: 1\/\(2-2\)/);
assert.throws(() => evaluate('1 / (2 - 2)'), /Cannot parse expression: 1\/\(2-2\)/);

// Test invalid expressions
assert.throws(() => evaluate('1 +'), /Cannot parse expression/);
assert.throws(() => evaluate('1 + 2 *'), /Cannot parse expression/);
assert.throws(() => evaluate('1 + 2 * 3 +'), /Cannot parse expression/);
assert.throws(() => evaluate('1 + 2 * 3 + 4 /'), /Cannot parse expression/);

console.log('All tests passed.');
// No need to redeclare evaluate as it is already imported

// Test unary minus
console.assert(evaluate('-2') === -2, 'Test -2 failed');
console.assert(evaluate('-3.5') === -3.5, 'Test -3.5 failed');
console.assert(evaluate('-(-2)') === 2, 'Test -(-2) failed');

// Test parentheses
console.assert(evaluate('(2 + 3) * 2') === 10, 'Test (2 + 3) * 2 failed');
console.assert(evaluate('2 * (3 + 4)') === 14, 'Test 2 * (3 + 4) failed');
console.assert(evaluate('(2 + 3) * (4 + 5)') === 45, 'Test (2 + 3) * (4 + 5) failed');

// Test unary minus with parentheses
console.assert(evaluate('-(2 + 3) * 2') === -10, 'Test -(2 + 3) * 2 failed');
console.assert(evaluate('2 * -(3 + 4)') === -14, 'Test 2 * -(3 + 4) failed');
console.assert(evaluate('-(2 + 3) * -(4 + 5)') === 45, 'Test -(2 + 3) * -(4 + 5) failed');

// Test mixed operations
console.assert(evaluate('2 * -3') === -6, 'Test 2 * -3 failed');
console.assert(evaluate('-2 * 3') === -6, 'Test -2 * 3 failed');
console.assert(evaluate('-2 * -3') === 6, 'Test -2 * -3 failed');

console.log('All tests passed!');
