// s5_expr.js - Expression evaluator with + - * / and ^ operations

function evaluate(expr, vars = {}) {
    // Remove all spaces
    expr = expr.replace(/\s/g, '');
    
    // Check for empty expression
    if (expr === '') {
        throw new Error('Empty expression');
    }
    
    // Check for invalid characters - allow numbers, +, -, *, /, ^, ., (, ), and variable names
    if (!/^[0-9+\-*/^.()A-Za-z_][0-9+\-*/^.()A-Za-z_]*$/.test(expr)) {
        throw new Error('Invalid characters in expression');
    }
    
    // Handle division by zero
    if (expr.match(/\/0(?:\.0*)?/)) {
        throw new Error('Division by zero');
    }
    
    // Check for function calls
    const functionMatch = expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)$/);
    if (functionMatch) {
        const funcName = functionMatch[1];
        const argsStr = functionMatch[2];
        
        // Handle specific functions
        if (funcName === 'min' || funcName === 'max' || funcName === 'abs' || funcName === 'sqrt') {
            // Parse arguments
            let args = [];
            if (argsStr !== '') {
                // Split arguments by comma, but be careful with nested parentheses
                let parenCount = 0;
                let argStart = 0;
                for (let i = 0; i <= argsStr.length; i++) {
                    if (i < argsStr.length) {
                        if (argsStr[i] === '(') {
                            parenCount++;
                        } else if (argsStr[i] === ')') {
                            parenCount--;
                        } else if (argsStr[i] === ',' && parenCount === 0) {
                            args.push(argsStr.substring(argStart, i).trim());
                            argStart = i + 1;
                        }
                    } else {
                        // End of string
                        args.push(argsStr.substring(argStart, i).trim());
                    }
                }
            }
            
            // Validate arguments based on function
            if (funcName === 'abs' || funcName === 'sqrt') {
                if (args.length !== 1) {
                    throw new Error(funcName + ' expects exactly one argument');
                }
            } else if (funcName === 'min' || funcName === 'max') {
                if (args.length < 1) {
                    throw new Error(funcName + ' expects at least one argument');
                }
            }
            
            // Evaluate arguments
            const evaluatedArgs = args.map(arg => {
                // For nested function calls or expressions, recursively evaluate
                return evaluate(arg, vars);
            });
            
            // Apply function
            if (funcName === 'abs') {
                return Math.abs(evaluatedArgs[0]);
            } else if (funcName === 'sqrt') {
                if (evaluatedArgs[0] < 0) {
                    throw new Error('sqrt of negative number');
                }
                return Math.sqrt(evaluatedArgs[0]);
            } else if (funcName === 'min') {
                return Math.min(...evaluatedArgs);
            } else if (funcName === 'max') {
                return Math.max(...evaluatedArgs);
            }
        } else {
            // Unknown function
            throw new Error('Unknown function: ' + funcName);
        }
    }
    
    // Parse and evaluate expression with proper precedence
    try {
        // Tokenize the expression
        const tokens = tokenize(expr);
        // Parse and evaluate
        const result = parseExpression(tokens, 0, vars);
        
        if (typeof result !== 'number' || isNaN(result)) {
            throw new Error('Invalid expression');
        }
        
        return result;
    } catch (e) {
        throw new Error('Invalid expression');
    }
}

