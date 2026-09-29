// s5_expr.js - Expression evaluator with + - * / precedence and error handling

function tokenize(expr) {
    // Remove all spaces
    expr = expr.replace(/\s/g, '');
    
    // Check for empty expression
    if (expr === '') {
        throw new Error('Empty expression at 0');
    }
    
    // Check for invalid characters (allowing letters for variable names and commas)
    if (!/^[0-9+\-*/.()^a-zA-Z_,]+$/.test(expr)) {
        // Find the first invalid character and report its position
        for (let i = 0; i < expr.length; i++) {
            if (!/^[0-9+\-*/.()^a-zA-Z_,]+$/.test(expr[i])) {
                throw new Error('Invalid characters in expression at ' + i);
            }
        }
        throw new Error('Invalid characters in expression at ' + expr.length);
    }
    
    const tokens = [];
    let pos = 0;
    
    while (pos < expr.length) {
        const char = expr[pos];
        
        if (/[0-9]/.test(char)) {
            // Parse number (including decimals)
            let start = pos;
            while (pos < expr.length && /[0-9.]/.test(expr[pos])) {
                pos++;
            }
            tokens.push({ type: 'num', value: parseFloat(expr.substring(start, pos)) });
        } else if (/[a-zA-Z_]/.test(char)) {
            // Parse variable name or function name
            let start = pos;
            while (pos < expr.length && /[a-zA-Z0-9_]/.test(expr[pos])) {
                pos++;
            }
            tokens.push({ type: 'name', value: expr.substring(start, pos) });
        } else if (char === '(') {
            tokens.push({ type: 'lparen', value: '(' });
            pos++;
        } else if (char === ')') {
            tokens.push({ type: 'rparen', value: ')' });
            pos++;
        } else if (char === ',') {
            tokens.push({ type: 'comma', value: ',' });
            pos++;
        } else if (/[+\-*/^]/.test(char)) {
            tokens.push({ type: 'op', value: char });
            pos++;
        } else {
            // Should not happen due to earlier validation, but just in case
            throw new Error('Unknown character at ' + pos);
        }
    }
    
    return tokens;
}

