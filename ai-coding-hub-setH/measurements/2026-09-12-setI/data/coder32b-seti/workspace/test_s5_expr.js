const assert = require('assert');
const { evaluate } = require('./s5_expr.js');

function test(description, fn) {
    try {
        fn();
        console.log(`PASS: ${description}`);
    } catch (error) {
        console.error(`FAIL: ${description}`);
        console.error(error.message);
    }
}

test('evaluate should handle unary minus', function() {
    assert.strictEqual(evaluate('-2'), -2);
    assert.strictEqual(evaluate('- (2 + 3) * 2'), -10);
    assert.strictEqual(evaluate('2 * -3'), -6);
    assert.strictEqual(evaluate('-(2 + 3) * 2 + 5'), -5);
    assert.strictEqual(evaluate('2 * -(3 + 4)'), -14);
});