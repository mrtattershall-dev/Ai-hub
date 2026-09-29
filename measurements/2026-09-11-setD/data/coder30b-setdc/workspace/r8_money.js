// r8_money.js - Currency parsing and formatting functions

// Function to parse money strings into cents
function parseMoney(text) {
    // Remove currency symbols and whitespace, keep only digits, decimal point, and minus sign
    const cleaned = text.replace(/^\s*([€£$])/, '').replace(/\s*([A-Z]{3})$/, '').replace(/[^\d.-]/g, '');
    
    // Check if it's a valid number format
    if (!/^-?\d*\.?\d+$/.test(cleaned)) {
        throw new Error(`Invalid money format: ${text}`);
    }
    
    // Handle empty or just minus sign
    if (cleaned === '' || cleaned === '-') {
        throw new Error(`Invalid money format: ${text}`);
    }
    
    // Convert to number and multiply by 100 to get cents
    const amount = parseFloat(cleaned);
    const cents = Math.round(amount * 100);
    
    return cents;
}

// Function to format cents into money strings
function formatMoney(cents) {
    // Handle negative amounts
    const isNegative = cents < 0;
    const absCents = Math.abs(cents);
    
    // Convert cents to dollars
    const dollars = absCents / 100;
    
    // Format with commas and 2 decimal places
    const formatted = dollars.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    // Add dollar sign and negative sign if needed
    return (isNegative ? '-' : '') + '$' + formatted;
}

// Function to add money amounts in cents
function addMoney(...amounts) {
    // Validate that all arguments are integers
    for (const amount of amounts) {
        if (!Number.isInteger(amount)) {
            throw new Error(`All arguments must be integers, got: ${amount}`);
        }
    }
    
    // Sum all amounts
    return amounts.reduce((sum, amount) => sum + amount, 0);
}

// Function to subtract money amounts in cents
function subtractMoney(a, b) {
    // Validate that both arguments are integers
    if (!Number.isInteger(a)) {
        throw new Error(`All arguments must be integers, got: ${a}`);
    }
    if (!Number.isInteger(b)) {
        throw new Error(`All arguments must be integers, got: ${b}`);
    }
    
    // Return the difference
    return a - b;
}

// Function to multiply money by a factor, rounding to nearest cent with halves away from zero
function multiplyMoney(cents, factor) {
    // Validate that both arguments are numbers
    if (typeof cents !== 'number' || !Number.isFinite(cents)) {
        throw new Error(`Cents must be a finite number, got: ${cents}`);
    }
    if (typeof factor !== 'number' || !Number.isFinite(factor)) {
        throw new Error(`Factor must be a finite number, got: ${factor}`);
    }
    
    // Multiply and round to nearest cent with halves away from zero
    const result = cents * factor;
    // For rounding away from zero, we use Math.sign to determine direction
    return Math.sign(result) * Math.round(Math.abs(result));
}

// Function to split cents into n integer amounts differing by at most 1, with larger values first
function splitMoney(cents, n) {
    if (n <= 0) {
        throw new Error("Number of splits must be positive");
    }
    
    if (cents < 0) {
        throw new Error("Cents must be non-negative");
    }
    
    const baseAmount = Math.floor(cents / n);
    const remainder = cents % n;
    
    // Create array with baseAmount for all elements
    const result = Array(n).fill(baseAmount);
    
    // Distribute the remainder by adding 1 to the first 'remainder' elements
    for (let i = 0; i < remainder; i++) {
        result[i] += 1;
    }
    
    return result;
}

// Export the functions
module.exports = { parseMoney, formatMoney, addMoney, subtractMoney, multiplyMoney, splitMoney, convertMoney };

