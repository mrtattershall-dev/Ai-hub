const { allocateMoney } = require('./r8_money.js');

// Test case
const cents = 100;
const ratios = [1, 2, 3];
const expected = [25, 50, 75];

const result = allocateMoney(cents, ratios);
console.log('Result:', result);
console.log('Expected:', expected);
console.log('Test passed:', JSON.stringify(result) === JSON.stringify(expected));