/**
 * Evaluates a mathematical expression containing +, -, *, / with numbers
 * @param {string} expr - The expression to evaluate
 * @param {Object} vars - Object containing variable names and their values
 * @returns {number} - The result of the evaluation
 * @throws {Error} - If the expression is invalid or division by zero occurs
 */
function evaluate(expr, vars = {}) {
    // Remove all spaces
    expr = expr.replace(/\s/g, '');
    
    // Check for empty expression
    if (expr === '') {
        throw new Error('Invalid expression at 0');
    }
    
    // Check for invalid characters
    // Allow minus signs in valid positions (after operators, at start, or as part of numbers)
    // Also allow letters, numbers, and underscores for variable names
    if (!/^[0-9+\-*/.()A-Za-z_]+$/.test(expr)) {
        // Find the first invalid character and report its position
        for (let i = 0; i < expr.length; i++) {
            if (!/^[0-9+\-*/.()A-Za-z_]+$/.test(expr[i])) {
                throw new Error(`Invalid characters in expression at ${i}`);
            }
        }
        throw new Error('Invalid characters in expression at ' + expr.length);
    }
    
    // Check for division by zero
    if (expr.includes('/0')) {
        throw new Error('Division by zero at ' + expr.indexOf('/0'));
    }
    
    // Parse and evaluate the expression with proper precedence and parentheses handling
    try {
        // First, handle unary minus by replacing - at the start or after ( or * or / or + with _minus_
        // This is a workaround to handle unary minus properly
        expr = expr.replace(/^-/, '_minus_');
        expr = expr.replace(/\(-/, '(_minus_');
        
        // Validate the expression structure
        // Check for consecutive operators (except for minus sign)
        if (/[\+\*\/]{2,}/.test(expr) || /^[\+\*\/]/.test(expr) || /[\+\*\/]$/.test(expr)) {
            // Find the position of the first consecutive operator
            let match = expr.match(/[\+\*\/]{2,}/);
            if (match) {
                throw new Error('Invalid expression at ' + expr.indexOf(match[0]));
            } else {
                // Check if it starts with an operator
                if (/^[\+\*\/]/.test(expr)) {
                    throw new Error('Invalid expression at 0');
                } else {
                    // Ends with an operator
                    throw new Error('Invalid expression at ' + (expr.length - 1));
                }
            }
        }
        
        // Check for balanced parentheses
        let parenCount = 0;
        for (let i = 0; i < expr.length; i++) {
            if (expr[i] === '(') parenCount++;
            if (expr[i] === ')') parenCount--;
            if (parenCount < 0) throw new Error('Invalid parentheses at ' + i);
        }
        if (parenCount !== 0) throw new Error('Invalid parentheses at ' + (expr.length - 1));
        
        // Replace _minus_ with a special marker that can be handled by the evaluation
        // We'll do this by replacing it with a negative number handling
        // For now, let's use a simpler approach: recursively evaluate parentheses
        function parse(expr) {
            // Remove spaces
            expr = expr.replace(/\s/g, '');
            
            // Handle function calls first (min, max, abs, sqrt)
            // Look for function calls like funcname(...)
            let funcMatch = expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)$/);
            if (funcMatch) {
                let funcName = funcMatch[1];
                let argsStr = funcMatch[2];
                
                // Handle special functions
                if (funcName === 'min' || funcName === 'max' || funcName === 'abs' || funcName === 'sqrt') {
                    // Parse arguments
                    let args = [];
                    let argStart = 0;
                    let parenCount = 0;
                    let inString = false;
                    let stringChar = '';
                    
                    for (let i = 0; i <= argsStr.length; i++) {
                        let char = argsStr[i];
                        
                        if (!inString && (char === '"' || char === "'")) {
                            inString = true;
                            stringChar = char;
                        } else if (inString && char === stringChar) {
                            inString = false;
                            stringChar = '';
                        } else if (!inString && char === '(') {
                            parenCount++;
                        } else if (!inString && char === ')') {
                            parenCount--;
                        } else if (!inString && char === ',' && parenCount === 0) {
                            args.push(argsStr.substring(argStart, i));
                            argStart = i + 1;
                        }
                    }
                    
                    // Add the last argument
                    if (argStart < argsStr.length) {
                        args.push(argsStr.substring(argStart));
                    }
                    
                    // Validate number of arguments
                    if ((funcName === 'abs' || funcName === 'sqrt') && args.length !== 1) {
                        throw new Error(`Function ${funcName} expects exactly 1 argument at ${expr.length}`);
                    }
                    
                    if ((funcName === 'min' || funcName === 'max') && args.length < 1) {
                        throw new Error(`Function ${funcName} expects at least 1 argument at ${expr.length}`);
                    }
                    
                    // Evaluate arguments
                    let evaluatedArgs = [];
                    for (let i = 0; i < args.length; i++) {
                        evaluatedArgs.push(parse(args[i].trim()));
                    }
                    
                    // Apply function
                    if (funcName === 'abs') {
                        return Math.abs(evaluatedArgs[0]);
                    } else if (funcName === 'sqrt') {
                        if (evaluatedArgs[0] < 0) {
                            throw new Error('sqrt of negative number at ' + expr.length);
                        }
                        return Math.sqrt(evaluatedArgs[0]);
                    } else if (funcName === 'min') {
                        return Math.min(...evaluatedArgs);
                    } else if (funcName === 'max') {
                        return Math.max(...evaluatedArgs);
                    }
                }
            }
            
            // Handle parentheses recursively
            while (expr.includes('(')) {
                // Find the innermost parentheses
                let start = -1;
                let parenCount = 0;
                for (let i = 0; i < expr.length; i++) {
                    if (expr[i] === '(') {
                        if (parenCount === 0) start = i;
                        parenCount++;
                    } else if (expr[i] === ')') {
                        parenCount--;
                        if (parenCount === 0) {
                            // Found innermost parentheses
                            let innerExpr = expr.substring(start + 1, i);
                            let innerResult = parse(innerExpr);
                            expr = expr.substring(0, start) + innerResult + expr.substring(i + 1);
                            break;
                        }
                    }
                }
                if (start === -1) break; // No more parentheses
            }
            
            // Handle unary minus at the beginning or after operators
            if (expr.startsWith('_minus_')) {
                expr = '-' + expr.substring(7); // Remove _minus_ and add minus
            }
            
            // Handle unary minus after operators
            expr = expr.replace(/\(_minus_/, '(0-');
            
            // Now handle multiplication and division (left to right)
            let i = 0;
            while (i < expr.length) {
                if (expr[i] === '*') {
                    let left = getNumber(expr, i - 1, true);
                    let right = getNumber(expr, i + 1, false);
                    let result = left * right;
                    expr = expr.substring(0, i - left.toString().length) + result + expr.substring(i + right.toString().length + 1);
                } else if (expr[i] === '/') {
                    let left = getNumber(expr, i - 1, true);
                    let right = getNumber(expr, i + 1, false);
                    if (right === 0) throw new Error('Division by zero at ' + i);
                    let result = left / right;
                    expr = expr.substring(0, i - left.toString().length) + result + expr.substring(i + right.toString().length + 1);
                } else {
                    i++;
                }
            }
            
            // Handle power operator (right to left)
            i = expr.length - 1;
            while (i >= 0) {
                if (expr[i] === '^') {
                    let left = getNumber(expr, i - 1, true);
                    let right = getNumber(expr, i + 1, false);
                    let result = Math.pow(left, right);
                    expr = expr.substring(0, i - left.toString().length) + result + expr.substring(i + right.toString().length + 1);
                } else {
                    i--;
                }
            }
            
            // Handle addition and subtraction (left to right)
            i = 0;
            while (i < expr.length) {
                if (expr[i] === '+' && i > 0) {
                    let left = getNumber(expr, i - 1, true);
                    let right = getNumber(expr, i + 1, false);
                    let result = left + right;
                    expr = expr.substring(0, i - left.toString().length) + result + expr.substring(i + right.toString().length + 1);
                } else if (expr[i] === '-' && i > 0) {
                    let left = getNumber(expr, i - 1, true);
                    let right = getNumber(expr, i + 1, false);
                    let result = left - right;
                    expr = expr.substring(0, i - left.toString().length) + result + expr.substring(i + right.toString().length + 1);
                } else {
                    i++;
                }
            }
            
            // If we have a single number, return it
            if (expr.match(/^-?\d+(\.\d+)?$/)) {
                return parseFloat(expr);
            }
            
            // If we still have operators, it's an invalid expression
            throw new Error('Invalid expression at ' + expr.length);
        }
        
        // Helper function to extract a number from the expression
        function getNumber(expr, pos, left) {
            let start = pos;
            let end = pos;
            
            if (left) {
                // Get number to the left
                while (start >= 0 && (/\d/.test(expr[start]) || expr[start] === '.' || expr[start] === '-')) {
                    if (expr[start] === '-' && start > 0 && !/\d/.test(expr[start - 1])) {
                        // This is a unary minus, so we stop
                        break;
                    }
                    start--;
                }
                start++;
            } else {
                // Get number to the right
                while (end < expr.length && (/\d/.test(expr[end]) || expr[end] === '.')) {
                    end++;
                }
            }
            
            // Check if this is a variable name
            if (start < end && /[A-Za-z_]/.test(expr[start])) {
                // Extract the variable name
                let varName = expr.substring(start, end);
                if (vars[varName] === undefined) {
                    throw new Error(`Unknown variable: ${varName} at ${start}`);
                }
                // Return the variable value
                return vars[varName];
            }
            
            let numStr = expr.substring(start, end);
            return parseFloat(numStr);
        }
        
        // Handle unary minus at the beginning
        if (expr.startsWith('_minus_')) {
            expr = '-' + expr.substring(7);
        }
        
        // Handle unary minus after operators
        expr = expr.replace(/\(_minus_/, '(0-');
        
        // Now parse the expression
        const result = parse(expr);
        
        // Check if result is a valid number
        if (typeof result !== 'number' || isNaN(result)) {
            throw new Error('Invalid expression at ' + expr.length);
        }
        
        return result;
    } catch (e) {
        if (e.message === 'Division by zero') {
            throw e;
        }
        throw new Error('Invalid expression at ' + expr.length);
    }
}

module.exports = { evaluate };