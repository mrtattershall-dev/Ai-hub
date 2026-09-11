const { match } = require('./t7_router.js');

// Test existing functionality
console.log("Testing exact match:");
console.log(match('/users/123', '/users/123')); // Should return { }

console.log("Testing parameter match:");
console.log(match('/users/:id', '/users/123')); // Should return { id: '123' }

console.log("Testing wildcard match:");
console.log(match('/api/*', '/api/users/123')); // Should return { '*': 'users/123' }

console.log("Testing wildcard with parameter:");
console.log(match('/api/:type/*', '/api/users/123/456')); // Should return { type: 'users', '*': '123/456' }

console.log("Testing non-matching pattern:");
console.log(match('/users/123', '/users/456')); // Should return null

console.log("Testing non-matching wildcard:");
console.log(match('/api/*', '/users/123')); // Should return null

console.log("Testing wildcard at end with empty remainder:");
console.log(match('/api/*', '/api/users')); // Should return { '*': 'users' }