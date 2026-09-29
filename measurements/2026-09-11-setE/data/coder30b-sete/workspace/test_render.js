const { render } = require('./q4_template.js');

// Test cases
console.log("Testing render function...\n");

// Test 1: Basic HTML escaping
const template1 = "Hello {{name}}, you have <b>{{count}}</b> messages";
const data1 = { name: "John & Jane", count: "<script>alert('xss')</script>" };
const result1 = render(template1, data1);
console.log("Test 1 - HTML escaping:");
console.log("Template:", template1);
console.log("Data:", data1);
console.log("Result:", result1);
console.log();

// Test 2: Raw insertion with {{{}}}
const template2 = "Hello {{{name}}}, you have <b>{{count}}</b> messages";
const data2 = { name: "John & Jane", count: "<script>alert('xss')</script>" };
const result2 = render(template2, data2);
console.log("Test 2 - Raw insertion:");
console.log("Template:", template2);
console.log("Data:", data2);
console.log("Result:", result2);
console.log();

// Test 3: Both types in same template
const template3 = "User: {{{user.name}}} | Escaped: {{user.email}} | Raw: {{{user.bio}}}";
const data3 = { 
  user: { 
    name: "Alice & Bob", 
    email: "alice@example.com <script>", 
    bio: "Bio with <b>HTML</b> and 'quotes'"
  } 
};
const result3 = render(template3, data3);
console.log("Test 3 - Mixed types:");
console.log("Template:", template3);
console.log("Data:", data3);
console.log("Result:", result3);
console.log();

// Test 4: Empty values
const template4 = "Hello {{name}}, {{empty}}";
const data4 = { name: "Test", empty: "" };
const result4 = render(template4, data4);
console.log("Test 4 - Empty values:");
console.log("Template:", template4);
console.log("Data:", data4);
console.log("Result:", result4);