// Convert infix expression to Reverse Polish Notation (RPN)
function toRPN(expr) {
    // Remove all spaces
    expr = expr.replace(/\s/g, '');
    
    // Tokenize the expression
    const tokens = tokenize(expr);
    
    // Shunting Yard Algorithm
    const output = [];
    const operatorStack = [];
    
    // Operator precedence
    const precedence = {
        '+': 1,
        '-': 1,
        '*': 2,
        '/': 2,
        '^': 3
    };
    
    // Right associative operators
    const rightAssociative = {
        '^': true
    };
    
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        
        if (token.type === 'num') {
            // Numbers go directly to output
            output.push(token.value.toString());
        } else if (token.type === 'name') {
            // Variable names go directly to output
            output.push(token.value);
        } else if (token.type === 'op') {
            // Handle unary minus
            if (token.value === '-' && (i === 0 || tokens[i-1].type === 'lparen' || tokens[i-1].type === 'op' || tokens[i-1].type === 'comma')) {
                // This is a unary minus, treat it as 'neg'
                operatorStack.push('neg');
            } else {
                // Binary operator
                while (operatorStack.length > 0 && 
                       operatorStack[operatorStack.length - 1] !== 'lparen' &&
                       (precedence[operatorStack[operatorStack.length - 1]] > precedence[token.value] ||
                        (precedence[operatorStack[operatorStack.length - 1]] === precedence[token.value] && 
                         !rightAssociative[token.value]))) {
                    output.push(operatorStack.pop());
                }
                operatorStack.push(token.value);
            }
        } else if (token.type === 'lparen') {
            operatorStack.push(token.value);
        } else if (token.type === 'rparen') {
            while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== 'lparen') {
                output.push(operatorStack.pop());
            }
            if (operatorStack.length === 0) {
                throw new Error('Mismatched parentheses');
            }
            operatorStack.pop(); // Remove the lparen
        } else if (token.type === 'comma') {
            while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== 'lparen') {
                output.push(operatorStack.pop());
            }
        }
    }
    
    // Pop remaining operators
    while (operatorStack.length > 0) {
        const op = operatorStack.pop();
        if (op === 'lparen' || op === 'rparen') {
            throw new Error('Mismatched parentheses');
        }
        output.push(op);
    }
    
    return output;
}

// Tokenizer function
function tokenize(expr) {
    const tokens = [];
    let i = 0;
    
    while (i < expr.length) {
        const char = expr[i];
        
        if (/\d/.test(char)) {
            // Parse number (including decimals)
            let num = '';
            while (i < expr.length && (/\d/.test(expr[i]) || expr[i] === '.')) {
                num += expr[i];
                i++;
            }
            tokens.push({ type: 'num', value: parseFloat(num) });
            continue;
        }
        
        if (/[A-Za-z_]/.test(char)) {
            // Parse variable name
            let varName = '';
            while (i < expr.length && /[A-Za-z0-9_]/.test(expr[i])) {
                varName += expr[i];
                i++;
            }
            tokens.push({ type: 'name', value: varName });
            continue;
        }
        
        if (char === '(') {
            tokens.push({ type: 'lparen', value: char });
        } else if (char === ')') {
            tokens.push({ type: 'rparen', value: char });
        } else if (char === ',') {
            tokens.push({ type: 'comma', value: char });
        } else if (char === '+' || char === '-' || char === '*' || char === '/' || char === '^') {
            tokens.push({ type: 'op', value: char });
        } else if (char === ' ') {
            // Skip whitespace
            i++;
            continue;
        } else {
            throw new Error('Invalid character: ' + char + ' at ' + i);
        }
        
        i++;
    }
    
    return tokens;
}

// Recursive descent parser with precedence
// Expression: Addition and subtraction (lowest precedence)
function parseExpression(tokens, pos, vars) {
    // Parse left operand
    let left = parseTerm(tokens, pos, vars);
    pos = parseTerm.pos; // Update pos from the last parsed term
    
    // Look for operators
    while (pos < tokens.length && (tokens[pos].type === '+' || tokens[pos].type === '-')) {
        const op = tokens[pos].type;
        pos++;
        const right = parseTerm(tokens, pos, vars);
        pos = parseTerm.pos; // Update pos from the last parsed term
        if (op === '+') {
            left = left + right;
        } else {
            left = left - right;
        }
    }
    
    parseExpression.pos = pos;
    return left;
}