// Asserts to test the functions
function runTests() {
    console.log("Running tests for parseMoney and formatMoney...");
    
    // Test parseMoney function
    try {
        console.assert(parseMoney('$1,234.56') === 123456, 'Test 1 failed: $1,234.56 should equal 123456 cents');
        console.assert(parseMoney('12') === 1200, 'Test 2 failed: 12 should equal 1200 cents');
        console.assert(parseMoney('0.5') === 50, 'Test 3 failed: 0.5 should equal 50 cents');
        console.assert(parseMoney('-$3.50') === -350, 'Test 4 failed: -$3.50 should equal -350 cents');
        console.assert(parseMoney('0') === 0, 'Test 5 failed: 0 should equal 0 cents');
        console.assert(parseMoney('$0.00') === 0, 'Test 6 failed: $0.00 should equal 0 cents');
        console.assert(parseMoney('1000') === 100000, 'Test 7 failed: 1000 should equal 100000 cents');
        console.assert(parseMoney('1000.00') === 100000, 'Test 8 failed: 1000.00 should equal 100000 cents');
        console.assert(parseMoney('1000.01') === 100001, 'Test 9 failed: 1000.01 should equal 100001 cents');
        console.assert(parseMoney('1000.001') === 100000, 'Test 10 failed: 1000.001 should equal 100000 cents (rounded)');
        
        console.log("All parseMoney tests passed!");
    } catch (error) {
        console.error("parseMoney test failed:", error.message);
        return false;
    }
    
    // Test formatMoney function
    try {
        console.assert(formatMoney(123456) === '$1,234.56', 'Test 1 failed: 123456 cents should format to $1,234.56');
        console.assert(formatMoney(1200) === '$12.00', 'Test 2 failed: 1200 cents should format to $12.00');
        console.assert(formatMoney(50) === '$0.50', 'Test 3 failed: 50 cents should format to $0.50');
        console.assert(formatMoney(-350) === '-$3.50', 'Test 4 failed: -350 cents should format to -$3.50');
        console.assert(formatMoney(0) === '$0.00', 'Test 5 failed: 0 cents should format to $0.00');
        console.assert(formatMoney(100000) === '$1,000.00', 'Test 6 failed: 100000 cents should format to $1,000.00');
        console.assert(formatMoney(100001) === '$1,000.01', 'Test 7 failed: 100001 cents should format to $1,000.01');
        console.assert(formatMoney(-100000) === '-$1,000.00', 'Test 8 failed: -100000 cents should format to -$1,000.00');
        
        console.log("All formatMoney tests passed!");
    } catch (error) {
        console.error("formatMoney test failed:", error.message);
        return false;
    }
    
    // Test error cases for parseMoney
    try {
        parseMoney('invalid');
        console.error("Error test 1 failed: Should have thrown an error for 'invalid'");
        return false;
    } catch (error) {
        if (error.message.includes('Invalid money format')) {
            console.log("Error handling test 1 passed: 'invalid' correctly throws error");
        } else {
            console.error("Error test 1 failed: Wrong error message:", error.message);
            return false;
        }
    }
    
    try {
        parseMoney('');
        console.error("Error test 2 failed: Should have thrown an error for empty string");
        return false;
    } catch (error) {
        if (error.message.includes('Invalid money format')) {
            console.log("Error handling test 2 passed: Empty string correctly throws error");
        } else {
            console.error("Error test 2 failed: Wrong error message:", error.message);
            return false;
        }
    }
    
    try {
        parseMoney('$');
        console.error("Error test 3 failed: Should have thrown an error for just '$'");
        return false;
    } catch (error) {
        if (error.message.includes('Invalid money format')) {
            console.log("Error handling test 3 passed: Just '$' correctly throws error");
        } else {
            console.error("Error test 3 failed: Wrong error message:", error.message);
            return false;
        }
    }
    console.log("All tests passed!");
    return true;
}

// Test the multiplyMoney function
function testMultiplyMoney() {
    console.log("Running tests for multiplyMoney...");
    
    try {
        // Test normal multiplication
        console.assert(multiplyMoney(100, 2) === 200, 'Test 1 failed: 100 * 2 should equal 200');
        console.assert(multiplyMoney(50, 0.5) === 25, 'Test 2 failed: 50 * 0.5 should equal 25');
        
        // Test rounding away from zero for halves
        console.assert(multiplyMoney(5, 0.5) === 3, 'Test 3 failed: 5 * 0.5 = 2.5 should round to 3 (away from zero)');
        console.assert(multiplyMoney(-5, 0.5) === -3, 'Test 4 failed: -5 * 0.5 = -2.5 should round to -3 (away from zero)');
        
        // Test negative values
        console.assert(multiplyMoney(-100, 2) === -200, 'Test 5 failed: -100 * 2 should equal -200');
        console.assert(multiplyMoney(-50, 0.5) === -25, 'Test 6 failed: -50 * 0.5 should equal -25');
        
        // Test with decimal factors
        console.assert(multiplyMoney(100, 1.7) === 170, 'Test 7 failed: 100 * 1.7 should equal 170');
        console.assert(multiplyMoney(100, 1.75) === 175, 'Test 8 failed: 100 * 1.75 should equal 175');
        
        console.log("All multiplyMoney tests passed!");
        return true;
    } catch (error) {
        console.error("multiplyMoney test failed:", error.message);
        return false;
    }
}

