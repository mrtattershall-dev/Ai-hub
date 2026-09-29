const { evaluate } = require('./s5_expr.js');

// Test cases for the enhanced evaluate function
try {
    // Test basic operations still work
    console.assert(evaluate("1 + 2") === 3, "1 + 2 should equal 3");
    console.assert(evaluate("5 - 3") === 2, "5 - 3 should equal 2");
    console.assert(evaluate("4 * 6") === 24, "4 * 6 should equal 24");
    console.assert(evaluate("8 / 2") === 4, "8 / 2 should equal 4");
    
    // Test precedence
    console.assert(evaluate("2 + 3 * 4") === 14, "2 + 3 * 4 should equal 14 (multiplication first)");
    console.assert(evaluate("10 - 6 / 2") === 7, "10 - 6 / 2 should equal 7 (division first)");
    
    // Test left-to-right evaluation
    console.assert(evaluate("10 - 4 - 2") === 4, "10 - 4 - 2 should equal 4 (left to right)");
    console.assert(evaluate("12 / 3 / 2") === 2, "12 / 3 / 2 should equal 2 (left to right)");
    
    // Test with spaces
    console.assert(evaluate("  2 + 3  *  4  ") === 14, "Spaces should be ignored");
    
    // Test decimals
    console.assert(evaluate("1.5 + 2.5") === 4, "1.5 + 2.5 should equal 4");
    console.assert(evaluate("7.5 / 2.5") === 3, "7.5 / 2.5 should equal 3");
    
    // Test parentheses
    console.assert(evaluate("(2 + 3) * 4") === 20, "(2 + 3) * 4 should equal 20");
    console.assert(evaluate("2 * (3 + 4)") === 14, "2 * (3 + 4) should equal 14");
    
    // Test complex expression
    console.assert(evaluate("2 + 3 * 4 - 1") === 13, "2 + 3 * 4 - 1 should equal 13");
    
    // Test the new functionality: unary minus with parentheses
    console.assert(evaluate("-(2+3)*2") === -10, "-(2+3)*2 should equal -10");
    console.assert(evaluate("2*-3") === -6, "2*-3 should equal -6");
    
    // Test nested parentheses
    console.assert(evaluate("((2+3)*4)-5") === 15, "((2+3)*4)-5 should equal 15");
    
    // Test unary minus at the beginning
    console.assert(evaluate("-5") === -5, "-5 should equal -5");
    console.assert(evaluate("-2*3") === -6, "-2*3 should equal -6");
    
    // Test division by zero
    try {
        evaluate("5 / 0");
        console.assert(false, "Should have thrown an error for division by zero");
    } catch (e) {
        console.assert(e.message === "Division by zero", "Should throw 'Division by zero' error");
    }
    
    // Test power operator
    console.assert(evaluate("2^3") === 8, "2^3 should equal 8");
    console.assert(evaluate("2^3^2") === 512, "2^3^2 should equal 512 (right associative)");
    console.assert(evaluate("-2^2") === -4, "-2^2 should equal -4 (unary minus applies after power)");
    console.assert(evaluate("(-2)^2") === 4, "(-2)^2 should equal 4 (parentheses override precedence)");
    console.assert(evaluate("2*3^2") === 18, "2*3^2 should equal 18 (power binds tighter than multiply)");
    console.assert(evaluate("2^3*2") === 16, "2^3*2 should equal 16 (power binds tighter than multiply)");
    
    // Test invalid characters
    try {
        evaluate("2 + 3 & 4");
        console.assert(false, "Should have thrown an error for invalid characters");
    } catch (e) {
        console.assert(e.message === "Invalid characters in expression", "Should throw 'Invalid characters in expression' error");
    }
    
    console.log("All tests passed!");
} catch (e) {
    console.error("Test failed:", e.message);
    process.exit(1);
}

// Test new functions: abs, sqrt, min, max
console.assert(evaluate("abs(-5)") === 5, "abs(-5) should equal 5");
console.assert(evaluate("abs(3)") === 3, "abs(3) should equal 3");

console.assert(evaluate("sqrt(9)") === 3, "sqrt(9) should equal 3");
console.assert(evaluate("sqrt(16)") === 4, "sqrt(16) should equal 4");

console.assert(evaluate("min(1, 2, 3)") === 1, "min(1, 2, 3) should equal 1");
console.assert(evaluate("min(5, 2)") === 2, "min(5, 2) should equal 2");

console.assert(evaluate("max(1, 2, 3)") === 3, "max(1, 2, 3) should equal 3");
console.assert(evaluate("max(5, 2)") === 5, "max(5, 2) should equal 5");

// Test error cases for new functions
try {
    evaluate("sqrt(-4)");
    console.assert(false, "Should have thrown an error for sqrt of negative number");
} catch (e) {
    console.assert(e.message === "sqrt() of negative number", "Should throw 'sqrt() of negative number' error");
}

try {
    evaluate("abs()");
    console.assert(false, "Should have thrown an error for abs() with no arguments");
} catch (e) {
    console.assert(e.message === "abs() requires exactly one argument", "Should throw 'abs() requires exactly one argument' error");
}

try {
    evaluate("sqrt()");
    console.assert(false, "Should have thrown an error for sqrt() with no arguments");
} catch (e) {
    console.assert(e.message === "sqrt() requires exactly one argument", "Should throw 'sqrt() requires exactly one argument' error");
}

try {
    evaluate("min()");
    console.assert(false, "Should have thrown an error for min() with no arguments");
} catch (e) {
    console.assert(e.message === "min() requires at least one argument", "Should throw 'min() requires at least one argument' error");
}

try {
    evaluate("max()");
    console.assert(false, "Should have thrown an error for max() with no arguments");
} catch (e) {
    console.assert(e.message === "max() requires at least one argument", "Should throw 'max() requires at least one argument' error");
}

try {
    evaluate("unknown_func(5)");
    console.assert(false, "Should have thrown an error for unknown function");
} catch (e) {
    console.assert(e.message.includes("Unknown function: unknown_func"), "Should throw 'Unknown function: unknown_func' error");
}

console.log("All tests passed!");
