function evaluate(expr) {
    expr = expr.replace(/\s+/g, '');
    let i = 0;

    function parse() {
        let num = '';
        let unary = false;

        if (expr[i] === '-') {
            unary = true;
            i++;
        }

        while (i < expr.length && (expr[i] >= '0' && expr[i] <= '9' || expr[i] === '.')) {
            num += expr[i];
            i++;
        }

        if (num !== '') {
            let result = parseFloat(num);
            if (unary) {
                result = -result;
            }
            return result;
        } else if (expr[i] === '(') {
            i++;
            let result = parseExpression();
            if (expr[i] !== ')') {
                throw new Error('Expected closing parenthesis');
            }
            i++;
            return result;
        } else {
            throw new Error('Unexpected character: ' + expr[i]);
        }
    }

    function parseTerm() {
        let result;
if (expr[i] === '-') {
    i++;
    result = -parseTerm();
} else {
    result = parse();
}
        while (i < expr.length) {
            if (expr[i] === '*') {
                i++;
                result *= parse();
            } else if (expr[i] === '/') {
                i++;
                const divisor = parse();
                if (divisor === 0) {
                    throw new Error('Division by zero');
                }
                result /= divisor;
            } else {
                break;
            }
        }
        return result;
    }

    function parseExpression() {
        let result;
if (expr[i] === '(') {
    i++;
    result = parseExpression();
    if (expr[i] !== ')') {
        throw new Error('Expected closing parenthesis');
    }
    i++;
} else {
    result = parseTerm();
}
        while (i < expr.length) {
            if (expr[i] === '+') {
                i++;
                result += parseTerm();
            } else if (expr[i] === '-') {
                i++;
                result -= parseTerm();
            } else {
                break;
            }
        }
        return result;
    }

    try {
        const result = parseExpression();
        if (i < expr.length) {
            throw new Error('Unexpected character: ' + expr[i]);
        }
        return result;
    } catch (e) {
        throw new Error('Cannot parse expression: ' + expr);
    }
}

module.exports = { evaluate };