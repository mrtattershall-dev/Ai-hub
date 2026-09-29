// Test the splitMoney function directly
const { splitMoney } = require('./r8_money.js');

// Test the specific case from the goal
const result = splitMoney(1000, 3);
console.log('splitMoney(1000, 3) =', result);

// Verify it matches expected output
const expected = [334, 333, 333];
const isCorrect = JSON.stringify(result) === JSON.stringify(expected);
console.log('Expected:', expected);
console.log('Correct result:', isCorrect);

// Additional tests
console.log('splitMoney(1001, 3) =', splitMoney(1001, 3));
console.log('splitMoney(1000, 4) =', splitMoney(1000, 4));
console.log('splitMoney(1000, 1) =', splitMoney(1000, 1));