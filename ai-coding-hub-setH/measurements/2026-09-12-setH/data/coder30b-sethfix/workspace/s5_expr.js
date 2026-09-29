// s5_expr.js - Expression evaluator with + - * / operations
/**
 * Evaluates a mathematical expression containing +, -, *, / operators
 * @param {string} expr - The expression to evaluate
 * @param {Object} vars - Object containing variable names and their values
 * @returns {number} - The result of the evaluation
 */
function evaluate(expr, vars = {}) {
    // Remove all spaces
    expr = expr.replace(/\s/g, '');
    
    // Check for empty expression
    if (expr === '') {
        throw new Error('Empty expression');
    }
    
    // Check for invalid characters
    if (!/^[0-9+\-*/^.(),A-Za-z_]+$/.test(expr)) {
        throw new Error('Invalid characters in expression');
    }
    
    // Simple recursive descent parser for expressions
    let pos = 0;
    
    function parseExpression() {
        let result = parseTerm();
        
        while (pos < expr.length && (expr[pos] === '+' || expr[pos] === '-')) {
            const operator = expr[pos];
            pos++;
            const right = parseTerm();
            if (operator === '+') {
                result += right;
            } else {
                result -= right;
            }
        }
        
        return result;
    }
    
    function parsePower() {
        let result = parseFactor();
        
        // Handle right-associative power operator
        if (pos < expr.length && expr[pos] === '^') {
            pos++;
            const right = parsePower(); // Right associative
            result = Math.pow(result, right);
        }
        
        return result;
    }
    
    function parseTerm() {
        let result = parsePower();
        
        while (pos < expr.length && (expr[pos] === '*' || expr[pos] === '/')) {
            const operator = expr[pos];
            pos++;
            const right = parsePower();
            if (operator === '*') {
                result *= right;
            } else {
                if (right === 0) {
                    throw new Error('Division by zero');
                }
                result /= right;
            }
        }
        
        return result;
    }
    
    function parseFactor() {
        if (pos >= expr.length) {
            throw new Error('Unexpected end of expression');
        }
        
        // Handle parentheses
        if (expr[pos] === '(') {
            pos++;
            const result = parseExpression();
            if (pos >= expr.length || expr[pos] !== ')') {
                throw new Error('Mismatched parentheses');
            }
            pos++;
            return result;
        }
        
        // Handle unary minus
        if (expr[pos] === '-') {
            pos++;
            // For unary minus, we need to parse the next factor first, then apply minus
            // But we need to make sure power has higher precedence
            const factor = parsePower();
            return -factor;
        }
        
        // Parse function call or variable name (letters, digits, underscores, but must start with letter or underscore)
        let start = pos;
        if (/[A-Za-z_]/.test(expr[pos])) {
            // Check if it's a function call (has parentheses)
            while (pos < expr.length && /[A-Za-z0-9_]/.test(expr[pos])) {
                pos++;
            }
            
            const funcName = expr.substring(start, pos);
            
            // Check if it's a function call
            if (pos < expr.length && expr[pos] === '(') {
                pos++; // consume '('
                
                // Parse arguments
                let args = [];
                if (expr[pos] !== ')') { // if not empty parentheses
                    while (true) {
                        args.push(parseExpression());
                        if (pos >= expr.length) {
                            throw new Error('Mismatched parentheses');
                        }
                        if (expr[pos] === ')') {
                            break;
                        }
                        if (expr[pos] !== ',') {
                            throw new Error('Expected comma or closing parenthesis');
                        }
                        pos++; // consume ','
                    }
                }
                
                // Check for closing parenthesis
                if (pos >= expr.length || expr[pos] !== ')') {
                    throw new Error('Mismatched parentheses');
                }
                pos++; // consume ')'
                
                // Handle built-in functions
                switch (funcName) {
                    case 'abs':
                        if (args.length !== 1) {
                            throw new Error('abs() requires exactly one argument');
                        }
                        return Math.abs(args[0]);
                    case 'sqrt':
                        if (args.length !== 1) {
                            throw new Error('sqrt() requires exactly one argument');
                        }
                        if (args[0] < 0) {
                            throw new Error('sqrt() of negative number');
                        }
                        return Math.sqrt(args[0]);
                    case 'min':
                        if (args.length < 1) {
                            throw new Error('min() requires at least one argument');
                        }
                        return Math.min(...args);
                    case 'max':
                        if (args.length < 1) {
                            throw new Error('max() requires at least one argument');
                        }
                        return Math.max(...args);
                    default:
                        throw new Error(`Unknown function: ${funcName}`);
                }
            } else {
                // It's a variable
                if (vars[funcName] === undefined) {
                    throw new Error(`Unknown variable: ${funcName}`);
                }
                return vars[funcName];
            }
        }
        
        // Parse number
        start = pos;
        while (pos < expr.length && /[0-9.]/.test(expr[pos])) {
            pos++;
        }
        
        if (start === pos) {
            throw new Error('Unexpected character: ' + expr[pos]);
        }
        
        return parseFloat(expr.substring(start, pos));
    }
    
    const result = parseExpression();
    
    // Check if we've consumed the entire expression
    if (pos < expr.length) {
        throw new Error('Unexpected character: ' + expr[pos]);
    }
    
    return result;
}

// Test cases
try {
    // Basic operations
    console.assert(evaluate("1 + 2") === 3, "1 + 2 should equal 3");
    console.assert(evaluate("5 - 3") === 2, "5 - 3 should equal 2");
    console.assert(evaluate("4 * 6") === 24, "4 * 6 should equal 24");
    console.assert(evaluate("8 / 2") === 4, "8 / 2 should equal 4");
    
    // Precedence
    console.assert(evaluate("2 + 3 * 4") === 14, "2 + 3 * 4 should equal 14 (multiplication first)");
    console.assert(evaluate("10 - 6 / 2") === 7, "10 - 6 / 2 should equal 7 (division first)");
    
    // Left-to-right evaluation
    console.assert(evaluate("10 - 4 - 2") === 4, "10 - 4 - 2 should equal 4 (left to right)");
    console.assert(evaluate("12 / 3 / 2") === 2, "12 / 3 / 2 should equal 2 (left to right)");
    
    // With spaces
    console.assert(evaluate("  2 + 3  *  4  ") === 14, "Spaces should be ignored");
    
    // Decimals
    console.assert(evaluate("1.5 + 2.5") === 4, "1.5 + 2.5 should equal 4");
    console.assert(evaluate("7.5 / 2.5") === 3, "7.5 / 2.5 should equal 3");
    
    // Parentheses
    console.assert(evaluate("(2 + 3) * 4") === 20, "(2 + 3) * 4 should equal 20");
    console.assert(evaluate("2 * (3 + 4)") === 14, "2 * (3 + 4) should equal 14");
    
    // Complex expression
    console.assert(evaluate("2 + 3 * 4 - 1") === 13, "2 + 3 * 4 - 1 should equal 13");
    
    // Test division by zero
    try {
        evaluate("5 / 0");
        console.assert(false, "Should have thrown an error for division by zero");
    } catch (e) {
        console.assert(e.message === "Division by zero", "Should throw 'Division by zero' error");
    }
    
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

module.exports = { evaluate };