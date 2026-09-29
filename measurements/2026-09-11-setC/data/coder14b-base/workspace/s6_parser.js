module.exports = {
  tokenize: function(expr) {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      if (expr[i] === ' ') {
        i++;
      } else if (expr[i] === '+' || expr[i] === '-' || expr[i] === '*' || expr[i] === '/' || expr[i] === '(' || expr[i] === ')') {
        tokens.push({ type: 'operator', value: expr[i] });
        i++;
      } else {
        let num = '';
        while (i < expr.length && !isNaN(expr[i]) && expr[i] !== ' ') {
          num += expr[i];
          i++;
        }
        tokens.push({ type: 'number', value: parseFloat(num) });
      }
    }
    return tokens;
  },

  evaluate: function(expr) {
    const tokens = this.tokenize(expr);
    let i = 0;
function parseFactor(vars) {
  if (tokens[i].type === 'operator' && tokens[i].value === '-') {
    i++;
    const result = parseFactor(vars);
    return -result;
  } else if (tokens[i].type === 'number') {
    return tokens[i++].value;
  } else if (tokens[i].type === 'operator' && tokens[i].value === '(') {
    i++;
    const result = parseExpression(vars);
    i++;
    return result;
  } else if (tokens[i].type === 'variable') {
    const varName = tokens[i++].value;
    if (vars.hasOwnProperty(varName)) {
      return vars[varName];
    } else {
      throw new Error(`Unknown variable: ${varName}`);
    }
  } else if (tokens[i].type === 'operator' && tokens[i].value === '^') {
    i++;
    const base = parseFactor(vars);
    const exponent = parseFactor(vars);
    return Math.pow(base, exponent);
  } else {
    throw new Error('Malformed expression');
  }
}
function parseTerm(vars) {
  let result = parseFactor(vars);
  while (i < tokens.length && (tokens[i].type === 'operator' && (tokens[i].value === '*' || tokens[i].value === '/'))) {
    const operator = tokens[i].value;
    i++;
    const nextFactor = parseFactor(vars);
    if (operator === '*') {
      result *= nextFactor;
    } else if (operator === '/') {
      if (nextFactor === 0) {
        throw new Error('Division by zero');
      }
      result /= nextFactor;
    }
  }
  return result;
}

    function parseExpression() {
      let result = parseTerm();
      while (i < tokens.length && (tokens[i].type === 'operator' && (tokens[i].value === '+' || tokens[i].value === '-'))) {
        const operator = tokens[i].value;
        i++;
        const nextTerm = parseTerm();
        if (operator === '+') {
          result += nextTerm;
        } else if (operator === '-') {
          result -= nextTerm;
        }
      }
      return result;
    }

    return parseExpression();
  }
};