const { tokenize } = require('./s6_parser');

// Test cases
console.log("Testing tokenize function...");

// Test 1: Simple addition
try {
  const result1 = tokenize("1 + 2");
  console.assert(JSON.stringify(result1) === JSON.stringify(["1", "+", "2"]), "Test 1 failed");
  console.log("✓ Test 1 passed: Simple addition");
} catch (e) {
  console.error("✗ Test 1 failed:", e.message);
}

// Test 2: Decimal numbers
try {
  const result2 = tokenize("3.14 + 2.86");
  console.assert(JSON.stringify(result2) === JSON.stringify(["3.14", "+", "2.86"]), "Test 2 failed");
  console.log("✓ Test 2 passed: Decimal numbers");
} catch (e) {
  console.error("✗ Test 2 failed:", e.message);
}

// Test 3: Complex expression
try {
  const result3 = tokenize("(1 + 2) * 3");
  console.assert(JSON.stringify(result3) === JSON.stringify(["(", "1", "+", "2", ")", "*", "3"]), "Test 3 failed");
  console.log("✓ Test 3 passed: Complex expression");
} catch (e) {
  console.error("✗ Test 3 failed:", e.message);
}

// Test 4: Division and subtraction
try {
  const result4 = tokenize("10 / 2 - 3");
  console.assert(JSON.stringify(result4) === JSON.stringify(["10", "/", "2", "-", "3"]), "Test 4 failed");
  console.log("✓ Test 4 passed: Division and subtraction");
} catch (e) {
  console.error("✗ Test 4 failed:", e.message);
}

// Test 5: Invalid character should throw error
try {
  tokenize("1 + 2 & 3");
  console.error("✗ Test 5 failed: Should have thrown error for invalid character");
} catch (e) {
  console.assert(e.message === "Invalid character: &", "Test 5 failed: Wrong error message");
  console.log("✓ Test 5 passed: Invalid character throws error");
}

// Test 6: Empty string
try {
  const result6 = tokenize("");
  console.assert(JSON.stringify(result6) === JSON.stringify([]), "Test 6 failed");
  console.log("✓ Test 6 passed: Empty string");
} catch (e) {
  console.error("✗ Test 6 failed:", e.message);
}

// Test 7: Whitespace handling
try {
  const result7 = tokenize("  1  +  2  ");
  console.assert(JSON.stringify(result7) === JSON.stringify(["1", "+", "2"]), "Test 7 failed");
  console.log("✓ Test 7 passed: Whitespace handling");
} catch (e) {
  console.error("✗ Test 7 failed:", e.message);
}

console.log("All tests completed!");
const { evaluate } = require('./s6_parser');

// Test cases
console.log("Testing evaluate function with variables...");

// Test 1: Variable evaluation
try {
  const result1 = evaluate("x + y", { x: 5, y: 3 });
  console.assert(result1 === 8, "Test 1 failed: Variable evaluation");
  console.log("✓ Test 1 passed: Variable evaluation");
} catch (e) {
  console.error("✗ Test 1 failed:", e.message);
}

// Test 2: Unknown variable should throw error
try {
  evaluate("x + 1", { y: 5 });
  console.error("✗ Test 2 failed: Should have thrown error for unknown variable");
} catch (e) {
  console.assert(e.message === "Unknown variable: x", "Test 2 failed: Wrong error message");
  console.log("✓ Test 2 passed: Unknown variable throws error");
}

// Test 3: Variable with underscore
try {
  const result3 = evaluate("my_var + 10", { my_var: 5 });
  console.assert(result3 === 15, "Test 3 failed: Variable with underscore");
  console.log("✓ Test 3 passed: Variable with underscore");
} catch (e) {
  console.error("✗ Test 3 failed:", e.message);
}

