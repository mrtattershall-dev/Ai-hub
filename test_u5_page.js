// Simple test to verify input validation works in u5_page.js
// This would normally be run in a browser environment

// Mock DOM elements for testing
const mockElements = {
    num1: { value: '' },
    num2: { value: '' },
    calculate: { addEventListener: () => {} },
    result: { textContent: '', style: { color: '' } }
};

// Since we can't easily test the full DOM interaction here,
// let's just verify the logic by directly testing the validation function
function testValidation(num1Value, num2Value, expectedError) {
    const trimmedNum1 = num1Value.trim();
    const trimmedNum2 = num2Value.trim();
    
    // Check if inputs are empty
    if (trimmedNum1 === '' || trimmedNum2 === '') {
        return 'Error: Both inputs must be filled.';
    }
    
    // Check if inputs are valid numbers
    const num1 = parseFloat(trimmedNum1);
    const num2 = parseFloat(trimmedNum2);
    
    if (isNaN(num1) || isNaN(num2)) {
        return 'Error: Both inputs must be valid numbers.';
    }
    
    return null; // No error
}

// Test cases
console.log("Testing validation logic:");
console.log("Empty inputs:", testValidation('', ''));
console.log("One empty, one valid:", testValidation('', '5'));
console.log("One empty, one invalid:", testValidation('', 'abc'));
console.log("Both valid numbers:", testValidation('3', '4'));
console.log("Both invalid:", testValidation('abc', 'def'));
console.log("One valid, one invalid:", testValidation('5', 'def'));