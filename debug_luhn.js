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
    
    console.log(`Processing number: ${cleaned}`);
    console.log(`Length: ${length}`);
    
    // Process each digit from right to left
    for (let i = 0; i < length; i++) {
        let digit = parseInt(cleaned[length - 1 - i]);
        console.log(`Position ${i} (from right): digit = ${digit}`);
        
        // Double every second digit from the right
        if (i % 2 === 1) {
            digit *= 2;
            console.log(`  -> doubled: ${digit}`);
            if (digit > 9) {
                digit -= 9;
                console.log(`  -> >9, subtracted 9: ${digit}`);
            }
        }
        
        sum += digit;
        console.log(`  -> added to sum: ${sum}`);
    }
    
    console.log(`Final sum: ${sum}`);
    console.log(`Sum divisible by 10: ${sum % 10 === 0}`);
    
    // Valid if sum is divisible by 10
    return sum % 10 === 0;
}

// Test the problematic case
console.log("=== Testing 4000000000000002 ===");
const result = isValidCard(4000000000000002);
console.log(`Result: ${result}`);

console.log("\n=== Testing 4532015112830366 ===");
const result2 = isValidCard(4532015112830366);
console.log(`Result: ${result2}`);