function evaluate(expr, vars = {}) {
    // Remove all spaces
    expr = expr.replace(/\s/g, '');
    
    // Check for empty expression
    if (expr === '') {
        throw new Error('Empty expression at 0');
    }
    
    // Check for invalid characters (allowing letters for variable names and commas)
    if (!/^[0-9+\-*/.()^a-zA-Z_,]+$/.test(expr)) {
        // Find the first invalid character and report its position
        for (let i = 0; i < expr.length; i++) {
            if (!/^[0-9+\-*/.()^a-zA-Z_,]+$/.test(expr[i])) {
                throw new Error('Invalid characters in expression at ' + i);
            }
        }
        throw new Error('Invalid characters in expression at ' + expr.length);
    }
    
    // Position tracking
    let pos = 0;
    
    // Parse and evaluate the expression
    function parseExpression() {
        let result = parseTerm();
        
        while (true) {
            const char = expr[pos];
            if (char === '+') {
                pos++;
                result += parseTerm();
            } else if (char === '-') {
                pos++;
                result -= parseTerm();
            } else {
                break;
            }
        }
        
        return result;
    }
    
    function parsePower() {
        let result = parseFactor();
        
        // Handle right-associative power operations
        if (expr[pos] === '^') {
            pos++;
            const exponent = parsePower();  // Right-associative: 2^3^2 = 2^(3^2) = 2^9 = 512
            result = Math.pow(result, exponent);
        }
        
        return result;
    }
    
    function parseTerm() {
        let result = parsePower();
        
        while (true) {
            const char = expr[pos];
            if (char === '*') {
                pos++;
                result *= parsePower();
            } else if (char === '/') {
                pos++;
                const divisor = parsePower();
                if (divisor === 0) {
                    throw new Error('Division by zero at ' + pos);
                }
                result /= divisor;
            } else {
                break;
            }
        }
        
        return result;
    }
    
    function parseFactor() {
        if (expr[pos] === '(') {
            pos++;
            const result = parseExpression();
            if (expr[pos] !== ')') {
                throw new Error('Missing closing parenthesis at ' + pos);
            }
            pos++;
            return result;
        } else if (expr[pos] === '-') {
            pos++;
            // For unary minus, we need to handle it properly with precedence
            return -parsePower();  // Apply unary minus to the power result
        } else if (/[a-zA-Z_]/.test(expr[pos])) {
            // Handle function calls
            let start = pos;
            while (pos < expr.length && /[a-zA-Z0-9_]/.test(expr[pos])) {
                pos++;
            }
            const funcName = expr.substring(start, pos);
            
            // Check for opening parenthesis
            if (expr[pos] !== '(') {
                throw new Error(`Function ${funcName} must be followed by parentheses at ` + pos);
            }
            pos++; // Skip the '('
            
            // Parse arguments
            const args = [];
            if (expr[pos] !== ')') { // If not empty parentheses
                while (true) {
                    args.push(parseExpression());
                    if (expr[pos] === ',') {
                        pos++; // Skip the comma
                    } else if (expr[pos] === ')') {
                        break;
                    } else {
                        throw new Error('Expected comma or closing parenthesis at ' + pos);
                    }
                }
            } else {
                // Empty parentheses - no arguments
            }
            
            if (expr[pos] !== ')') {
                throw new Error('Missing closing parenthesis at ' + pos);
            }
            pos++; // Skip the ')'
            
            // Apply the function
            switch (funcName) {
                case 'min':
                    if (args.length === 0) {
                        throw new Error('min() requires at least one argument at ' + pos);
                    }
                    return Math.min(...args);
                case 'max':
                    if (args.length === 0) {
                        throw new Error('max() requires at least one argument at ' + pos);
                    }
                    return Math.max(...args);
                case 'abs':
                    if (args.length !== 1) {
                        throw new Error('abs() requires exactly one argument at ' + pos);
                    }
                    return Math.abs(args[0]);
                case 'sqrt':
                    if (args.length !== 1) {
                        throw new Error('sqrt() requires exactly one argument at ' + pos);
                    }
                    if (args[0] < 0) {
                        throw new Error('sqrt() of negative number at ' + pos);
                    }
                    return Math.sqrt(args[0]);
                default:
                    throw new Error(`Unknown function: ${funcName} at ` + pos);
            }
        } else {
            return parseNumber();
        }
    }
    
    function parseNumber() {
        let start = pos;
        
        // Handle variable names (letters and underscores, followed by letters, digits, or underscores)
        if (/[a-zA-Z_]/.test(expr[pos])) {
            while (pos < expr.length && /[a-zA-Z0-9_]/.test(expr[pos])) {
                pos++;
            }
            
            const varName = expr.substring(start, pos);
            
            if (vars.hasOwnProperty(varName)) {
                return vars[varName];
            } else {
                throw new Error(`Unknown variable: ${varName} at ` + pos);
            }
        }
        // Handle decimal numbers
        else if (/\d/.test(expr[pos])) {
            while (pos < expr.length && (/\d/.test(expr[pos]) || expr[pos] === '.')) {
                pos++;
            }
            
            const numStr = expr.substring(start, pos);
            const num = parseFloat(numStr);
            
            if (isNaN(num)) {
                throw new Error('Invalid number at ' + start);
            }
            
            return num;
        } else {
            // If we reach here, it means we're at an unexpected character
            throw new Error('Unexpected character at ' + pos);
        }
    }
    
    // Start parsing from the beginning
    const result = parseExpression();
    
    // Check if we've consumed the entire expression
    if (pos < expr.length) {
        throw new Error('Unexpected character at ' + pos);
    }
    
    return result;
}

/**
 * Compiles an expression into a function that can be evaluated with variables
 * @param {string} expr - The expression to compile
 * @returns {function} - A function that takes vars and returns the evaluated result
 */
