// Test the tokenize function directly without importing the whole module
const fs = require('fs');

// Read the s5_expr.js file and extract just the tokenize function
const content = fs.readFileSync('./s5_expr.js', 'utf8');

// Extract the tokenize function
const tokenizeStart = content.indexOf('function tokenize(expr) {');
const tokenizeEnd = content.indexOf('}', tokenizeStart) + 1;
const tokenizeFunction = content.substring(tokenizeStart, tokenizeEnd);

// Create a test that uses the tokenize function directly
const testCode = `
function tokenize(expr) {
    const tokens = [];
    let i = 0;
    
    while (i < expr.length) {
        const char = expr[i];
        
        if (/\d/.test(char)) {
            // Parse number (including decimals)
            let num = '';
            while (i < expr.length && (/\d/.test(expr[i]) || expr[i] === '.')) {
                num += expr[i];
                i++;
            }
            tokens.push({ type: 'num', value: parseFloat(num) });
            continue;
        }
        
        if (/[A-Za-z_]/.test(char)) {
            // Parse variable name
            let varName = '';
            while (i < expr.length && /[A-Za-z0-9_]/.test(expr[i])) {
                varName += expr[i];
                i++;
            }
            tokens.push({ type: 'name', value: varName });
            continue;
        }
        
        if (char === '(') {
            tokens.push({ type: 'lparen', value: char });
        } else if (char === ')') {
            tokens.push({ type: 'rparen', value: char });
        } else if (char === ',') {
            tokens.push({ type: 'comma', value: char });
        } else if (char === '+' || char === '-' || char === '*' || char === '/' || char === '^') {
            tokens.push({ type: 'op', value: char });
        } else if (char === ' ') {
            // Skip whitespace
            i++;
            continue;
        } else {
            throw new Error('Invalid character: ' + char + ' at ' + i);
        }
        i++;
    }
    
    return tokens;
}

// Test cases
console.log("Testing tokenize function:");
try {
    const tokens = tokenize("2 + 3");
    console.log("Tokens for '2 + 3':", JSON.stringify(tokens));
} catch (e) {
    console.log("Error:", e.message);
}

try {
    const tokens = tokenize("x * y");
    console.log("Tokens for 'x * y':", JSON.stringify(tokens));
} catch (e) {
    console.log("Error:", e.message);
}

try {
    const tokens = tokenize("(2 + 3) * 4");
    console.log("Tokens for '(2 + 3) * 4':", JSON.stringify(tokens));
} catch (e) {
    console.log("Error:", e.message);
}

try {
    const tokens = tokenize("2.5 + 3.7");
    console.log("Tokens for '2.5 + 3.7':", JSON.stringify(tokens));
} catch (e) {
    console.log("Error:", e.message);
}

try {
    const tokens = tokenize("func(a,b)");
    console.log("Tokens for 'func(a,b)':", JSON.stringify(tokens));
} catch (e) {
    console.log("Error:", e.message);
}

try {
    const tokens = tokenize("2 + 3 * 4");
    console.log("Tokens for '2 + 3 * 4':", JSON.stringify(tokens));
} catch (e) {
    console.log("Error:", e.message);
}
`;

// Write the test to a temporary file and run it
fs.writeFileSync('./temp_tokenize_test.js', testCode);
require('./temp_tokenize_test.js');