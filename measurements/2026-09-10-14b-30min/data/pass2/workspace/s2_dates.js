function isLeapYear(year) {
    if (year % 4 !== 0) return false;
    if (year % 100 !== 0) return true;
    if (year % 400 !== 0) return false;
    return true;
}

module.exports = {
    isLeapYear
};
function daysBetween(a, b) {
const [yearA, monthA, dayA] = a.split('-').map(Number);
const [yearB, monthB, dayB] = b.split('-').map(Number);

if (isNaN(yearA) || isNaN(monthA) || isNaN(dayA) || isNaN(yearB) || isNaN(monthB) || isNaN(dayB)) {
    throw new Error('Malformed date string');
}

    const dateA = new Date(yearA, monthA - 1, dayA);
    const dateB = new Date(yearB, monthB - 1, dayB);

    const diffTime = Math.abs(dateB - dateA);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
}

module.exports = {
    isLeapYear,
    daysBetween
};
const assert = require('assert');

// Test isLeapYear
assert.strictEqual(isLeapYear(2020), true, '2020 should be a leap year');
assert.strictEqual(isLeapYear(1900), false, '1900 should not be a leap year');
assert.strictEqual(isLeapYear(2000), true, '2000 should be a leap year');
assert.strictEqual(isLeapYear(2023), false, '2023 should not be a leap year');

// Test daysBetween
assert.strictEqual(daysBetween('2023-01-01', '2023-01-02'), 1, '1 day difference');
assert.strictEqual(daysBetween('2023-01-01', '2023-12-31'), 364, '364 days difference');
assert.strictEqual(daysBetween('2020-02-28', '2020-03-01'), 2, '2 days difference in a leap year');
assert.strictEqual(daysBetween('2019-02-28', '2019-03-01'), 1, '1 day difference in a non-leap year');

console.log('All tests passed!');
