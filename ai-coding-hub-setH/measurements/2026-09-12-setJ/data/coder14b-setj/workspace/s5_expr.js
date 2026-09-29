module.exports = {
  evaluate: function(expr) {
    // Remove spaces
    expr = expr.replace(/\s+/g, '');

    // Simple evaluation
    const tokens = expr.split(/(\+|\-|\*|\/|\(|\))/);
    let result = evaluate(tokens[0]);
for (let i = 1; i < tokens.length; i += 2) {
  if (tokens[i] === '-') {
    tokens[i + 1] = '-' + tokens[i + 1];
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
        default:
          throw new Error('Invalid operator');
      }
    }

    return result;
  }
};