// Debug the unary minus regex
let expr = '2*-3';
console.log("Original:", expr);

// Handle unary minus at the beginning of expression
expr = expr.replace(/^(-)(?=\d)/, '0$1');
console.log("After line 64:", expr);

// Handle unary minus after opening parentheses or operators
expr = expr.replace(/([+\-*/(])(-)(?=\d)/g, '$10$2');
console.log("After line 66:", expr);

// Handle unary minus between two numbers (like 2*-3)
expr = expr.replace(/(?<=\d)(-)(?=\d)/g, '+0$1');
console.log("After line 67:", expr);

// Let's also test the pattern separately
console.log("Pattern test:");
console.log("'2*-3'.match(/(?<=\d)(-)(?=\d)/g):", '2*-3'.match(/(?<=\d)(-)(?=\d)/g));
console.log("Pattern test with groups:");
console.log("'2*-3'.match(/(?<=\d)(-)(?=\d)/):", '2*-3'.match(/(?<=\d)(-)(?=\d)/));