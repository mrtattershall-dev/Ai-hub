const assert = require('assert');
const { evaluate } = require('./s5_expr.js');

try {
  assert.strictEqual(evaluate('1 + 2'), 3);
  assert.strictEqual(evaluate('3 - 4'), -1);
  assert.strictEqual(evaluate('5 * 6'), 30);
  assert.strictEqual(evaluate('7 / 8'), 0.875);
  assert.strictEqual(evaluate('1 + 2 * 3'), 7);
  assert.strictEqual(evaluate('(1 + 2) * 3'), 9);
  assert.strictEqual(evaluate('10 / 0'), 0); // Division by zero should throw an error
} catch (error) {
  console.error(error.message);
}

console.log('All tests passed!');