// Test the updated parseMoney function with new currency symbols and codes
const fs = require('fs');
const path = require('path');

// Read the r8_money.js file and extract the parseMoney function
const content = fs.readFileSync('r8_money.js', 'utf8');
const parseMoneyMatch = content.match(/function parseMoney\(text\) \{[\s\S]*?\}/);

if (parseMoneyMatch) {
    console.log("Testing parseMoney with new currency support:");
    
    // Evaluate the function in a way that we can test it
    const testFunction = new Function('text', 
        parseMoneyMatch[0].replace('function parseMoney(text) {', 'return function(text) {') + 
        'return cents; }'
    );
    
    // Test cases
    const testCases = [
        // Original functionality (should still work)
        { input: '$10.50', expected: 1050 },
        { input: '$0.99', expected: 99 },
        { input: '$100', expected: 10000 },
        { input: '-$5.25', expected: -525 },
        
        // New functionality
        { input: '€10.50', expected: 1050 },
        { input: '£10.50', expected: 1050 },
        { input: '€0.99', expected: 99 },
        { input: '£100', expected: 10000 },
        { input: '-€5.25', expected: -525 },
        
        // Currency codes
        { input: '10.50 EUR', expected: 1050 },
        { input: '10.50 GBP', expected: 1050 },
        { input: '10.50 USD', expected: 1050 },
        { input: '0.99 EUR', expected: 99 },
        { input: '100 GBP', expected: 10000 },
        { input: '-5.25 USD', expected: -525 },
        
        // Mixed cases
        { input: ' €10.50 ', expected: 1050 },
        { input: ' £10.50 ', expected: 1050 },
        { input: ' 10.50 EUR ', expected: 1050 },
    ];
    
    let passed = 0;
    let failed = 0;
    
    testCases.forEach(testCase => {
        try {
            const result = testFunction(testCase.input);
            if (result === testCase.expected) {
                console.log(`✓ ${testCase.input} → ${result}`);
                passed++;
            } else {
                console.log(`✗ ${testCase.input} → ${result} (expected ${testCase.expected})`);
                failed++;
            }
        } catch (e) {
            console.log(`✗ ${testCase.input} → Error: ${e.message}`);
            failed++;
        }
    });
    
    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    
    // Test error cases
    const errorCases = [
        'invalid',
        '',
        '$',
        '€',
        '£',
        'EUR',
        'GBP',
        'USD'
    ];
    
    console.log("\nTesting error cases:");
    errorCases.forEach(errorCase => {
        try {
            const result = testFunction(errorCase);
            console.log(`✗ ${errorCase} → ${result} (should have thrown error)`);
        } catch (e) {
            console.log(`✓ ${errorCase} → Correctly threw error: ${e.message}`);
        }
    });
} else {
    console.log("Could not find parseMoney function");
}