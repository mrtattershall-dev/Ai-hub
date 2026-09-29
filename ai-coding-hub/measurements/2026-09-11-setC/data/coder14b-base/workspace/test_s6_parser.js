const assert = require('assert');
const { tokenize } = require('./s6_parser');

describe('tokenize', function() {
  it('should tokenize a simple number', function() {
    assert.deepStrictEqual(tokenize('42'), [{ type: 'number', value: 42 }]);
  });

  it('should tokenize a simple addition', function() {
    assert.deepStrictEqual(tokenize('1 + 2'), [{ type: 'number', value: 1 }, { type: 'operator', value: '+' }, { type: 'number', value: 2 }]);
  });

  it('should tokenize a simple subtraction', function() {
    assert.deepStrictEqual(tokenize('5 - 3'), [{ type: 'number', value: 5 }, { type: 'operator', value: '-' }, { type: 'number', value: 3 }]);
  });

  it('should tokenize a simple multiplication', function() {
    assert.deepStrictEqual(tokenize('6 * 7'), [{ type: 'number', value: 6 }, { type: 'operator', value: '*' }, { type: 'number', value: 7 }]);
  });

  it('should tokenize a simple division', function() {
    assert.deepStrictEqual(tokenize('8 / 4'), [{ type: 'number', value: 8 }, { type: 'operator', value: '/' }, { type: 'number', value: 4 }]);
  });

  it('should tokenize a simple expression with parentheses', function() {
    assert.deepStrictEqual(tokenize('(1 + 2) * 3'), [{ type: 'operator', value: '(' }, { type: 'number', value: 1 }, { type: 'operator', value: '+' }, { type: 'number', value: 2 }, { type: 'operator', value: ')' }, { type: 'operator', value: '*' }, { type: 'number', value: 3 }]);
  });

  it('should tokenize a simple expression with decimals', function() {
    assert.deepStrictEqual(tokenize('1.5 + 2.5'), [{ type: 'number', value: 1.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 2.5 }]);
  });

  it('should throw an error on unexpected characters', function() {
    assert.throws(() => tokenize('1 + 2a'), /Unexpected character: a/);
  });

  it('should tokenize an expression with multiple operators', function() {
    assert.deepStrictEqual(tokenize('1 + 2 * 3 - 4 / 5'), [{ type: 'number', value: 1 }, { type: 'operator', value: '+' }, { type: 'number', value: 2 }, { type: 'operator', value: '*' }, { type: 'number', value: 3 }, { type: 'operator', value: '-' }, { type: 'number', value: 4 }, { type: 'operator', value: '/' }, { type: 'number', value: 5 }]);
  });

  it('should tokenize an expression with nested parentheses', function() {
    assert.deepStrictEqual(tokenize('((1 + 2) * 3) - 4'), [{ type: 'operator', value: '(' }, { type: 'operator', value: '(' }, { type: 'number', value: 1 }, { type: 'operator', value: '+' }, { type: 'number', value: 2 }, { type: 'operator', value: ')' }, { type: 'operator', value: '*' }, { type: 'number', value: 3 }, { type: 'operator', value: ')' }, { type: 'operator', value: '-' }, { type: 'number', value: 4 }]);
  });

  it('should tokenize an expression with spaces', function() {
    assert.deepStrictEqual(tokenize('  1   +   2  '), [{ type: 'number', value: 1 }, { type: 'operator', value: '+' }, { type: 'number', value: 2 }]);
  });

  it('should tokenize an expression with multiple numbers', function() {
    assert.deepStrictEqual(tokenize('123 + 456'), [{ type: 'number', value: 123 }, { type: 'operator', value: '+' }, { type: 'number', value: 456 }]);
  });

  it('should tokenize an expression with a single number', function() {
    assert.deepStrictEqual(tokenize('42'), [{ type: 'number', value: 42 }]);
  });

  it('should tokenize an expression with a single operator', function() {
    assert.deepStrictEqual(tokenize('+'), [{ type: 'operator', value: '+' }]);
  });

  it('should tokenize an expression with a single parenthesis', function() {
    assert.deepStrictEqual(tokenize('('), [{ type: 'operator', value: '(' }]);
  });

  it('should tokenize an expression with a single decimal number', function() {
    assert.deepStrictEqual(tokenize('1.5'), [{ type: 'number', value: 1.5 }]);
  });

  it('should tokenize an expression with a decimal number and an operator', function() {
    assert.deepStrictEqual(tokenize('1.5 + 2.5'), [{ type: 'number', value: 1.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 2.5 }]);
  });

  it('should tokenize an expression with a decimal number and a parenthesis', function() {
    assert.deepStrictEqual(tokenize('(1.5 + 2.5)'), [{ type: 'operator', value: '(' }, { type: 'number', value: 1.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 2.5 }, { type: 'operator', value: ')' }]);
  });

  it('should tokenize an expression with a decimal number and a space', function() {
    assert.deepStrictEqual(tokenize('1.5 + 2.5'), [{ type: 'number', value: 1.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 2.5 }]);
  });

  it('should tokenize an expression with a decimal number and a number', function() {
    assert.deepStrictEqual(tokenize('1.5 + 2'), [{ type: 'number', value: 1.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 2 }]);
  });

  it('should tokenize an expression with a decimal number and a decimal number', function() {
    assert.deepStrictEqual(tokenize('1.5 + 2.5'), [{ type: 'number', value: 1.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 2.5 }]);
  });

  it('should tokenize an expression with a decimal number and a decimal number and an operator', function() {
    assert.deepStrictEqual(tokenize('1.5 + 2.5 + 3.5'), [{ type: 'number', value: 1.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 2.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 3.5 }]);
  });

  it('should tokenize an expression with a decimal number and a decimal number and a parenthesis', function() {
    assert.deepStrictEqual(tokenize('(1.5 + 2.5) * 3.5'), [{ type: 'operator', value: '(' }, { type: 'number', value: 1.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 2.5 }, { type: 'operator', value: ')' }, { type: 'operator', value: '*' }, { type: 'number', value: 3.5 }]);
  });

  it('should tokenize an expression with a decimal number and a decimal number and a space', function() {
    assert.deepStrictEqual(tokenize('1.5 + 2.5'), [{ type: 'number', value: 1.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 2.5 }]);
  });

  it('should tokenize an expression with a decimal number and a decimal number and a number', function() {
    assert.deepStrictEqual(tokenize('1.5 + 2.5 + 3'), [{ type: 'number', value: 1.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 2.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 3 }]);
  });

  it('should tokenize an expression with a decimal number and a decimal number and a decimal number', function() {
    assert.deepStrictEqual(tokenize('1.5 + 2.5 + 3.5'), [{ type: 'number', value: 1.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 2.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 3.5 }]);
  });

  it('should tokenize an expression with a decimal number and a decimal number and a decimal number and an operator', function() {
    assert.deepStrictEqual(tokenize('1.5 + 2.5 + 3.5 + 4.5'), [{ type: 'number', value: 1.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 2.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 3.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 4.5 }]);
  });

  it('should tokenize an expression with a decimal number and a decimal number and a decimal number and a parenthesis', function() {
    assert.deepStrictEqual(tokenize('(1.5 + 2.5 + 3.5) * 4.5'), [{ type: 'operator', value: '(' }, { type: 'number', value: 1.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 2.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 3.5 }, { type: 'operator', value: ')' }, { type: 'operator', value: '*' }, { type: 'number', value: 4.5 }]);
  });

  it('should tokenize an expression with a decimal number and a decimal number and a decimal number and a space', function() {
    assert.deepStrictEqual(tokenize('1.5 + 2.5 + 3.5'), [{ type: 'number', value: 1.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 2.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 3.5 }]);
  });

  it('should tokenize an expression with a decimal number and a decimal number and a decimal number and a number', function() {
    assert.deepStrictEqual(tokenize('1.5 + 2.5 + 3.5 + 4'), [{ type: 'number', value: 1.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 2.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 3.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 4 }]);
  });

  it('should tokenize an expression with a decimal number and a decimal number and a decimal number and a decimal number', function() {
    assert.deepStrictEqual(tokenize('1.5 + 2.5 + 3.5 + 4.5'), [{ type: 'number', value: 1.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 2.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 3.5 }, { type: 'operator', value: '+' }, { type: 'number', value: 4.5 }]);
  });
});