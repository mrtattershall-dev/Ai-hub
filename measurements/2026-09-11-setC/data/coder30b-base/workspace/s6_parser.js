// s6_parser.js
function tokenize(expr) {
  const tokens = [];
  // Updated regex to also match variable names and power operator
  const regex = /(\d+(\.\d+)?|[a-zA-Z_][a-zA-Z0-9_]*|[+\-*/()^])/g;
  let match;
  
  while ((match = regex.exec(expr)) !== null) {
    tokens.push(match[0]);
  }
  
  // Check if there are any remaining characters that aren't valid tokens
  const remaining = expr.replace(regex, '');
  if (remaining.trim() !== '') {
    throw new Error(`Invalid character: ${remaining.trim()[0]}`);
  }
  
  return tokens;
}

function evaluate(expr, vars = {}) {
  const tokens = tokenize(expr);
  
  // Convert to postfix notation using Shunting Yard algorithm
  const output = [];
  const operators = [];
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
  const rightAssociative = { '^': true };
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    if (/^\d+(\.\d+)?$/.test(token)) {
      output.push(parseFloat(token));
    } else if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token)) {
      // Handle variable names
      if (vars.hasOwnProperty(token)) {
        output.push(vars[token]);
      } else {
        throw new Error(`Unknown variable: ${token}`);
      }
    } else if (token === '(') {
      operators.push(token);
    } else if (token === ')') {
      while (operators.length > 0 && operators[operators.length - 1] !== '(') {
        output.push(operators.pop());
      }
      if (operators.length === 0) {
        throw new Error('Mismatched parentheses');
      }
      operators.pop(); // Remove '('
    } else if (['+', '-', '*', '/', '^'].includes(token)) {
      // Handle unary minus
      if (token === '-' && (i === 0 || tokens[i-1] === '(' || ['+', '-', '*', '/', '^'].includes(tokens[i-1]))) {
        // For unary minus, we need to push a special marker or handle it differently
        // We'll treat it as a special case in the evaluation phase
        operators.push(token);
      } else {
        // For binary operators, check precedence
        while (operators.length > 0 && 
               operators[operators.length - 1] !== '(' &&
               (precedence[operators[operators.length - 1]] > precedence[token] || 
                (precedence[operators[operators.length - 1]] === precedence[token] && 
                 !rightAssociative[token]))) {
          output.push(operators.pop());
        }
        operators.push(token);
      }
    } else {
      throw new Error(`Invalid token: ${token}`);
    }
  }
  
  while (operators.length > 0) {
    const op = operators.pop();
    if (op === '(' || op === ')') {
      throw new Error('Mismatched parentheses');
    }
    output.push(op);
  }
  
  // Evaluate postfix notation
  const stack = [];
  for (let i = 0; i < output.length; i++) {
    const token = output[i];
    if (typeof token === 'number') {
      stack.push(token);
    } else {
      // Handle operators
      if (token === '+' || token === '*' || token === '/') {
        if (stack.length < 2) {
          throw new Error('Invalid expression');
        }
        const b = stack.pop();
        const a = stack.pop();
        
        switch (token) {
          case '+':
            stack.push(a + b);
            break;
          case '*':
            stack.push(a * b);
            break;
          case '/':
            if (b === 0) {
              throw new Error('Division by zero');
            }
            stack.push(a / b);
            break;
        }
      } else if (token === '-') {
        // Handle minus operator - either binary or unary
        // If we have only one element on stack, it's unary minus
        if (stack.length === 1) {
          const a = stack.pop();
          stack.push(-a);
        } else {
          // Binary minus
          if (stack.length < 2) {
            throw new Error('Invalid expression');
          }
          const b = stack.pop();
          const a = stack.pop();
          stack.push(a - b);
        }
      } else if (token === '^') {
        // Handle power operator
        if (stack.length < 2) {
          throw new Error('Invalid expression');
        }
        const b = stack.pop();
        const a = stack.pop();
        stack.push(Math.pow(a, b));
      }
    }
  }
  
  if (stack.length !== 1) {
    throw new Error('Invalid expression');
  }
  
  return stack[0];
}

module.exports = { tokenize, evaluate };