// Basic expression evaluator with + - * / support
function evaluate(expr, vars = {}) {
    // Remove all spaces
    expr = expr.replace(/\s/g, '');
    
    // Check for empty expression
    if (expr === '') {
        throw new Error('Empty expression');
    }
    
    // Handle unary minus by preprocessing the expression
    function preprocessUnaryMinus(expr) {
        // Handle unary minus at the start of expression
        expr = expr.replace(/^-(?=\d)/, '0-');
    
        // Handle unary minus after opening parenthesis
        expr = expr.replace(/\(-(?=\d)/g, '(0-');
    
        // Handle unary minus that is not preceded by a digit or a closing parenthesis
        expr = expr.replace(/(^|[-+*/(])-([0-9.])/g, '$10-$2');
    
        return expr;
    }

    expr = preprocessUnaryMinus(expr);
    
    // Preprocess: replace variables with their values
    // This regex matches variable names (letters, digits, underscores, but not starting with digit)
    const variableRegex = /[A-Za-z_][A-Za-z0-9_]*/g;
    
    // Replace all variable names with their values
    expr = expr.replace(variableRegex, function(match) {
        // Check if this is a variable name
        if (vars.hasOwnProperty(match)) {
            return vars[match];
        } else {
            // If it's not a known variable, throw an error
            throw new Error(`Unknown variable: ${match}`);
        }
    });
    
    // Helper function to evaluate expression with parentheses
    function evaluateParentheses(expr) {
        // Find matching parentheses and evaluate subexpressions
        while (expr.includes('(')) {
            // Find the innermost parentheses
            let openIndex = -1;
            let closeIndex = -1;
            let parenCount = 0;
            
            for (let i = 0; i < expr.length; i++) {
                if (expr[i] === '(') {
                    if (parenCount === 0) {
                        openIndex = i;
                    }
                    parenCount++;
                } else if (expr[i] === ')') {
                    parenCount--;
                    if (parenCount === 0) {
                        closeIndex = i;
                        break;
                    }
                }
            }
            
            if (openIndex === -1 || closeIndex === -1) {
                throw new Error('Mismatched parentheses');
            }
            
            // Extract and evaluate the subexpression
            const subExpr = expr.substring(openIndex + 1, closeIndex);
            const subResult = evaluateParentheses(subExpr);
            
            // Replace the parentheses expression with its result
            expr = expr.substring(0, openIndex) + subResult + expr.substring(closeIndex + 1);
        }
        
        // Now evaluate the expression without parentheses
        // Process operators in order of precedence:
        // 1. Power (^) - right associative, higher precedence than * and /
        // 2. Multiplication and division (*, /) - left associative
        // 3. Addition and subtraction (+, -) - left associative
        
        // First, handle power operator (right associative)
        function evaluatePowers(expr) {
            // Find all ^ operators and evaluate them right-to-left
            while (expr.includes('^')) {
                // Find the rightmost ^ operator
                let powerIndex = -1;
                for (let i = expr.length - 1; i >= 0; i--) {
                    if (expr[i] === '^') {
                        powerIndex = i;
                        break;
                    }
                }
                
                if (powerIndex === -1) break;
                
                // Find the left operand (number or expression in parentheses)
                let leftStart = powerIndex - 1;
                while (leftStart >= 0 && (/\d|\./.test(expr[leftStart]) || expr[leftStart] === ')')) {
                    if (expr[leftStart] === ')') {
                        // Skip matching parentheses
                        let parenCount = 1;
                        leftStart--;
                        while (parenCount > 0 && leftStart >= 0) {
                            if (expr[leftStart] === ')') parenCount++;
                            else if (expr[leftStart] === '(') parenCount--;
                            leftStart--;
                        }
                    } else {
                        leftStart--;
                    }
                }
                leftStart++;
                
                // Find the right operand (number or expression in parentheses)
                let rightEnd = powerIndex + 1;
                while (rightEnd < expr.length && (/\d|\./.test(expr[rightEnd]) || expr[rightEnd] === '(')) {
                    if (expr[rightEnd] === '(') {
                        // Skip matching parentheses
                        let parenCount = 1;
                        rightEnd++;
                        while (parenCount > 0 && rightEnd < expr.length) {
                            if (expr[rightEnd] === '(') parenCount++;
                            else if (expr[rightEnd] === ')') parenCount--;
                            rightEnd++;
                        }
                    } else {
                        rightEnd++;
                    }
                }
                
                // Extract operands
                const leftOperand = expr.substring(leftStart, powerIndex);
                const rightOperand = expr.substring(powerIndex + 1, rightEnd);
                
                // Evaluate the power operation
                const leftNum = parseFloat(leftOperand);
                const rightNum = parseFloat(rightOperand);
                const result = Math.pow(leftNum, rightNum);
                
                // Replace the power expression with the result
                expr = expr.substring(0, leftStart) + result + expr.substring(rightEnd);
            }
            
            return expr;
        }
        
        // Handle power operator first (right-associative)
        expr = evaluatePowers(expr);
        
        // Second pass: handle multiplication and division (left associative)
        let result = 0;
        let currentNumber = '';
        let operator = '+';
        
        for (let i = 0; i <= expr.length; i++) {
            const char = expr[i];
            
            if (i < expr.length && /\d|\./.test(char)) {
                currentNumber += char;
            } else {
                // Process the number with the previous operator
                if (currentNumber !== '') {
                    const num = parseFloat(currentNumber);
                    
                    if (operator === '+') {
                        result += num;
                    } else if (operator === '-') {
                        result -= num;
                    } else if (operator === '*') {
                        result *= num;
                    } else if (operator === '/') {
                        if (num === 0) {
                            throw new Error('Division by zero');
                        }
                        result /= num;
                    }
                    
                    currentNumber = '';
                }
                
                // Set the new operator
                if (i < expr.length) {
                    operator = char;
                }
            }
        }
        
        return result;
    }
    
    return evaluateParentheses(expr);
}

// Test cases
console.log('Testing basic operations...');
console.log(evaluate('2 + 3')); // Should be 5
console.log(evaluate('10 - 4')); // Should be 6
console.log(evaluate('3 * 4')); // Should be 12
console.log(evaluate('15 / 3')); // Should be 5

// Test precedence
console.log(evaluate('2 + 3 * 4')); // Should be 14 (3*4=12, then 2+12=14)
console.log(evaluate('10 - 6 / 2')); // Should be 7 (6/2=3, then 10-3=7)

// Test left-to-right evaluation for same precedence
console.log(evaluate('8 / 2 * 3')); // Should be 12 (8/2=4, then 4*3=12)
console.log(evaluate('10 - 2 - 3')); // Should be 5 (10-2=8, then 8-3=5)

// Test with decimals
console.log(evaluate('3.5 + 2.1')); // Should be 5.6
console.log(evaluate('7.5 / 2.5')); // Should be 3

// Test error cases
try {
    evaluate('5 / 0');
    console.log('ERROR: Should have thrown division by zero');
} catch (e) {
    console.log('Correctly caught division by zero error');
}

try {
    evaluate('');
    console.log('ERROR: Should have thrown empty expression error');
} catch (e) {
    console.log('Correctly caught empty expression error');
}

// Test the specific cases from the goal
console.log('Testing specific cases from goal...');
console.log('-(2+3)*2 =', evaluate('-(2+3)*2')); // Should be -10
console.log('2*-3 =', evaluate('2*-3')); // Should be -6
console.log('2^3^2 =', evaluate('2^3^2')); // Should be 512 (2^(3^2) = 2^9)
console.log('-2^2 =', evaluate('-2^2')); // Should be -4 (-(2^2))

console.log('Basic tests completed');

// Export the evaluate function
module.exports = { evaluate };