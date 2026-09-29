function evaluate(expr) {
    // Remove spaces
    expr = expr.replace(/\s+/g, '');

    // Tokenize the expression
    const tokens = [];
    let numberBuffer = '';
    for (let i = 0; i < expr.length; i++) {
        const char = expr[i];
        if (/\d|\./.test(char)) {
            numberBuffer += char;
        } else {
if (numberBuffer.length > 0) {
    tokens.push(parseFloat(numberBuffer));
    numberBuffer = '';
}
if (char === '-' && (i === 0 || !/\d|\./.test(expr[i - 1]))) {
    tokens.push('u-'); // Unary minus
} else {
    tokens.push(char);
}
        }
    }
    if (numberBuffer.length > 0) {
        tokens.push(parseFloat(numberBuffer));
    }

    // Helper function to apply an operator
    function applyOperator(operators, values) {
        const operator = operators.pop();
        const right = values.pop();
        const left = values.pop();
        switch (operator) {
    case 'u-':
        const value = values.pop();
        values.push(-value);
        break;
            case '+':
                values.push(left + right);
                break;
            case '-':
                values.push(left - right);
                break;
            case '*':
                values.push(left * right);
                break;
            case '/':
                if (right === 0) {
                    throw new Error('Division by zero');
                }
                values.push(left / right);
                break;
            default:
                throw new Error('Unknown operator: ' + operator);
        }
    }

    // Operator precedence
    const precedence = {
        '+': 1,
        '-': 1,
        '*': 2,
        '/': 2
    };

    const values = [];
    const operators = [];
for (const token of tokens) {
    if (typeof token === 'number') {
        values.push(token);
    } else if (token === '(') {
        operators.push(token);
    } else if (token === ')') {
        while (operators.length > 0 && operators[operators.length - 1] !== '(') {
            applyOperator(operators, values);
        }
        if (operators.length === 0 || operators.pop() !== '(') {
            throw new Error('Mismatched parentheses in expression: ' + expr);
        }
    } else if (token === '-' && (tokens.length === 0 || typeof tokens[tokens.length - 1] !== 'number')) {
    // Handle unary minus
    operators.push('u-');
} else if (token === '-' && (tokens.length === 0 || typeof tokens[tokens.length - 1] !== 'number')) {
    // Handle unary minus
    operators.push('u-');
} else if (token in precedence) {
        while (operators.length > 0 && precedence[operators[operators.length - 1]] >= precedence[token]) {
            applyOperator(operators, values);
        }
        operators.push(token);
    } else {
        throw new Error('Cannot parse expression: ' + expr);
    }
}

    while (operators.length > 0) {
        applyOperator(operators, values);
    }

    if (values.length !== 1) {
        throw new Error('Cannot parse expression: ' + expr);
    }

    return values[0];
}

module.exports = { evaluate };
const assert = require('assert');

// Test cases
assert.strictEqual(evaluate('1 + 2'), 3);
assert.strictEqual(evaluate('3 - 2'), 1);
assert.strictEqual(evaluate('2 * 3'), 6);
assert.strictEqual(evaluate('6 / 2'), 3);
assert.strictEqual(evaluate('1 + 2 * 3'), 7); // Test precedence
assert.strictEqual(evaluate('(1 + 2) * 3'), 9); // Test parentheses
assert.strictEqual(evaluate('1.5 + 2.5'), 4); // Test decimals
assert.strictEqual(evaluate('3.5 - 1.5'), 2);
assert.strictEqual(evaluate('2.5 * 4'), 10);
assert.strictEqual(evaluate('10 / 2.5'), 4);
assert.strictEqual(evaluate('1 + 2 * 3 / 4'), 2.5); // Test mixed operations
assert.strictEqual(evaluate('1 + (2 * 3) / 4'), 2.5); // Test mixed operations with parentheses
assert.strictEqual(evaluate('1 + 2 * (3 / 4)'), 2.5); // Test mixed operations with parentheses

console.log('All tests passed.');