// Term: Multiplication and division
function parseTerm(tokens, pos, vars) {
    let left = parsePower(tokens, pos, vars);
    pos = parsePower.pos; // Update pos from the last parsed term
    
    // Look for operators
    while (pos < tokens.length && (tokens[pos].type === '*' || tokens[pos].type === '/')) {
        const op = tokens[pos].type;
        pos++;
        const right = parsePower(tokens, pos, vars);
        pos = parsePower.pos; // Update pos from the last parsed term
        if (op === '*') {
            left = left * right;
        } else {
            left = left / right;
        }
    }
    
    parseTerm.pos = pos;
    return left;
}

// Power: Exponentiation (highest precedence, right associative)
function parsePower(tokens, pos, vars) {
    let left = parseFactor(tokens, pos, vars);
    pos = parseFactor.pos; // Update pos from the last parsed factor
    
    // Look for power operator
    if (pos < tokens.length && tokens[pos].type === '^') {
        pos++;
        // For right associativity, we parse the right side with HIGHER precedence
        const right = parsePower(tokens, pos, vars);
        pos = parsePower.pos; // Update pos from the last parsed power
        left = Math.pow(left, right);
    }
    
    parsePower.pos = pos;
    return left;
}

// Parse factors (numbers, parentheses, unary minus, variables)
function parseFactor(tokens, pos, vars) {
    if (pos >= tokens.length) {
        throw new Error('Unexpected end of expression');
    }
    
    const token = tokens[pos];
    
    if (token.type === 'number') {
        parseFactor.pos = pos + 1;
        return token.value;
    }
    
    if (token.type === 'variable') {
        if (vars.hasOwnProperty(token.value)) {
            parseFactor.pos = pos + 1;
            return vars[token.value];
        } else {
            throw new Error('Unknown variable: ' + token.value);
        }
    }
    
    if (token.type === '(') {
        // Find matching closing parenthesis
        let parenCount = 1;
        let i = pos + 1;
        while (i < tokens.length && parenCount > 0) {
            if (tokens[i].type === '(') {
                parenCount++;
            } else if (tokens[i].type === ')') {
                parenCount--;
            }
            i++;
        }
        
        if (parenCount !== 0) {
            throw new Error('Mismatched parentheses');
        }
        
        // Parse the expression inside parentheses
        const exprResult = parseExpression(tokens, pos + 1, vars);
        parseFactor.pos = i; // Skip past the closing parenthesis
        return exprResult;
    }
    
    if (token.type === '-') {
        // Handle unary minus
        pos++;
        const factor = parseFactor(tokens, pos, vars);
        parseFactor.pos = parseFactor.pos; // Update pos from the last parsed factor
        return -factor;
    }
    
    throw new Error('Unexpected token: ' + token.type);
}

// Export the function
module.exports = { evaluate };

// Asserts
try {
    console.assert(evaluate("2 + 3") === 5, "2 + 3 should equal 5");
} catch(e) {
    throw new Error("Assertion failed: " + e.message);
}

try {
    console.assert(evaluate("10 - 4") === 6, "10 - 4 should equal 6");
} catch(e) {
    throw new Error("Assertion failed: " + e.message);
}

try {
    console.assert(evaluate("3 * 7") === 21, "3 * 7 should equal 21");
} catch(e) {
    throw new Error("Assertion failed: " + e.message);
}

try {
    console.assert(evaluate("15 / 3") === 5, "15 / 3 should equal 5");
} catch(e) {
    throw new Error("Assertion failed: " + e.message);
}

try {
    console.assert(evaluate("2 + 3 * 4") === 14, "2 + 3 * 4 should equal 14 (precedence)");
} catch(e) {
    throw new Error("Assertion failed: " + e.message);
}

try {
    console.assert(evaluate("(2 + 3) * 4") === 20, "(2 + 3) * 4 should equal 20");
} catch(e) {
    throw new Error("Assertion failed: " + e.message);
}

try {
    console.assert(evaluate("10 - 6 / 2") === 7, "10 - 6 / 2 should equal 7 (precedence)");
} catch(e) {
    throw new Error("Assertion failed: " + e.message);
}

