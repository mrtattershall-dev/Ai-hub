function parseMoney(text) {
    const regex = /^\$?(-?\d+)(?:,\d{3})*(?:\.\d{2})?$/;
    const match = text.match(regex);
    if (!match) {
        throw new Error('Invalid money format');
    }
    const [_, integerPart, decimalPart] = match;
    const cents = (parseInt(integerPart.replace(/,/g, ''), 10) * 100) + (decimalPart ? parseInt(decimalPart.replace(/^\.?(\d{2})$/, '$1'), 10) : 0);
    return cents;
}

function formatMoney(cents) {
    const dollars = Math.abs(cents) / 100;
    const formatted = dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    return cents < 0 ? '-' + formatted : formatted;
}

module.exports = {
    parseMoney,
    formatMoney
};
const assert = require('assert');

// Test parseMoney
assert.strictEqual(parseMoney('$1,234.56'), 123456);
assert.strictEqual(parseMoney('12'), 1200);
assert.strictEqual(parseMoney('0.5'), 50);
assert.strictEqual(parseMoney('-$3.50'), -350);
assert.throws(() => parseMoney('invalid'), Error);

// Test formatMoney
assert.strictEqual(formatMoney(123456), '$1,234.56');
assert.strictEqual(formatMoney(1200), '$12.00');
assert.strictEqual(formatMoney(50), '$0.50');
assert.strictEqual(formatMoney(-350), '-$3.50');
/**
 * Adds multiple amounts of money together.
 * @param {...number} amounts - The amounts of money to add, in cents.
 * @returns {number} - The total amount of money in cents.
 * @throws {Error} - If any amount is not an integer.
 */
function addMoney(...amounts) {
  amounts.forEach(amount => {
    if (!Number.isInteger(amount)) {
      throw new Error('All amounts must be integers.');
    }
  });
  return amounts.reduce((total, amount) => total + amount, 0);
}
/**
 * Subtracts an amount of money from another.
 * @param {number} a - The amount of money to subtract from, in cents.
 * @param {number} b - The amount of money to subtract, in cents.
 * @returns {number} - The resulting amount of money in cents.
 * @throws {Error} - If either amount is not an integer.
 */
function subtractMoney(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    throw new Error('Both amounts must be integers.');
  }
  return a - b;
}
module.exports = {
  parseMoney,
  formatMoney,
  addMoney,
  subtractMoney
};
