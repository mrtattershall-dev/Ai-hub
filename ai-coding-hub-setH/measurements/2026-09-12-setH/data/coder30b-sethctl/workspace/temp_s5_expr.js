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
        throw new Error('Invalid expression');
    }
    
    // Check for invalid characters
    // Allow minus signs in valid positions (after operators, at start, or as part of numbers)
    // Also allow letters, numbers, and underscores for variable names
    if (!/^[0-9+\-*/.()A-Za-z_]+$/.test(expr)) {
        throw new Error('Invalid characters in expression');
    }
    
    // Check for division by zero
    if (expr.includes('/0')) {
        throw new Error('Division by zero');
    }
    
    // Replace variables with their values
    // First, we need to find all variable names in the expression
    // A variable name is a sequence of letters, digits, or underscores that starts with a letter or underscore
    const varNames = expr.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
    
    // Check if any variable is not defined
    for (const varName of varNames) {
        // Skip if it's a number (like 123)
        if (/^\d+(\.\d+)?$/.test(varName)) {
            continue;
        }
        
        if (vars[varName] === undefined) {
            throw new Error(`Unknown variable: ${varName}`);
        }
    }
    
    // Replace variables with their values
    let processedExpr = expr;
    for (const varName of varNames) {
        // Skip if it's a number
        if (/^\d+(\.\d+)?$/.test(varName)) {
            continue;
        }
        
        // Replace all occurrences of the variable name with its value
        // We need to be careful to match whole words only
        const regex = new RegExp(`\\b${varName}\\b`, 'g');
        processedExpr = processedExpr.replace(regex, vars[varName]);
    }
    
    // Now evaluate the processed expression
    try {
        // Check for valid expression structure
        if (!/^[0-9+\-*/.()]+$/.test(processedExpr)) {
            throw new Error('Invalid expression');
        }
        
        // Use Function constructor to evaluate the expression safely
        // This approach avoids eval() but still allows basic arithmetic operations
        // We need to be more careful about the evaluation
        let result;
        try {
            result = new Function('return ' + processedExpr)();
        } catch (e) {
            // If Function constructor fails, try a more direct approach
            // But first check if it's a simple number
            if (/^-?\d+(\.\d+)?$/.test(processedExpr)) {
                result = parseFloat(processedExpr);
            } else {
                throw new Error('Invalid expression');
            }
        }
        
        // Check if result is a valid number
        if (typeof result !== 'number' || isNaN(result)) {
            throw new Error('Invalid expression');
        }
        
        return result;
    } catch (e) {
        if (e.message === 'Division by zero') {
            throw e;
        }
        throw new Error('Invalid expression');
    }
}

// Export the function for use in other modules
module.exports = { evaluate };