// Test the splitMoney function
function testSplitMoney() {
    console.log("Running tests for splitMoney...");
    
    try {
        // Test basic case: 1000 split 3 ways
        const result = splitMoney(1000, 3);
        const expected = [334, 333, 333];
        console.assert(JSON.stringify(result) === JSON.stringify(expected), 
            `Test 1 failed: splitMoney(1000, 3) should equal [334, 333, 333], got ${JSON.stringify(result)}`);
        
        // Test case where remainder is 0
        const result2 = splitMoney(1000, 4);
        const expected2 = [250, 250, 250, 250];
        console.assert(JSON.stringify(result2) === JSON.stringify(expected2), 
            `Test 2 failed: splitMoney(1000, 4) should equal [250, 250, 250, 250], got ${JSON.stringify(result2)}`);
        
        // Test case with remainder 1
        const result3 = splitMoney(1001, 3);
        const expected3 = [334, 334, 333];
        console.assert(JSON.stringify(result3) === JSON.stringify(expected3), 
            `Test 3 failed: splitMoney(1001, 3) should equal [334, 334, 333], got ${JSON.stringify(result3)}`);
        
        // Test case with n=1
        const result4 = splitMoney(1000, 1);
        const expected4 = [1000];
        console.assert(JSON.stringify(result4) === JSON.stringify(expected4), 
            `Test 4 failed: splitMoney(1000, 1) should equal [1000], got ${JSON.stringify(result4)}`);
        
        // Test case with n=2
        const result5 = splitMoney(1001, 2);
        const expected5 = [501, 500];
        console.assert(JSON.stringify(result5) === JSON.stringify(expected5), 
            `Test 5 failed: splitMoney(1001, 2) should equal [501, 500], got ${JSON.stringify(result5)}`);
        
        console.log("All splitMoney tests passed!");
        return true;
    } catch (error) {
        console.error("splitMoney test failed:", error.message);
        return false;
    }
}

// Run the tests
runTests();
testMultiplyMoney();

// Run the tests
runTests();
// Function to allocate cents into integer amounts proportional to ratios
function allocateMoney(cents, ratios) {
    // Validate inputs
    if (!Array.isArray(ratios)) {
        throw new Error("Ratios must be an array");
    }
    
    if (ratios.length === 0) {
        throw new Error("Ratios array cannot be empty");
    }
    
    // Calculate total ratio
    const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0);
    
    if (totalRatio <= 0) {
        throw new Error("Total ratio must be positive");
    }
    
    // Calculate initial allocation (integer part of each share)
    const allocations = ratios.map(ratio => Math.floor(cents * ratio / totalRatio));
    
    // Calculate remaining cents to distribute
    const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc, 0);
    let remaining = cents - totalAllocated;
    
    // Calculate fractional parts for tie-breaking
    const fractionalParts = ratios.map((ratio, index) => {
        const exactShare = cents * ratio / totalRatio;
        return { index, fractional: exactShare - allocations[index] };
    });
    
    // Sort by fractional part descending (largest first), with index as tiebreaker
    fractionalParts.sort((a, b) => {
        if (b.fractional !== a.fractional) {
            return b.fractional - a.fractional;
        }
        return a.index - b.index; // Earlier indices win ties
    });
    
    // Distribute remaining cents to parts with largest fractional remainders
    for (let i = 0; i < remaining; i++) {
        allocations[fractionalParts[i].index] += 1;
    }
    
    return allocations;
}

