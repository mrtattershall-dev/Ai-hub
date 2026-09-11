function isValidCard(number) {
    // Luhn algorithm implementation
    let sum = 0;
    let shouldDouble = false;
    for (let i = number.length - 1; i >= 0; i--) {
        let digit = parseInt(number.replace(/\s+/g, '')[i], 10);
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
}

// Asserts
console.assert(isValidCard("79927398713"), "Test 1 Failed");
console.assert(!isValidCard("79927398714"), "Test 2 Failed");
console.assert(isValidCard("4539 1488 0343 6467"), "Test 3 Failed");
console.assert(!isValidCard("4539 1488 0343 6468"), "Test 4 Failed");