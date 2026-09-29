function evaluate(expr, vars = {}) {
    // Remove spaces from the expression
    expr = expr.replace(/\s+/g, '');

    // Helper function to check if a character is an operator
    function isOperator(c) {
        return ['+', '-', '*', '/'].includes(c);
    }

    // Helper function to get the precedence of an operator
    function precedence(op) {
        if (op === '+' || op === '-') return 1;
        if (op === '*' || op === '/') return 2;
        if (op === '^') return 3;
        return 0;
    }

    // Helper function to apply an operator to two operands
    function applyOp(a, b, op) {
        switch (op) {
            case '+': return a + b;
            case '-': return a - b;
            case '*': return a * b;
            case '/': 
                if (b === 0) throw new Error('Division by zero');
                return a / b;
            default: throw new Error('Invalid operator');
        }
    }

    // Shunting Yard algorithm to convert infix to postfix
    function infixToPostfix(expr) {
        const output = [];
        const operators = [];
        const tokens = expr.split('');

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            if (!isOperator(token) && token !== '(' && token !== ')') {
                output.push(parseFloat(token));
            } else if (token === '(') {
                operators.push(token);
            } else if (token === ')') {
                while (operators.length && operators[operators.length - 1] !== '(') {
                    output.push(operators.pop());
                }
                operators.pop(); // Remove the '('
            } else if (token === '-') {
                if (i === 0 || (i > 0 && (isOperator(tokens[i - 1]) || tokens[i - 1] === '('))) {
                    operators.push('u-');
                } else {
                    while (operators.length && precedence(operators[operators.length - 1]) >= precedence(token)) {
                        output.push(operators.pop());
                    }
                    operators.push(token);
                }
            } else {
                while (operators.length && precedence(operators[operators.length - 1]) >= precedence(token)) {
                    output.push(operators.pop());
                }
                operators.push(token);
            }
        }

        while (operators.length) {
            output.push(operators.pop());
        }

        return output;
    }

    // Evaluate the postfix expression
    function evaluatePostfix(postfix) {
        const stack = [];

        for (let i = 0; i < postfix.length; i++) {
            const token = postfix[i];

            if (typeof token === 'number') {
                stack.push(token);
            } else {
                const b = stack.pop();
                const a = stack.pop();
                const result = applyOp(a, b, token);
                stack.push(result);
            }
        }

        return stack.pop();
    }

    const postfix = infixToPostfix(expr);
    return evaluatePostfix(postfix);
}

module.exports = { evaluate };
function evaluate(expr, vars = {}) {
    // Remove spaces from the expression
    expr = expr.replace(/\s+/g, '');

    // Helper function to check if a character is an operator
    function isOperator(c) {
        return ['+', '-', '*', '/'].includes(c);
    }

    // Helper function to get the precedence of an operator
    function precedence(op) {
        if (op === '+' || op === '-') return 1;
        if (op === '*' || op === '/') return 2;
        if (op === '^') return 3;
        return 0;
    }

    // Helper function to apply an operator to two operands
    function applyOp(a, b, op) {
        switch (op) {
            case '+': return a + b;
            case '-': return a - b;
            case '*': return a * b;
            case '/': 
                if (b === 0) throw new Error('Division by zero');
                return a / b;
            default: throw new Error('Invalid operator');
        }
    }

    // Shunting Yard algorithm to convert infix to postfix
    function infixToPostfix(expr) {
        const output = [];
        const operators = [];
        const tokens = expr.split('');

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            if (!isOperator(token) && token !== '(' && token !== ')') {
                if (vars[token] !== undefined) {
                    output.push(vars[token]);
                } else {
                    throw new Error(`Unknown variable: ${token}`);
                }
            } else if (token === '(') {
                operators.push(token);
            } else if (token === ')') {
                while (operators.length && operators[operators.length - 1] !== '(') {
                    output.push(operators.pop());
                }
                operators.pop(); // Remove the '('
            } else if (token === '-') {
                if (i === 0 || (i > 0 && (isOperator(tokens[i - 1]) || tokens[i - 1] === '('))) {
                    operators.push('u-');
                } else {
                    while (operators.length && precedence(operators[operators.length - 1]) >= precedence(token)) {
                        output.push(operators.pop());
                    }
                    operators.push(token);
                }
            } else {
                while (operators.length && precedence(operators[operators.length - 1]) >= precedence(token)) {
                    output.push(operators.pop());
                }
                operators.push(token);
            }
        }

        while (operators.length) {
            output.push(operators.pop());
        }

        return output;
    }

    // Evaluate the postfix expression
    function evaluatePostfix(postfix) {
        const stack = [];

        for (let i = 0; i < postfix.length; i++) {
            const token = postfix[i];

            if (typeof token === 'number') {
                stack.push(token);
            } else {
                const b = stack.pop();
                const a = stack.pop();
                const result = applyOp(a, b, token);
                stack.push(result);
            }
        }

        return stack.pop();
    }

    const postfix = infixToPostfix(expr);
    return evaluatePostfix(postfix);
}

