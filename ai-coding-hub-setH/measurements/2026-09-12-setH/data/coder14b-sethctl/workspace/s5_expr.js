module.exports = {
  evaluate: function(expr) {
    const tokens = expr.split(' ').filter(token => token !== '');
    let i = 0;
    let result = parseFactor();
while (i < tokens.length) {
  const operator = tokens[i];
  if (operator === '+' || operator === '-') {
    i++;
    const nextValue = parseFactor();
    if (operator === '+') {
      result += nextValue;
    } else {
      result -= nextValue;
    }
  } else if (operator === '*' || operator === '/') {
    i++;
    const nextValue = parseFactor();
    if (operator === '*') {
      result *= nextValue;
    } else {
      result /= nextValue;
    }
  } else if (operator === '^') {
    i++;
    const nextValue = parseFactor();
    result = Math.pow(result, nextValue);
  } else {
    break;
  }
}

    return result;
function parseFactor() {
  let result = parseTerm();
  while (i < tokens.length) {
    const operator = tokens[i];
    if (operator === '*' || operator === '/') {
      i++;
      const nextValue = parseTerm();
      if (operator === '*') {
        result *= nextValue;
      } else {
        if (nextValue === 0) {
          throw new Error("Division by zero");
        }
        result /= nextValue;
      }
    } else {
      break;
    }
  }
  return result;
}

function parseTerm() {
  const token = tokens[i];
  if (token === '(') {
    i++;
    const result = evaluate(tokens.slice(i).join(' '));
    i++; // Skip the closing parenthesis
    return result;
  } else {
    i++;
    return parseFloat(token);
  }
}

function parseTerm() {
  const token = tokens[i];
  if (token === '(') {
    i++;
    const result = evaluate(tokens.slice(i).join(' '));
    i++; // Skip the closing parenthesis
    return result;
  } else {
    i++;
    return parseFloat(token);
  }
}

function parseTerm() {
  const token = tokens[i];
  if (token === '(') {
    i++;
    const result = evaluate(tokens.slice(i).join(' '));
    i++; // Skip the closing parenthesis
    return result;
  } else {
    i++;
    return parseFloat(token);
  }
}

function parseTerm() {
  const token = tokens[i];
  if (token === '(') {
    i++;
    const result = evaluate(tokens.slice(i).join(' '));
    i++; // Skip the closing parenthesis
    return result;
  } else {
    i++;
    return parseFloat(token);
  }
}

function parseTerm() {
  const token = tokens[i];
  if (token === '(') {
    i++;
    const result = evaluate(tokens.slice(i).join(' '));
    i++; // Skip the closing parenthesis
    return result;
  } else {
    i++;
    return parseFloat(token);
  }
}

function parseTerm() {
  const token = tokens[i];
  if (token === '(') {
    i++;
    const result = evaluate(tokens.slice(i).join(' '));
    i++; // Skip the closing parenthesis
    return result;
  } else {
    i++;
    return parseFloat(token);
  }
}

function parseTerm() {
  const token = tokens[i];
  if (token === '(') {
    i++;
    const result = evaluate(tokens.slice(i).join(' '));
    i++; // Skip the closing parenthesis
    return result;
  } else {
    i++;
    return parseFloat(token);
  }
}

function parseTerm() {
  const token = tokens[i];
  if (token === '(') {
    i++;
    const result = evaluate(tokens.slice(i).join(' '));
    i++; // Skip the closing parenthesis
    return result;
  } else {
    i++;
    return parseFloat(token);
  }
}

function parseTerm() {
  const token = tokens[i];
  if (token === '(') {
    i++;
    const result = evaluate(tokens.slice(i).join(' '));
    i++; // Skip the closing parenthesis
    return result;
  } else {
    i++;
    return parseFloat(token);
  }
}

function parseTerm() {
  const token = tokens[i];
  if (token === '(') {
    i++;
    const result = evaluate(tokens.slice(i).join(' '));
    i++; // Skip the closing parenthesis
    return result;
  } else {
    i++;
    return parseFloat(token);
  }
}

function parseTerm() {
  const token = tokens[i];
  if (token === '(') {
    i++;
    const result = evaluate(tokens.slice(i).join(' '));
    i++; // Skip the closing parenthesis
    return result;
  } else {
    i++;
    return parseFloat(token);
  }
}

function parseTerm() {
  const token = tokens[i];
  if (token === '(') {
    i++;
    const result = evaluate(tokens.slice(i).join(' '));
    i++; // Skip the closing parenthesis
    return result;
  } else {
    i++;
    return parseFloat(token);
  }
}

function parseTerm() {
  const token = tokens[i];
  if (token === '(') {
    i++;
    const result = evaluate(tokens.slice(i).join(' '));
    i++; // Skip the closing parenthesis
    return result;
  } else {
    i++;
    return parseFloat(token);
  }
}

function parseTerm() {
  const token = tokens[i];
  if (token === '(') {
    i++;
    const result = evaluate(tokens.slice(i).join(' '));
    i++; // Skip the closing parenthesis
    return result;
  } else {
    i++;
    return parseFloat(token);
  }
}

function parseTerm() {
  const token = tokens[i];
  if (token === '(') {
    i++;
    const result = evaluate(tokens.slice(i).join(' '));
    i++; // Skip the closing parenthesis
    return result;
  } else {
    i++;
    return parseFloat(token);
  }
}

function parseTerm() {
  const token = tokens[i];
  if (token === '(') {
    i++;
    const result = evaluate(tokens.slice(i).join(' '));
    i++; // Skip the closing parenthesis
    return result;
  } else {
    i++;
    return parseFloat(token);
  }
}

function parseTerm() {
  const token = tokens[i];
  if (token === '(') {
    i++;
    const result = evaluate(tokens.slice(i).join(' '));
    i++; // Skip the closing parenthesis
    return result;
  } else {
    i++;
    return parseFloat(token);
  }
}

function parseTerm() {
  const token = tokens[i];
  if (token === '(') {
    i++;
    const result = evaluate(tokens.slice(i).join(' '));
    i++; // Skip the closing parenthesis
    return result;
  } else {
    i++;
    return parseFloat(token);
  }
}

function parseTerm() {
  if (tokens[i] === '(') {
    i++;
    const result = evaluate(tokens.slice(i).join(' '));
    i++; // Skip the closing parenthesis
    return result;
  } else if (tokens[i] === '-') {
    i++;
    return -parseTerm();
  } else {
    i++;
    return parseFloat(tokens[i]);
  }
}

    function parseTerm() {
      const token = tokens[i];
      if (token === '(') {
        i++;
        const result = evaluate(tokens.slice(i).join(' '));
        i++; // Skip the closing parenthesis
        return result;
      } else {
        i++;
        return parseFloat(token);
      }
    }
  }
};
function evaluateWithVars(expr, vars = {}) {
  return evaluate(expr, vars);
}

function evaluate(expr, vars = {}) {
  // Existing evaluate function implementation
}
function min(...args) {
  if (args.length === 0) {
    throw new Error("min requires at least one argument");
  }
  return Math.min(...args);
}