// Export the function
module.exports = {
    parseMoney,
    formatMoney,
    addMoney,
    subtractMoney,
    multiplyMoney,
    splitMoney,
    allocateMoney
};
// Test function for allocateMoney
function testAllocateMoney() {
    try {
        // Test case 1: Simple allocation
        const result1 = allocateMoney(100, [1, 1, 1]);
        const expected1 = [34, 33, 33];
        console.assert(JSON.stringify(result1) === JSON.stringify(expected1), 
            `Test 1 failed: allocateMoney(100, [1, 1, 1]) should equal [34, 33, 33], got ${JSON.stringify(result1)}`);
        
        // Test case 2: Allocation with different ratios
        const result2 = allocateMoney(100, [2, 3, 5]);
        const expected2 = [20, 30, 50];
        console.assert(JSON.stringify(result2) === JSON.stringify(expected2), 
            `Test 2 failed: allocateMoney(100, [2, 3, 5]) should equal [20, 30, 50], got ${JSON.stringify(result2)}`);
        
        // Test case 3: Allocation with remainder
        const result3 = allocateMoney(101, [1, 1, 1]);
        const expected3 = [34, 34, 33];
        console.assert(JSON.stringify(result3) === JSON.stringify(expected3), 
            `Test 3 failed: allocateMoney(101, [1, 1, 1]) should equal [34, 34, 33], got ${JSON.stringify(result3)}`);
        
        // Test case 4: Allocation with larger remainder
        const result4 = allocateMoney(103, [1, 1, 1]);
        const expected4 = [35, 34, 34];
        console.assert(JSON.stringify(result4) === JSON.stringify(expected4), 
            `Test 4 failed: allocateMoney(103, [1, 1, 1]) should equal [35, 34, 34], got ${JSON.stringify(result4)}`);
        
        // Test case 5: Allocation with different ratios and remainder
        const result5 = allocateMoney(101, [3, 7]);
        const expected5 = [30, 71];
        console.assert(JSON.stringify(result5) === JSON.stringify(expected5), 
            `Test 5 failed: allocateMoney(101, [3, 7]) should equal [30, 71], got ${JSON.stringify(result5)}`);
        
        console.log("All allocateMoney tests passed!");
        return true;
    } catch (error) {
        console.error("allocateMoney test failed:", error.message);
        return false;
    }
}

// Run all tests including allocateMoney
function runAllTests() {
    runTests();
    testMultiplyMoney();
    testSplitMoney();
    testAllocateMoney();
}

// Run the tests
runAllTests();
// Function to calculate tax on money
function taxMoney(cents, ratePct) {
    // Calculate tax amount: net * ratePct / 100
    const tax = Math.round(cents * ratePct) / 100;
    
    // Gross is net plus tax
    const gross = cents + tax;
    
    // Return the result object
    return {
        net: cents,
        tax: tax,
        gross: gross
    };
}

// Export the function
module.exports = {
    parseMoney,
    formatMoney,
    addMoney,
    subtractMoney,
    multiplyMoney,
    splitMoney,
    allocateMoney,
    taxMoney,
    convertMoney
};
// Function to convert money from one currency to another
function convertMoney(cents, from, to, rates) {
    // Check if both currencies are supported
    if (!(from in rates)) {
        throw new Error(`Unknown source currency: ${from}`);
    }
    if (!(to in rates)) {
        throw new Error(`Unknown target currency: ${to}`);
    }
    
    // Convert cents to USD first
    const usd = cents / rates[from];
    
    // Convert USD to target currency
    const targetCents = Math.round(usd * rates[to]);
    
    return targetCents;
}
// Function to sum money amounts in cents
function sumMoney(list) {
    // Handle empty array
    if (list.length === 0) {
        return 0;
    }
    
    // Validate that all items are integers
    for (const amount of list) {
        if (!Number.isInteger(amount)) {
            throw new Error(`All items must be integers, got: ${amount}`);
        }
    }
    
    // Sum all amounts
    return list.reduce((sum, amount) => sum + amount, 0);
}

// Function to compare two money values
function compareMoney(a, b) {
    // Validate that both arguments are integers
    if (!Number.isInteger(a)) {
        throw new Error(`First argument must be an integer, got: ${a}`);
    }
    if (!Number.isInteger(b)) {
        throw new Error(`Second argument must be an integer, got: ${b}`);
    }
    
    // Compare and return -1, 0, or 1
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

module.exports = {
    parseMoney,
    formatMoney,
    addMoney,
    subtractMoney,
    multiplyMoney,
    splitMoney,
    allocateMoney,
    taxMoney,
    convertMoney,
    sumMoney,
    compareMoney
};
