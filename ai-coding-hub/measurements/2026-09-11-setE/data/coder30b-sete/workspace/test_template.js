const { render } = require('./q4_template.js');

console.log("Testing dotted paths:");
console.log("Result 1:", render("Hello {{user.name}}!", {user: {name: "Alice"}}));
console.log("Result 2:", render("Hello {{user.name}}!", {user: {}}));
console.log("Result 3:", render("Hello {{user.name}}!", {}));

// Test with more complex paths
console.log("Result 4:", render("{{user.profile.email}}", {user: {profile: {email: "alice@example.com"}}}));
console.log("Result 5:", render("{{user.profile.email}}", {user: {profile: {}}}));
console.log("Result 6:", render("{{user.profile.email}}", {user: {}}));
console.log("Result 7:", render("{{user.profile.email}}", {}));

// Test with non-existent paths
console.log("Result 8:", render("{{user.profile.email}}", {user: {profile: {phone: "123"}}}));
console.log("Result 9:", render("{{user.name.age}}", {user: {name: "Alice"}}));
console.log("\nTesting filters:");
console.log("Result 10:", render("{{name | upper}}", {name: "alice"}));
console.log("Result 11:", render("{{name | lower}}", {name: "ALICE"}));
console.log("Result 12:", render("{{name | trim}}", {name: "  alice  "}));
console.log("Result 13:", render("{{ name | trim | upper }}", {name: "  alice  "}));
console.log("Result 14:", render("{{name | upper | lower}}", {name: "ALICE"}));

// Test unknown filter
try {
  render("{{name | unknown}}", {name: "alice"});
  console.log("ERROR: Should have thrown an exception for unknown filter");
} catch (e) {
  console.log("Result 15: Correctly threw error for unknown filter:", e.message);
}
console.log("\nTesting sections:");
console.log("Result 16:", render("{{#items}}{{.}}{{/items}}", {items: ["a", "b", "c"]}));
console.log("Result 17:", render("{{#items}}{{name}}{{/items}}", {items: [{name: "Alice"}, {name: "Bob"}]}));
console.log("Result 18:", render("{{#items}}{{name | upper}}{{/items}}", {items: [{name: "alice"}, {name: "bob"}]}));
console.log("Result 19:", render("{{#items}}{{{name}}}{{/items}}", {items: [{name: "<script>"}, {name: "<div>"}]}));
console.log("Result 20:", render("{{#items}}<li>{{name}}</li>{{/items}}", {items: [{name: "Alice"}, {name: "Bob"}]}));
console.log("Result 21:", render("{{#items}}{{name}}{{/items}}", {items: []}));
console.log("Result 22:", render("{{#items}}{{name}}{{/items}}", {items: null}));
console.log("Result 23:", render("{{#items}}{{name}}{{/items}}", {items: false}));
console.log("Result 24:", render("{{#items}}{{name}}{{/items}}", {}));
console.log("Result 25:", render("{{#items}}<p>{{name}}</p>{{/items}}", {items: [{name: "Alice"}, {name: "Bob"}]}));
console.log("Result 26:", render("{{#user}}{{name}}{{/user}}", {user: {name: "Alice"}}));
console.log("Result 27:", render("{{#user}}{{name | upper}}{{/user}}", {user: {name: "alice"}}));
console.log("Result 28:", render("{{#user}}{{{name}}}{{/user}}", {user: {name: "<script>"}}));
console.log("Result 29:", render("{{#user}}{{name}}{{/user}}", {user: null}));
console.log("Result 30:", render("{{#user}}{{name}}{{/user}}", {user: false}));
console.log("Result 31:", render("{{#user}}{{name}}{{/user}}", {}));
