module.exports = {
  evaluate: function(expr) {
    // Remove spaces
    expr = expr.replace(/\s+/g, '');

    // Helper function to parse numbers
    function parseNumber(expr) {
      const match = expr.match(/^\d+(\.\d+)?/);
      if (match) {
        return { value: parseFloat(match[0]), rest: expr.slice(match[0].length) };
      }
      throw new Error('Invalid number');
    }

    // Helper function to parse expressions
function parseExpression(expr) {
  let { value, rest } = parseTerm(expr);

  while (rest.length > 0) {
    const op = rest[0];
    rest = rest.slice(1);

    if (op === '+' || op === '-') {
      const { value: nextValue, rest: nextRest } = parseTerm(rest);
      switch (op) {
        case '+':
          value += nextValue;
          break;
        case '-':
          value -= nextValue;
          break;
      }
      rest = nextRest;
    } else {
      throw new Error('Invalid operator');
    }
  }

  return value;
}

function parseTerm(expr) {
  let { value, rest } = parseFactor(expr);

  while (rest.length > 0) {
    const op = rest[0];
    rest = rest.slice(1);

    if (op === '*' || op === '/') {
      const { value: nextValue, rest: nextRest } = parseFactor(rest);
      switch (op) {
        case '*':
          value *= nextValue;
          break;
        case '/':
          if (nextValue === 0) {
            throw new Error('Division by zero');
          }
          value /= nextValue;
          break;
      }
      rest = nextRest;
    } else {
      throw new Error('Invalid operator');
    }
  }

  return value;
}

function parseFactor(expr) {
  const match = expr.match(/^\d+(\.\d+)?/);
  if (match) {
    return { value: parseFloat(match[0]), rest: expr.slice(match[0].length) };
  }
  throw new Error('Invalid number');
}

    return parseExpression(expr);
  }
};
function evaluate(expr, vars = {}) {
  const tokens = tokenize(expr);
  const ast = parse(tokens);
  return evaluateAST(ast, vars);
}

function min(...args) {
  if (args.length < 1) {
    throw new Error('min requires at least one argument');
  }
  return Math.min(...args);
}

function max(...args) {
  if (args.length < 1) {
    throw new Error('max requires at least one argument');
  }
  return Math.max(...args);
}

function abs(x) {
  if (args.length !== 1) {
    throw new Error('abs requires exactly one argument');
  }
  return Math.abs(x);
}

function sqrt(x) {
  if (args.length !== 1) {
    throw new Error('sqrt requires exactly one argument');
  }
  if (x < 0) {
    throw new Error('sqrt of a negative number');
  }
  return Math.sqrt(x);
}

function evaluateAST(ast, vars) {
  switch (ast.type) {
    case 'number':
      return ast.value;
    case 'variable':
      if (vars.hasOwnProperty(ast.name)) {
        return vars[ast.name];
      } else {
        throw new Error(`Unknown variable: ${ast.name}`);
      }
    case 'binary':
      const left = evaluateAST(ast.left, vars);
      const right = evaluateAST(ast.right, vars);
      switch (ast.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
        case '%': return left % right;
        default: throw new Error(`Unknown operator: ${ast.operator}`);
      }
    default:
      throw new Error(`Unknown AST type: ${ast.type}`);
  }
}
