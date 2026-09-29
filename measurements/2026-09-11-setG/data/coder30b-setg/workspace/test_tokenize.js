const { tokenize } = require('./s5_expr.js');

console.log("Testing tokenize function:");

try {
    const tokens = tokenize("2 + 3");
    console.log("Tokens for '2 + 3':", tokens);
} catch (e) {
    console.log("Error:", e.message);
}

try {
    const tokens = tokenize("x * y");
    console.log("Tokens for 'x * y':", tokens);
} catch (e) {
    console.log("Error:", e.message);
}

try {
    const tokens = tokenize("(2 + 3) * 4");
    console.log("Tokens for '(2 + 3) * 4':", tokens);
} catch (e) {
    console.log("Error:", e.message);
}

try {
    const tokens = tokenize("2.5 + 3.7");
    console.log("Tokens for '2.5 + 3.7':", tokens);
} catch (e) {
    console.log("Error:", e.message);
}

try {
    const tokens = tokenize("func(a,b)");
    console.log("Tokens for 'func(a,b)':", tokens);
} catch (e) {
    console.log("Error:", e.message);
}