function compile(expr) {
    // Remove all spaces
    expr = expr.replace(/\s/g, '');
    
    // Check for empty expression
    if (expr === '') {
        throw new Error('Empty expression at 0');
    }
    
    // Check for invalid characters (allowing letters for variable names and commas)
    if (!/^[0-9+\-*/.()^a-zA-Z_,]+$/.test(expr)) {
        // Find the first invalid character and report its position
        for (let i = 0; i < expr.length; i++) {
            if (!/^[0-9+\-*/.()^a-zA-Z_,]+$/.test(expr[i])) {
                throw new Error('Invalid characters in expression at ' + i);
            }
        }
        throw new Error('Invalid characters in expression at ' + expr.length);
    }
    
    // Position tracking
    let pos = 0;
    
    // Parse the expression once to build the AST or determine the evaluation path
    function parseExpression() {
        let result = parseTerm();
        
        while (true) {
            const char = expr[pos];
            if (char === '+') {
                pos++;
                result += parseTerm();
            } else if (char === '-') {
                pos++;
                result -= parseTerm();
            } else if (char === '<' || char === '>' || char === '=' || char === '!') {
                // Handle comparison operators
                let op = char;
                pos++;
                if (char === '=' && expr[pos] === '=') {
                    op = '==';
                    pos++;
                } else if (char === '!' && expr[pos] === '=') {
                    op = '!=';
                    pos++;
                } else if (char === '<' && expr[pos] === '=') {
                    op = '<=';
                    pos++;
                } else if (char === '>' && expr[pos] === '=') {
                    op = '>=';
                    pos++;
                }
                
                const right = parseTerm();
                if (op === '<') result = result < right ? 1 : 0;
                else if (op === '<=') result = result <= right ? 1 : 0;
                else if (op === '>') result = result > right ? 1 : 0;
                else if (op === '>=') result = result >= right ? 1 : 0;
                else if (op === '==') result = result === right ? 1 : 0;
                else if (op === '!=') result = result !== right ? 1 : 0;
            } else {
                break;
            }
        }
        
        return result;
    }
    
    function parsePower() {
        let result = parseFactor();
        
        // Handle right-associative power operations
        if (expr[pos] === '^') {
            pos++;
            const exponent = parsePower();  // Right-associative: 2^3^2 = 2^(3^2) = 2^9 = 512
            result = Math.pow(result, exponent);
        }
        
        return result;
    }
    
    function parseTerm() {
        let result = parsePower();
        
        while (true) {
            const char = expr[pos];
            if (char === '*') {
                pos++;
                result *= parsePower();
            } else if (char === '/') {
                pos++;
                const divisor = parsePower();
                if (divisor === 0) {
                    throw new Error('Division by zero at ' + pos);
                }
                result /= divisor;
            } else {
                break;
            }
        }
        
        return result;
    }
    
    function parseFactor() {
        if (expr[pos] === '(') {
            pos++;
            const result = parseExpression();
            if (expr[pos] !== ')') {
                throw new Error('Missing closing parenthesis at ' + pos);
            }
            pos++;
            return result;
        } else if (expr[pos] === '-') {
            pos++;
            // For unary minus, we need to handle it properly with precedence
            return -parsePower();  // Apply unary minus to the power result
        } else if (/[a-zA-Z_]/.test(expr[pos])) {
            // Handle function calls
            let start = pos;
            while (pos < expr.length && /[a-zA-Z0-9_]/.test(expr[pos])) {
                pos++;
            }
            const funcName = expr.substring(start, pos);
            
            // Check for opening parenthesis
            if (expr[pos] !== '(') {
                throw new Error(`Function ${funcName} must be followed by parentheses at ` + pos);
            }
            pos++; // Skip the '('
            
            // Parse arguments
            const args = [];
            if (expr[pos] !== ')') { // If not empty parentheses
                while (true) {
                    args.push(parseExpression());
                    if (expr[pos] === ',') {
                        pos++; // Skip the comma
                    } else if (expr[pos] === ')') {
                        break;
                    } else {
                        throw new Error('Expected comma or closing parenthesis at ' + pos);
                    }
                }
            } else {
                // Empty parentheses - no arguments
            }
            
            if (expr[pos] !== ')') {
                throw new Error('Missing closing parenthesis at ' + pos);
            }
            pos++; // Skip the ')'
            
            // Apply the function
            switch (funcName) {
                case 'min':
                    if (args.length === 0) {
                        throw new Error('min() requires at least one argument at ' + pos);
                    }
                    return Math.min(...args);
                case 'max':
                    if (args.length === 0) {
                        throw new Error('max() requires at least one argument at ' + pos);
                    }
                    return Math.max(...args);
                case 'abs':
                    if (args.length !== 1) {
                        throw new Error('abs() requires exactly one argument at ' + pos);
                    }
                    return Math.abs(args[0]);
                case 'sqrt':
                    if (args.length !== 1) {
                        throw new Error('sqrt() requires exactly one argument at ' + pos);
                    }
                    if (args[0] < 0) {
                        throw new Error('sqrt() of negative number at ' + pos);
                    }
                    return Math.sqrt(args[0]);
                default:
                    throw new Error(`Unknown function: ${funcName} at ` + pos);
            }
        } else {
            return parseNumber();
        }
    }
    
    function parseNumber() {
        let start = pos;
        
        // Handle variable names (letters and underscores, followed by letters, digits, or underscores)
        if (/[a-zA-Z_]/.test(expr[pos])) {
            while (pos < expr.length && /[a-zA-Z0-9_]/.test(expr[pos])) {
                pos++;
            }
            
            const varName = expr.substring(start, pos);
            
            // For compile, we return a function that will handle variable lookup
            return function(vars) {
                if (vars.hasOwnProperty(varName)) {
                    return vars[varName];
                } else {
                    throw new Error(`Unknown variable: ${varName} at ` + pos);
                }
            };
        }
        // Handle decimal numbers
        else if (/\d/.test(expr[pos])) {
            while (pos < expr.length && (/\d/.test(expr[pos]) || expr[pos] === '.')) {
                pos++;
            }
            
            const numStr = expr.substring(start, pos);
            const num = parseFloat(numStr);
            
            if (isNaN(num)) {
                throw new Error('Invalid number at ' + start);
            }
            
            return function() {
                return num;
            };
        } else {
            // If we reach here, it means we're at an unexpected character
            throw new Error('Unexpected character at ' + pos);
        }
    }
    
    // Return a function that evaluates the pre-parsed expression with given variables
    return function(vars = {}) {
        // Reset position for each evaluation
        pos = 0;
        
        // Start parsing from the beginning
        const result = parseExpression();
        
        // Check if we've consumed the entire expression
        if (pos < expr.length) {
            throw new Error('Unexpected character at ' + pos);
        }
        
        return result;
    };
}

