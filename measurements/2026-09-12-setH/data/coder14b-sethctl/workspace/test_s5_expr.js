const { evaluate } = require('./s5_expr.js');

try {
console.assert(evaluate("1 + 1") === 2, "1 + 1 should be 2");
console.assert(evaluate("2 - 1") === 1, "2 - 1 should be 1");
console.assert(evaluate("3 * 2") === 6, "3 * 2 should be 6");
console.assert(evaluate("6 / 2") === 3, "6 / 2 should be 3");

console.assert(evaluate("2 + 3 * 4") === 14, "2 + 3 * 4 should be 14");
console.assert(evaluate("10 - 2 * 3") === 4, "10 - 2 * 3 should be 4");
console.assert(evaluate("(2 + 3) * 4") === 20, "(2 + 3) * 4 should be 20");
console.assert(evaluate("10 / 2 * 3") === 15, "10 / 2 * 3 should be 15");
console.assert(evaluate("8 / 2 * 2") === 8, "8 / 2 * 2 should be 8");
console.assert(evaluate("1 + 2 * 3 - 4 / 2") === 5, "1 + 2 * 3 - 4 / 2 should be 5");
  try {
  evaluate("10 / 0");
  console.error("10 / 0 should throw an error");
} catch (error) {
  console.assert(error.message === "Division by zero", "10 / 0 should throw 'Division by zero'");
}
} catch (error) {
  console.error(error.message);
}