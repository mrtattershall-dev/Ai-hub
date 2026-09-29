function isValidCard(number) {
    let sum = 0;
    let shouldDouble = false;

    // Convert the number to a string and reverse it
    const numStr = number.toString().split('').reverse().join('');

    for (let i = 0; i < numStr.length; i++) {
        let digit = parseInt(numStr[i]);

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

// Assertions
console.assert(isValidCard(4539148803436467) === true, 'Test case 1 failed');
console.assert(isValidCard(4539148803436468) === false, 'Test case 2 failed');
console.assert(isValidCard(79927398713) === true, 'Test case 3 failed');
console.assert(isValidCard(79927398714) === false, 'Test case 4 failed');