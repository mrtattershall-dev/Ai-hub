const { evaluate } = require('./s5_expr.js');

try {
  console.log("Testing '-(2+3)*2':");
  const result1 = evaluate('-(2+3)*2');
  console.log("Result:", result1);
} catch (e) {
  console.log("Error:", e.message);
}

try {
  console.log("Testing '2*-3':");
  const result2 = evaluate('2*-3');
  console.log("Result:", result2);
} catch (e) {
  console.log("Error:", e.message);
}