// Debug version to understand what's happening
function evaluate(expr) {
    console.log("Evaluating:", expr);
    
    // Remove all spaces
    expr = expr.replace(/\s/g, '');
    console.log("After space removal:", expr);
    
    // Check for empty expression
    if (expr === '') {
        console.log("Throwing empty expression error");
        throw new Error('Empty expression');
    }
    
    // Check for invalid characters
    if (!/^[0-9+\-*/.()]+$/.test(expr)) {
        console.log("Throwing invalid characters error");
        throw new Error('Invalid characters in expression');
    }
    
    // Check for invalid patterns (consecutive operators at start or end)
    if (expr.match(/^[+\-*/]|[+\-*/]$/)) {
        console.log("Throwing invalid format error 1");
        throw new Error('Invalid expression format');
    }
    
    // Check for consecutive operators (except for minus sign which can be unary)
    if (expr.match(/[+\-*/]{2,}/)) {
        // Allow consecutive minus signs (unary minus)
        if (!expr.match(/--+/)) {
            console.log("Throwing invalid format error 2");
            throw new Error('Invalid expression format');
        }
    }
    
    // Handle division by zero by checking for patterns like /0, /0.0, etc.
    if (expr.match(/\/0(?:\.0*)?/)) {
        console.log("Throwing division by zero error");
        throw new Error('Division by zero');
    }
    
    // Simple evaluation using Function constructor (avoiding eval)
    try {
        console.log("About to evaluate:", expr);
        // Use Function constructor to avoid direct eval
        const result = new Function('return ' + expr)();
        
        console.log("Result:", result);
        
        // Check if result is valid number
        if (typeof result !== 'number' || isNaN(result)) {
            console.log("Throwing invalid expression error");
            throw new Error('Invalid expression');
        }
        
        return result;
    } catch (e) {
        console.log("Caught error:", e.message);
        throw new Error('Invalid expression');
    }
}

// Test cases
console.log("=== Testing valid expressions ===");
try {
    console.log("2 + 3 =", evaluate("2 + 3"));
} catch(e) {
    console.log("Error:", e.message);
}

console.log("\n=== Testing division by zero ===");
try {
    console.log("5 / 0 =", evaluate("5 / 0"));
} catch(e) {
    console.log("Error:", e.message);
}

console.log("\n=== Testing invalid expression ===");
try {
    console.log("2 + + 3 =", evaluate("2 + + 3"));
} catch(e) {
    console.log("Error:", e.message);
}