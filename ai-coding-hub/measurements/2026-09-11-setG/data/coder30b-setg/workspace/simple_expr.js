// Simple version to test the core functionality
function evaluate(expr) {
    // Remove all spaces
    expr = expr.replace(/\s/g, '');
    
    // Check for empty expression
    if (expr === '') {
        throw new Error('Empty expression');
    }
    
    // Check for invalid characters
    if (!/^[0-9+\-*/.()]+$/.test(expr)) {
        throw new Error('Invalid characters in expression');
    }
    
    // Handle division by zero
    if (expr.match(/\/0(?:\.0*)?/)) {
        throw new Error('Division by zero');
    }
    
    // Simple evaluation using Function constructor
    try {
        const result = new Function('return ' + expr)();
        
        if (typeof result !== 'number' || isNaN(result)) {
            throw new Error('Invalid expression');
        }
        
        return result;
    } catch (e) {
        throw new Error('Invalid expression');
    }
}

// Test the specific failing cases
console.log("Testing 1: Division by zero");
try {
    console.log("Result:", evaluate("5 / 0"));
} catch(e) {
    console.log("Error:", e.message);
}

console.log("\nTesting 2: Invalid expression");
try {
    console.log("Result:", evaluate("2 + + 3"));
} catch(e) {
    console.log("Error:", e.message);
}

console.log("\nTesting 3: Empty expression");
try {
    console.log("Result:", evaluate(""));
} catch(e) {
    console.log("Error:", e.message);
}

console.log("\nTesting 4: Valid expression");
try {
    console.log("Result:", evaluate("2 + 3"));
} catch(e) {
    console.log("Error:", e.message);
}