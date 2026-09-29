module.exports = {
evaluate: function(expr, vars = {}) {
  // Remove spaces
  expr = expr.replace(/\s+/g, '');

  // Replace variables with their values
  expr = expr.replace(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g, (match, name) => {
    if (vars.hasOwnProperty(name)) {
      return vars[name];
    } else {
      throw new Error(`Unknown variable: ${name}`);
    }
  });

    // Simple evaluation
const tokens = expr.split(/(\+|\-|\*|\/|\(|\))/);
let result = 0;
let i = 0;

if (tokens[0] === '-') {
  result = -parseFloat(tokens[1]);
  i = 2;
} else {
  result = parseFloat(tokens[0]);
  i = 1;
}

for (; i < tokens.length; i += 2) {
  const operator = tokens[i];
  const nextValue = parseFloat(tokens[i + 1]);

  if (operator === '+') {
    result += nextValue;
  } else if (operator === '-') {
    result -= nextValue;
  } else if (operator === '*') {
    result *= nextValue;
  } else if (operator === '/') {
    result /= nextValue;
  }
}

    for (let i = 1; i < tokens.length; i += 2) {
      const operator = tokens[i];
      const nextValue = parseFloat(tokens[i + 1]);
switch (operator) {
  case '+':
    result += nextValue;
    break;
  case '-':
    result -= nextValue;
    break;
  case '*':
    result *= nextValue;
    break;
  case '/':
    if (nextValue === 0) {
      throw new Error('Division by zero');
    }
    result /= nextValue;
    break;
  case '^':
    result = Math.pow(result, nextValue);
    break;
  default:
    throw new Error('Invalid operator');
}
    }

    return result;
  }
};