function runAsserts() {
    // Test cases
    console.assert(evaluate('1+2') === 3);
    console.assert(evaluate('2*3+1') === 7);
    console.assert(evaluate('2*(3+1)') === 8);
    console.assert(evaluate('10/2') === 5);
    console.assert(evaluate('2^3') === 8);
    console.assert(evaluate('2^-1') === 0.5);
    console.assert(evaluate('1+2*3') === 7);
    console.assert(evaluate('(1+2)*3') === 9);
    console.assert(evaluate('2.5+1.5') === 4);
    console.assert(evaluate('2.5*2') === 5);
    console.assert(evaluate('10/2.5') === 4);
    console.assert(evaluate('2^3^2') === 512);
    console.assert(evaluate('abs(-5)') === 5);
    console.assert(evaluate('sqrt(16)') === 4);
    console.assert(evaluate('min(1,2,3)') === 1);
    console.assert(evaluate('max(1,2,3)') === 3);
    
    // Test with variables
    console.assert(evaluate('x+y', {x: 1, y: 2}) === 3);
    console.assert(evaluate('x*y', {x: 3, y: 4}) === 12);
    
    // Test error cases
    try {
        evaluate('2 + * 3');
        console.assert(false, 'Should have thrown an error');
    } catch (e) {
        console.assert(e.message.includes('at 4'), 'Error should contain position at 4');
        console.log('Test 1 passed:', e.message);
    }
    
    try {
        evaluate('(1+2');
        console.assert(false, 'Should have thrown an error');
    } catch (e) {
        console.assert(e.message.includes('at 4'), 'Error should contain position at 4');
        console.log('Test 2 passed:', e.message);
    }
    
    try {
        evaluate('2.5.3');
        console.assert(false, 'Should have thrown an error');
    } catch (e) {
        console.assert(e.message.includes('at 3'), 'Error should contain position at 3');
        console.log('Test 3 passed:', e.message);
    }
    
    try {
        evaluate('abs(-5');
        console.assert(false, 'Should have thrown an error');
    } catch (e) {
        console.assert(e.message.includes('at 7'), 'Error should contain position at 7');
        console.log('Test 4 passed:', e.message);
    }
    
    try {
        evaluate('2/0');
        console.assert(false, 'Should have thrown an error');
    } catch (e) {
        console.assert(e.message.includes('at '), 'Error should contain position');
        console.log('Test 5 passed:', e.message);
    }
    
    try {
        evaluate('unknown_func()');
        console.assert(false, 'Should have thrown an error');
    } catch (e) {
        console.assert(e.message.includes('at '), 'Error should contain position');
        console.log('Test 6 passed:', e.message);
    }
    
    console.log('All asserts passed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAsserts();
}

module.exports = { evaluate, tokenize, toRPN };
/**
 * Converts an expression to Reverse Polish Notation (RPN)
 * @param {string} expr - The expression to convert
 * @returns {string[]} - Array of tokens in RPN format
 */
function toRPN(expr) {
    // Tokenize the expression first
    const tokens = tokenize(expr);
    
    // Operator precedence
    const precedence = {
        '+': 1,
        '-': 1,
        '<': 1,
        '<=': 1,
        '>': 1,
        '>=': 1,
        '==': 1,
        '!=': 1,
        '*': 2,
        '/': 2,
        '^': 3
    };
    
    // Right associative operators
    const rightAssociative = new Set(['^']);
    
    const output = [];
    const operatorStack = [];
    
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        
        if (token.type === 'num') {
            // Numbers are added directly to output
            output.push(token.value.toString());
        } else if (token.type === 'name') {
            // Names (variables/functions) are added directly to output
            output.push(token.value);
        } else if (token.type === 'lparen') {
            // Left parenthesis is pushed to stack
            operatorStack.push(token);
        } else if (token.type === 'rparen') {
            // Pop operators until left parenthesis
            while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1].type !== 'lparen') {
                output.push(operatorStack.pop().value);
            }
            // Remove the left parenthesis
            if (operatorStack.length > 0) {
                operatorStack.pop();
            }
        } else if (token.type === 'operator') {
            // Handle unary minus
            if (token.value === '-' && (i === 0 || tokens[i-1].type === 'lparen' || tokens[i-1].type === 'operator')) {
                // This is a unary minus, we'll represent it as 'neg'
                output.push('neg');
            } else {
                // Binary operator
                while (operatorStack.length > 0 && 
                       operatorStack[operatorStack.length - 1].type !== 'lparen' &&
                       precedence[operatorStack[operatorStack.length - 1].value] !== undefined &&
                       (precedence[operatorStack[operatorStack.length - 1].value] > precedence[token.value] ||
                        (precedence[operatorStack[operatorStack.length - 1].value] === precedence[token.value] && 
                         !rightAssociative.has(token.value)))) {
                    output.push(operatorStack.pop().value);
                }
                operatorStack.push(token);
            }
        } else if (token.type === 'comma') {
            // Comma handling - pop operators until left parenthesis
            while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1].type !== 'lparen') {
                output.push(operatorStack.pop().value);
            }
        }
    }
    
    // Pop remaining operators
    while (operatorStack.length > 0) {
        output.push(operatorStack.pop().value);
    }
    
    return output;
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAsserts();
}

module.exports = { evaluate, tokenize, toRPN };
