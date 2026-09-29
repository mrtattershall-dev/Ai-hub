// Comprehensive test for parseMoney function
const fs = require('fs');

// Read the r8_money.js file
const content = fs.readFileSync('r8_money.js', 'utf8');

// Extract just the parseMoney function
const parseMoneyMatch = content.match(/function parseMoney\(text\) \{[\s\S]*?return cents; \}/);

if (parseMoneyMatch) {
    // Create the function by evaluating the code
    const funcCode = parseMoneyMatch[0];
    
    // Create a function from the extracted code
    const parseMoney = new Function('text', 'return ' + funcCode.replace('function parseMoney(text) {', '').replace('return cents; }', 'return cents;'));
    
    console.log("Testing parseMoney function comprehensively:");
    
    // Test cases that should work (all existing functionality + new)
    const testCases = [
        // Original functionality (should still work)
        { input: '$10.50', expected: 1050, description: "Original $ format" },
        { input: '$0.99', expected: 99, description: "Original $ format small" },
        { input: '$100', expected: 10000, description: "Original $ format whole number" },
        { input: '-$5.25', expected: -525, description: "Original $ format negative" },
        
        // New functionality - Euro and Pound symbols
        { input: '€10.50', expected: 1050, description: "Euro symbol" },
        { input: '£10.50', expected: 1050, description: "Pound symbol" },
        { input: '€0.99', expected: 99, description: "Euro symbol small" },
        { input: '£100', expected: 10000, description: "Pound symbol whole number" },
        { input: '-€5.25', expected: -525, description: "Euro symbol negative" },
        
        // Currency codes
        { input: '10.50 EUR', expected: 1050, description: "EUR currency code" },
        { input: '10.50 GBP', expected: 1050, description: "GBP currency code" },
        { input: '10.50 USD', expected: 1050, description: "USD currency code" },
        { input: '0.99 EUR', expected: 99, description: "EUR currency code small" },
        { input: '100 GBP', expected: 10000, description: "GBP currency code whole number" },
        { input: '-5.25 USD', expected: -525, description: "USD currency code negative" },
        
        // Whitespace handling
        { input: '  $10.50  ', expected: 1050, description: "Whitespace around $ format" },
        { input: '  €10.50  ', expected: 1050, description: "Whitespace around Euro" },
        { input: '  10.50 EUR  ', expected: 1050, description: "Whitespace around currency code" },
    ];
    
    let passed = 0;
    let failed = 0;
    
    testCases.forEach(testCase => {
        try {
            const result = parseMoney(testCase.input);
            if (result === testCase.expected) {
                console.log(`✓ ${testCase.description}: "${testCase.input}" → ${result}`);
                passed++;
            } else {
                console.log(`✗ ${testCase.description}: "${testCase.input}" → ${result} (expected ${testCase.expected})`);
                failed++;
            }
        } catch (e) {
            console.log(`✗ ${testCase.description}: "${testCase.input}" → Error: ${e.message}`);
            failed++;
        }
    });
    
    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    
    // Test error cases - these should all throw errors
    const errorCases = [
        'invalid',
        '',
        '$',
        '€',
        '£',
        'EUR',
        'GBP',
        'USD',
        '10.50',
        '10.50 XYZ', // Invalid currency code
    ];
    
    console.log("\nTesting error cases:");
    let errorPassed = 0;
    let errorFailed = 0;
    
    errorCases.forEach(errorCase => {
        try {
            const result = parseMoney(errorCase);
            console.log(`✗ "${errorCase}" → ${result} (should have thrown error)`);
            errorFailed++;
        } catch (e) {
            console.log(`✓ "${errorCase}" → Correctly threw error: ${e.message}`);
            errorPassed++;
        }
    });
    
    console.log(`\nError handling: ${errorPassed} passed, ${errorFailed} failed`);
    
    const totalPassed = passed + errorPassed;
    const totalFailed = failed + errorFailed;
    console.log(`\nOverall: ${totalPassed} passed, ${totalFailed} failed`);
    
    if (totalFailed === 0) {
        console.log("✅ All tests passed! The parseMoney function works correctly.");
    } else {
        console.log("❌ Some tests failed.");
    }
} else {
    console.log("Could not find parseMoney function");
}