try {
    console.assert(evaluate("1.5 + 2.5") === 4, "1.5 + 2.5 should equal 4");
} catch(e) {
    throw new Error("Assertion failed: " + e.message);
}

try {
    console.assert(evaluate("7.2 / 1.2") === 6, "7.2 / 1.2 should equal 6");
} catch(e) {
    throw new Error("Assertion failed: " + e.message);
}

try {
    console.assert(evaluate("2 * 3 + 4 * 5") === 26, "2 * 3 + 4 * 5 should equal 26");
} catch(e) {
    throw new Error("Assertion failed: " + e.message);
}

// Test error cases
try {
    evaluate("5 / 0");
    throw new Error("Should have thrown error for division by zero");
} catch(e) {
    if (e.message !== 'Division by zero') {
        throw new Error("Should throw division by zero error");
    }
}

try {
    evaluate("2 + + 3");
    throw new Error("Should have thrown error for invalid expression");
} catch(e) {
    if (e.message !== 'Invalid expression') {
        throw new Error("Should throw invalid expression error");
    }
}

try {
    evaluate("2 + 3 *");
    throw new Error("Should have thrown error for invalid expression");
} catch(e) {
    if (e.message !== 'Invalid expression') {
        throw new Error("Should throw invalid expression error");
    }
}

try {
    evaluate("");
    throw new Error("Should have thrown error for empty expression");
} catch(e) {
    if (e.message !== 'Empty expression') {
        throw new Error("Should throw empty expression error");
    }
}

try {
    evaluate("2 + 3 & 4");
    throw new Error("Should have thrown error for invalid characters");
} catch(e) {
    if (e.message !== 'Invalid characters in expression') {
        throw new Error("Should throw invalid characters error");
    }
}

console.log("All asserts passed!");
// Test the new functions
try {
    console.assert(evaluate("min(1,2,3)") === 1, "min(1,2,3) should equal 1");
} catch(e) {
    throw new Error("Assertion failed: " + e.message);
}

try {
    console.assert(evaluate("max(1,2,3)") === 3, "max(1,2,3) should equal 3");
} catch(e) {
    throw new Error("Assertion failed: " + e.message);
}

try {
    console.assert(evaluate("abs(-5)") === 5, "abs(-5) should equal 5");
} catch(e) {
    throw new Error("Assertion failed: " + e.message);
}

try {
    console.assert(evaluate("sqrt(9)") === 3, "sqrt(9) should equal 3");
} catch(e) {
    throw new Error("Assertion failed: " + e.message);
}

// Test error cases for new functions
try {
    evaluate("abs()");
    throw new Error("Should have thrown error for abs with no arguments");
} catch(e) {
    if (e.message !== 'abs expects exactly one argument') {
        throw new Error("Should throw abs argument error");
    }
}

try {
    evaluate("sqrt(-4)");
    throw new Error("Should have thrown error for sqrt of negative number");
} catch(e) {
    if (e.message !== 'sqrt of negative number') {
        throw new Error("Should throw sqrt negative number error");
    }
}

try {
    evaluate("min()");
    throw new Error("Should have thrown error for min with no arguments");
} catch(e) {
    if (e.message !== 'min expects at least one argument') {
        throw new Error("Should throw min argument error");
    }
}

try {
    evaluate("unknown(1)");
    throw new Error("Should have thrown error for unknown function");
} catch(e) {
    if (e.message !== 'Unknown function: unknown') {
        throw new Error("Should throw unknown function error");
    }
}

try {
    evaluate("sqrt(4, 5)");
    throw new Error("Should have thrown error for sqrt with multiple arguments");
} catch(e) {
    if (e.message !== 'sqrt expects exactly one argument') {
        throw new Error("Should throw sqrt argument error");
    }
}

try {
    evaluate("max(1, 2, 3, 4, 5)");
    throw new Error("Should have thrown error for max with multiple arguments");
} catch(e) {
    if (e.message !== 'max expects at least one argument') {
        throw new Error("Should throw max argument error");
    }
}

console.log("All new function tests passed!");
