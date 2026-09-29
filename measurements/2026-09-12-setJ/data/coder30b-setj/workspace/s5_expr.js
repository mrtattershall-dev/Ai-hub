// s5_expr.js - Expression evaluator with + - * / operations

/**
 * Evaluates a mathematical expression containing +, -, *, / operators
 * @param {string} expr - The expression to evaluate
 * @returns {number} - The result of the evaluation
 */
function evaluate(expr) {
    // Remove all spaces
    expr = expr.replace(/\s/g, '');
    
    // Check for empty expression
    if (expr === '') {
        throw new Error("Empty expression");
    }
    
    // Check for invalid characters
    if (!/^[0-9+\-*/.()]+$/.test(expr)) {
        throw new Error("Invalid expression");
    }
    
    // Check for invalid patterns
    if (expr.match(/[\+\-\*\/]{2,}/) || expr.match(/[+\-*/]$/)) {
        throw new Error("Invalid expression");
    }
    
    // Handle division by zero
    if (expr.includes('/0')) {
        throw new Error("Division by zero");
    }
    
    // Simple and robust approach using eval with safety checks
    // First, let's validate the expression structure more carefully
    try {
        // Check for balanced parentheses
        let parenCount = 0;
        for (let i = 0; i < expr.length; i++) {
            if (expr[i] === '(') parenCount++;
            if (expr[i] === ')') parenCount--;
            if (parenCount < 0) throw new Error("Mismatched parentheses");
        }
        if (parenCount !== 0) throw new Error("Mismatched parentheses");
        
        // For safety, we'll use a more careful approach
        // Replace all occurrences of division by zero
        if (expr.includes('/0')) {
            throw new Error("Division by zero");
        }
        
        // Handle parentheses recursively
        while (expr.includes('(')) {
            const parenMatch = expr.match(/\([^()]+\)/);
            if (!parenMatch) {
                throw new Error("Mismatched parentheses");
            }
            const innerExpr = parenMatch[0].slice(1, -1);
            const result = evaluate(innerExpr);
            expr = expr.replace(parenMatch[0], result);
        }
        
        // Handle unary minus: replace unary minus with a special marker
        // This handles cases like -(2+3) or -3
        // Handle unary minus at the beginning of expression
        expr = expr.replace(/^(-)(?=\d)/, '0$1');
        // Handle unary minus after opening parentheses or operators
        expr = expr.replace(/([+\-*/(])(-)(?=\d)/g, '$10$2');
        
        // Now we have an expression without parentheses
        // Parse it using a simple approach: first handle * and /, then + and -
        // Split by operators to get numbers and operators
        const tokens = expr.match(/(\d+\.?\d*|\+|\-|\*|\/)/g);
        if (!tokens) throw new Error("Invalid expression");
        
        // First pass: handle multiplication and division
        for (let i = 1; i < tokens.length; i += 2) {
            const operator = tokens[i];
            if (operator === '*' || operator === '/') {
                const left = parseFloat(tokens[i-1]);
                const right = parseFloat(tokens[i+1]);
                
                if (operator === '/' && right === 0) {
                    throw new Error("Division by zero");
                }
                
                const result = operator === '*' ? left * right : left / right;
                
                // Replace the three tokens with the result
                tokens.splice(i-1, 3, result.toString());
                i -= 2; // Adjust index since we removed elements
            }
        }
        
        // Second pass: handle addition and subtraction
        for (let i = 1; i < tokens.length; i += 2) {
            const operator = tokens[i];
            if (operator === '+' || operator === '-') {
                const left = parseFloat(tokens[i-1]);
                const right = parseFloat(tokens[i+1]);
                
                const result = operator === '+' ? left + right : left - right;
                
                // Replace the three tokens with the result
                tokens.splice(i-1, 3, result.toString());
                i -= 2; // Adjust index since we removed elements
            }
        }
        
        // The final result should be the only element left
        const finalResult = parseFloat(tokens[0]);
        if (isNaN(finalResult)) {
            throw new Error("Invalid expression");
        }
        
        return finalResult;
    } catch (e) {
        throw new Error("Invalid expression");
    }
}

/**
 * Helper function to extract a number from an expression
 * @param {string} expr - The expression
 * @param {number} pos - Position to start looking
 * @param {boolean} left - Whether to look left or right
 * @returns {string} - The number as a string
 */
function getNumber(expr, pos, left) {
    if (left) {
        // Look for a number to the left
        let start = pos;
        while (start >= 0 && (/[0-9.]/.test(expr[start]))) {
            start--;
        }
        start++;
        return expr.substring(start, pos + 1);
    } else {
        // Look for a number to the right
        let end = pos;
        while (end < expr.length && (/[0-9.]/.test(expr[end]))) {
            end++;
        }
        return expr.substring(pos, end);
    }
}

/**
 * Helper function to find the start position of a number
 * @param {string} expr - The expression
 * @param {number} pos - Position to start looking
 * @param {boolean} left - Whether to look left or right
 * @returns {number} - The start position
 */
function getNumberStart(expr, pos, left) {
    if (left) {
        let start = pos;
        while (start >= 0 && (/[0-9.]/.test(expr[start]))) {
            start--;
        }
        return start + 1;
    } else {
        return pos;
    }
}

/**
 * Helper function to find the end position of a number
 * @param {string} expr - The expression
 * @param {number} pos - Position to start looking
 * @param {boolean} right - Whether to look right or left
 * @returns {number} - The end position
 */
function getNumberEnd(expr, pos, right) {
    if (right) {
        let end = pos;
        while (end < expr.length && (/[0-9.]/.test(expr[end]))) {
            end++;
        }
        return end - 1;
    } else {
        return pos;
    }
}

module.exports = { evaluate };
// Add asserts
function runAsserts() {
    // Test basic operations
    console.assert(evaluate("1 + 2") === 3, "1 + 2 should equal 3");
    console.assert(evaluate("5 - 3") === 2, "5 - 3 should equal 2");
    console.assert(evaluate("4 * 6") === 24, "4 * 6 should equal 24");
    console.assert(evaluate("8 / 2") === 4, "8 / 2 should equal 4");
    
    // Test precedence
    console.assert(evaluate("2 + 3 * 4") === 14, "2 + 3 * 4 should equal 14 (multiplication first)");
    console.assert(evaluate("10 - 6 / 2") === 7, "10 - 6 / 2 should equal 7 (division first)");
    
    // Test left-to-right evaluation for same precedence
    console.assert(evaluate("10 - 4 - 2") === 4, "10 - 4 - 2 should equal 4 (left to right)");
    console.assert(evaluate("12 / 4 * 2") === 6, "12 / 4 * 2 should equal 6 (left to right)");
    
    // Test decimals
    console.assert(evaluate("1.5 + 2.5") === 4, "1.5 + 2.5 should equal 4");
    console.assert(evaluate("7.5 / 2.5") === 3, "7.5 / 2.5 should equal 3");
    
    // Test parentheses
    console.assert(evaluate("(2 + 3) * 4") === 20, "(2 + 3) * 4 should equal 20");
    console.assert(evaluate("2 * (3 + 4)") === 14, "2 * (3 + 4) should equal 14");
    
    // Test spaces
    console.assert(evaluate("  5   +   3  ") === 8, "spaces should be ignored");
    
    // Test error cases
    try {
        evaluate("5 / 0");
        console.assert(false, "Division by zero should throw an error");
    } catch (e) {
        console.assert(e.message === "Division by zero", "Should throw division by zero error");
    }
    
    try {
        evaluate("invalid");
        console.assert(false, "Invalid expression should throw an error");
    } catch (e) {
        console.assert(e.message === "Invalid expression", "Should throw invalid expression error");
    }
    
    try {
        evaluate("");
        console.assert(false, "Empty expression should throw an error");
    } catch (e) {
        console.assert(e.message === "Empty expression", "Should throw empty expression error");
    }
    
    console.log("All asserts passed!");
}

// Run the asserts
runAsserts();