module.exports = { evaluate };
function tokenize(expr) {
    const tokens = [];
    let i = 0;
    const n = expr.length;

    while (i < n) {
        const char = expr[i];

        if (char === ' ') {
            i++;
            continue;
        }

        if (char >= '0' && char <= '9') {
            let value = '';
            while (i < n && (expr[i] >= '0' && expr[i] <= '9')) {
                value += expr[i];
                i++;
            }
            tokens.push({ type: 'num', value: parseFloat(value) });
            continue;
        }

        if ((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')) {
            let value = '';
            while (i < n && ((expr[i] >= 'a' && expr[i] <= 'z') || (expr[i] >= 'A' && expr[i] <= 'Z'))) {
                value += expr[i];
                i++;
            }
            tokens.push({ type: 'name', value });
            continue;
        }

        if ('+-*/()[]{}=,;'.includes(char)) {
            tokens.push({ type: 'op', value: char });
            i++;
            continue;
        }

        throw new Error(`Unknown character: ${char}`);
    }

    return tokens;
}
function toRPN(expr) {
    const output = [];
    const operators = [];
    const tokens = expr.split('');
    const functions = {};

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (!isOperator(token) && token !== '(' && token !== ')') {
            if (vars[token] !== undefined) {
                output.push(String(vars[token]));
            } else if (!isNaN(parseFloat(token))) {
                output.push(String(parseFloat(token)));
            } else {
                output.push(token);
            }
        } else if (token === '(') {
            operators.push(token);
        } else if (token === ')') {
            while (operators.length && operators[operators.length - 1] !== '(') {
                output.push(operators.pop());
            }
            operators.pop(); // Remove the '('
        } else if (token === '-') {
            if (i === 0 || (i > 0 && (isOperator(tokens[i - 1]) || tokens[i - 1] === '('))) {
                operators.push('neg');
            } else {
                while (operators.length && precedence(operators[operators.length - 1]) >= precedence(token)) {
                    output.push(operators.pop());
                }
                operators.push(token);
            }
        } else {
            while (operators.length && precedence(operators[operators.length - 1]) >= precedence(token)) {
                output.push(operators.pop());
            }
            operators.push(token);
        }
    }

    while (operators.length) {
        output.push(operators.pop());
    }

    return output;
}

module.exports = { evaluate, toRPN };
function compile(expr) {
    const postfix = infixToPostfix(expr);

    return function(vars = {}) {
        const stack = [];

        for (let i = 0; i < postfix.length; i++) {
            const token = postfix[i];

            if (typeof token === 'number') {
                stack.push(token);
            } else if (typeof token === 'string' && !isOperator(token)) {
                if (vars.hasOwnProperty(token)) {
                    stack.push(vars[token]);
                } else {
                    throw new Error(`Undefined variable: ${token}`);
                }
            } else {
                const b = stack.pop();
                const a = stack.pop();
                const result = applyOp(a, b, token);
                stack.push(result);
            }
        }

        return stack.pop();
    };
}

module.exports = { evaluate, compile };
