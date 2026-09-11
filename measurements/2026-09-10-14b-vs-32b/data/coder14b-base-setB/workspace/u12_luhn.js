function isValidCard(number) {
    let sum = 0;
    let shouldDouble = false;

    // Convert the number to a string and reverse it
    const numStr = number.toString().split('').reverse().join('');

    for (let i = 0; i < numStr.length; i++) {
        let digit = parseInt(numStr[i], 10);

        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }

        sum += digit;
        shouldDouble = !shouldDouble;
    }

    return sum % 10 === 0;
}

module.exports = { isValidCard };
const assert = require('assert');

assert.strictEqual(isValidCard('4539 1488 0343 6467'), true, 'Test case 1 failed');
assert.strictEqual(isValidCard('4539 1488 0343 6468'), false, 'Test case 2 failed');
assert.strictEqual(isValidCard('4992 7398 716'), true, 'Test case 3 failed');
assert.strictEqual(isValidCard('4992 7398 717'), false, 'Test case 4 failed');
assert.strictEqual(isValidCard('1234 5678 1234 5670'), true, 'Test case 5 failed');
assert.strictEqual(isValidCard('1234 5678 1234 5671'), false, 'Test case 6 failed');

console.log('All tests passed!');
