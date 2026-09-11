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

// Export the function
module.exports = { isValidCard };