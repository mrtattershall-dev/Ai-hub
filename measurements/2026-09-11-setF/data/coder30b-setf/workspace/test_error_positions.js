// Simple test to check error position reporting
const fs = require('fs');

// Read the current s5_expr.js file
const content = fs.readFileSync('s5_expr.js', 'utf8');

// Let's look at the key parts of the file to understand the issue
console.log("=== ANALYZING s5_expr.js ===");
console.log("Looking for error handling patterns...");

// Extract error handling lines
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('throw new Error') && (line.includes('at ') || line.includes('position'))) {
        console.log(`Line ${i+1}: ${line.trim()}`);
    }
}

console.log("\n=== TESTING ERROR CASES ===");

// Test the specific examples from the goal
try {
    // This should give error at position 4
    const expr = '2 + * 3';
    console.log(`Testing expression: "${expr}"`);
    console.log("This should show error at position 4");
} catch (e) {
    console.log("Error:", e.message);
}

try {
    // This should give error at position 4  
    const expr = '(1+2';
    console.log(`Testing expression: "${expr}"`);
    console.log("This should show error at position 4");
} catch (e) {
    console.log("Error:", e.message);
}