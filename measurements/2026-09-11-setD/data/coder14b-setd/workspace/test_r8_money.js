const assert = require('assert');
const { parseMoney, formatMoney } = require('./r8_money.js');

describe('parseMoney', function() {
  it('should parse "$1,234.56" to 123456', function() {
    assert.strictEqual(parseMoney('$1,234.56'), 123456);
  });

  it('should parse "12" to 1200', function() {
    assert.strictEqual(parseMoney('12'), 1200);
  });

  it('should parse "0.5" to 50', function() {
    assert.strictEqual(parseMoney('0.5'), 50);
  });

  it('should parse "-$3.50" to -350', function() {
    assert.strictEqual(parseMoney('-$3.50'), -350);
  });

  it('should throw an error for invalid format "$1,234"', function() {
    assert.throws(() => parseMoney('$1,234'), Error);
  });

  it('should throw an error for invalid format "abc"', function() {
    assert.throws(() => parseMoney('abc'), Error);
  });
});

describe('formatMoney', function() {
  it('should format 123456 to "$1,234.56"', function() {
    assert.strictEqual(formatMoney(123456), '$1,234.56');
  });

  it('should format 1200 to "$12.00"', function() {
    assert.strictEqual(formatMoney(1200), '$12.00');
  });

  it('should format 50 to "$0.50"', function() {
    assert.strictEqual(formatMoney(50), '$0.50');
  });

  it('should format -350 to "-$3.50"', function() {
    assert.strictEqual(formatMoney(-350), '-$3.50');
  });
});