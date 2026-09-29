// Debug the evaluate function
const fs = require('fs');
const path = './s5_expr.js';

// Read the file content
const content = fs.readFileSync(path, 'utf8');

// Find the evaluate function
const evaluateMatch = content.match(/function evaluate\(expr\) \{[\s\S]*?\}/);
if (evaluateMatch) {
    console.log("Current evaluate function:");
    console.log(evaluateMatch[0]);
} else {
    console.log("Could not find evaluate function");
}

// Test the specific case
const testExpr = '2*-3';
console.log("\nTesting expression:", testExpr);

// Let's manually trace through what should happen:
// 1. Remove spaces: '2*-3'
// 2. Check for invalid characters: /^[0-9+\-*/.()]+$/
// 3. Check for invalid patterns: no consecutive operators, no trailing operator
// 4. Check for balanced parentheses: none here
// 5. Handle parentheses: none here
// 6. Handle unary minus: this is where it fails

// Let's test the regex patterns that are supposed to handle unary minus
console.log("\nTesting regex patterns:");
console.log("Original:", testExpr);
console.log("Pattern /^(-)(?=\\d)/:", testExpr.match(/^(-)(?=\d)/));
console.log("Pattern /([+\\-*/(])(-)(?=\\d)/g:", testExpr.match(/([+\-*/(])(-)(?=\d)/g));