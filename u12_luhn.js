// Luhn algorithm implementation for credit card validation

function isValidCard(number) {
    // Convert to string and remove spaces
    const cleaned = number.toString().replace(/\s/g, '');
    
    // Check if all characters are digits
    if (!/^\d+$/.test(cleaned)) {
        return false;
    }
    
    // Check length (must be at least 2 digits)
    if (cleaned.length < 2) {
        return false;
    }
    
    let sum = 0;
    const length = cleaned.length;
    
    // Process each digit from right to left
    for (let i = 0; i < length; i++) {
        let digit = parseInt(cleaned[length - 1 - i]);
        
        // Double every second digit from the right
        if (i % 2 === 1) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }
        
        sum += digit;
    }
    
    // Valid if sum is divisible by 10
    return sum % 10 === 0;
}

// Test cases with asserts
console.assert(isValidCard(4532015112830366) === true, "Valid card number should return true");
console.assert(isValidCard(6011514433546201) === true, "Valid card number should return true");
console.assert(isValidCard(4000000000000002) === false, "Invalid card number should return false");
console.assert(isValidCard(1234567812345678) === false, "Invalid card number should return false");
console.assert(isValidCard("4532 0151 1283 0366") === true, "Valid card with spaces should return true");
console.assert(isValidCard("4532015112830366") === true, "Valid card without spaces should return true");
console.assert(isValidCard("1234 5678 9012 3456") === false, "Invalid card with spaces should return false");
console.assert(isValidCard(123) === false, "Card with less than 2 digits should return false");
console.assert(isValidCard("abc123") === false, "Card with non-digit characters should return false");

// Export the function
module.exports = { isValidCard };