// Test 4: Variable with digits
try {
  const result4 = evaluate("var1 + var2", { var1: 10, var2: 20 });
  console.assert(result4 === 30, "Test 4 failed: Variables with digits");
  console.log("✓ Test 4 passed: Variables with digits");
} catch (e) {
  console.error("✗ Test 4 failed:", e.message);
}

// Test 5: Existing functionality still works (no vars parameter)
try {
  const result5 = evaluate("2 + 3 * 4");
  console.assert(result5 === 14, "Test 5 failed: Existing functionality");
  console.log("✓ Test 5 passed: Existing functionality still works");
} catch (e) {
  console.error("✗ Test 5 failed:", e.message);
}

// Test 6: Complex expression with variables
try {
  const result6 = evaluate("(x + y) * z", { x: 2, y: 3, z: 4 });
  console.assert(result6 === 20, "Test 6 failed: Complex expression with variables");
  console.log("✓ Test 6 passed: Complex expression with variables");
} catch (e) {
  console.error("✗ Test 6 failed:", e.message);
}

// Test 7: Decimal variables
try {
  const result7 = evaluate("a * b", { a: 2.5, b: 4 });
  console.assert(result7 === 10, "Test 7 failed: Decimal variables");
  console.log("✓ Test 7 passed: Decimal variables");
} catch (e) {
  console.error("✗ Test 7 failed:", e.message);
}

console.log("All tests completed!");
// Test 8: Power operator right-associativity
try {
  const result8 = evaluate("2^3^2");
  console.assert(result8 === 512, "Test 8 failed: Power operator right-associativity");
  console.log("✓ Test 8 passed: Power operator right-associativity");
} catch (e) {
  console.error("✗ Test 8 failed:", e.message);
}

// Test 9: Power operator with negative base
try {
  const result9 = evaluate("-2^2");
  console.assert(result9 === -4, "Test 9 failed: Power operator with negative base");
  console.log("✓ Test 9 passed: Power operator with negative base");
} catch (e) {
  console.error("✗ Test 9 failed:", e.message);
}

// Test 10: Power operator precedence
try {
  const result10 = evaluate("2*3^2");
  console.assert(result10 === 18, "Test 10 failed: Power operator precedence");
  console.log("✓ Test 10 passed: Power operator precedence");
} catch (e) {
  console.error("✗ Test 10 failed:", e.message);
}

// Test 11: Power operator with parentheses
try {
  const result11 = evaluate("(2^3)^2");
  console.assert(result11 === 64, "Test 11 failed: Power operator with parentheses");
  console.log("✓ Test 11 passed: Power operator with parentheses");
} catch (e) {
  console.error("✗ Test 11 failed:", e.message);
}
// Test 8: Power operator with right-associativity
try {
  const result8 = evaluate("2^3^2");
  console.assert(result8 === 512, "Test 8 failed: 2^3^2 should equal 512");
  console.log("✓ Test 8 passed: Power operator with right-associativity");
} catch (e) {
  console.error("✗ Test 8 failed:", e.message);
}

// Test 9: Power operator with negative base
try {
  const result9 = evaluate("-2^2");
  console.assert(result9 === -4, "Test 9 failed: -2^2 should equal -4");
  console.log("✓ Test 9 passed: Power operator with negative base");
} catch (e) {
  console.error("✗ Test 9 failed:", e.message);
}

// Test 10: Power operator with parentheses
try {
  const result10 = evaluate("(2^3)^2");
  console.assert(result10 === 64, "Test 10 failed: (2^3)^2 should equal 64");
  console.log("✓ Test 10 passed: Power operator with parentheses");
} catch (e) {
  console.error("✗ Test 10 failed:", e.message);
}

// Test 11: Power operator with variables
try {
  const result11 = evaluate("x^2", {x: 3});
  console.assert(result11 === 9, "Test 11 failed: x^2 with x=3 should equal 9");
  console.log("✓ Test 11 passed: Power operator with variables");
} catch (e) {
  console.error("✗ Test 11 failed:", e.message);
}
