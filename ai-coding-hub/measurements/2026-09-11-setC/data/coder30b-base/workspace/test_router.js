// Test file for Router
const { Router } = require('./s8_router.js');

// Test 1: Basic routing
console.log('Test 1: Basic routing');
const router = new Router();

// Add a simple route
router.add('GET', '/home', (req) => {
  return `Home page requested: ${req.method} ${req.path}`;
});

// Test the route
const result1 = router.handle('GET', '/home');
console.assert(result1 === 'Home page requested: GET /home', 'Test 1 failed');
console.log('✓ Test 1 passed');

// Test 2: Non-matching route should return 404
console.log('Test 2: Non-matching route');
const result2 = router.handle('GET', '/about');
console.assert(result2 === '404', 'Test 2 failed');
console.log('✓ Test 2 passed');

// Test 3: Different method should not match
console.log('Test 3: Different method');
router.add('POST', '/home', (req) => {
  return `POST to home: ${req.method} ${req.path}`;
});

const result3 = router.handle('POST', '/home');
console.assert(result3 === 'POST to home: POST /home', 'Test 3 failed');
console.log('✓ Test 3 passed');

// Test 4: Non-matching method should return 404
console.log('Test 4: Non-matching method');
const result4 = router.handle('GET', '/home');
console.assert(result4 === 'Home page requested: GET /home', 'Test 4 failed');
console.log('✓ Test 4 passed');

// Test 5: Parameterized route
console.log('Test 5: Parameterized route');
router.add('GET', '/user/:id', (req) => {
  return `User page for ${req.params.id}: ${req.method} ${req.path}`;
});

const result5 = router.handle('GET', '/user/123');
console.assert(result5 === 'User page for 123: GET /user/123', 'Test 5 failed');
console.log('✓ Test 5 passed');

// Test 6: Parameterized route with different parameter
console.log('Test 6: Parameterized route with different parameter');
const result6 = router.handle('GET', '/user/456');
console.assert(result6 === 'User page for 456: GET /user/456', 'Test 6 failed');
console.log('✓ Test 6 passed');

// Test 7: Parameterized route with non-matching path
console.log('Test 7: Parameterized route with non-matching path');
const result7 = router.handle('GET', '/user');
console.assert(result7 === '404', 'Test 7 failed');
console.log('✓ Test 7 passed');

// Test 8: Parameterized route with wrong method
console.log('Test 8: Parameterized route with wrong method');
const result8 = router.handle('POST', '/user/123');
console.assert(result8 === '405', 'Test 8 failed');
console.log('✓ Test 8 passed');

// Test 9: Multiple parameters
console.log('Test 9: Multiple parameters');
router.add('GET', '/user/:id/post/:postId', (req) => {
  return `Post ${req.params.postId} by user ${req.params.id}: ${req.method} ${req.path}`;
});

const result9 = router.handle('GET', '/user/123/post/456');
console.assert(result9 === 'Post 456 by user 123: GET /user/123/post/456', 'Test 9 failed');
console.log('✓ Test 9 passed');

// Test 10: Parameterized route with static segments
console.log('Test 10: Parameterized route with static segments');
router.add('GET', '/api/:version/users/:id', (req) => {
  return `API ${req.params.version} user ${req.params.id}: ${req.method} ${req.path}`;
});

const result10 = router.handle('GET', '/api/v1/users/789');
console.assert(result10 === 'API v1 user 789: GET /api/v1/users/789', 'Test 10 failed');
console.log('✓ Test 10 passed');

console.log('All tests passed!');
// Test 11: Wildcard route
console.log('Test 11: Wildcard route');
router.add('GET', '/files/*', (req) => {
  return `Files route with wildcard: ${req.params['*']}: ${req.method} ${req.path}`;
});

const result11 = router.handle('GET', '/files/a/b/c');
console.assert(result11 === 'Files route with wildcard: a/b/c: GET /files/a/b/c', 'Test 11 failed');
console.log('✓ Test 11 passed');

// Test 12: Wildcard route with single segment
console.log('Test 12: Wildcard route with single segment');
const result12 = router.handle('GET', '/files/single');
console.assert(result12 === 'Files route with wildcard: single: GET /files/single', 'Test 12 failed');
console.log('✓ Test 12 passed');

// Test 13: Wildcard route with no match
console.log('Test 13: Wildcard route with no match');
const result13 = router.handle('GET', '/files');
console.assert(result13 === '404', 'Test 13 failed');
console.log('✓ Test 13 passed');

// Test 14: Wildcard route with parameters
console.log('Test 14: Wildcard route with parameters');
router.add('GET', '/user/:id/*', (req) => {
  return `User ${req.params.id} with wildcard: ${req.params['*']}: ${req.method} ${req.path}`;
});

const result14 = router.handle('GET', '/user/123/a/b/c');
console.assert(result14 === 'User 123 with wildcard: a/b/c: GET /user/123/a/b/c', 'Test 14 failed');
console.log('✓ Test 14 passed');

console.log('All tests passed!');
// Test 15: Middleware execution
console.log('Test 15: Middleware execution');
const router2 = new Router();

// Add middleware that modifies the request
router2.use((req) => {
  req.middlewareExecuted = true;
});

// Add a simple route
router2.add('GET', '/test', (req) => {
  return `Test page: ${req.middlewareExecuted ? 'middleware ran' : 'no middleware'}`;
});

const result15 = router2.handle('GET', '/test');
console.assert(result15 === 'Test page: middleware ran', 'Test 15 failed');
console.log('✓ Test 15 passed');

// Test 16: Middleware that short-circuits execution
console.log('Test 16: Middleware that short-circuits execution');
const router3 = new Router();

// Add middleware that returns a value, short-circuiting the handler
router3.use((req) => {
  return 'middleware response';
});

// Add a simple route
router3.add('GET', '/test', (req) => {
  return 'this should not be called';
});

const result16 = router3.handle('GET', '/test');
console.assert(result16 === 'middleware response', 'Test 16 failed');
console.log('✓ Test 16 passed');

// Test 17: Multiple middleware functions
console.log('Test 17: Multiple middleware functions');
const router4 = new Router();

// Add multiple middleware functions
router4.use((req) => {
  req.middleware1 = true;
});

router4.use((req) => {
  req.middleware2 = true;
});

// Add a simple route
router4.add('GET', '/test', (req) => {
  return `Test page: ${req.middleware1 ? 'middleware1 ran' : 'no middleware1'} and ${req.middleware2 ? 'middleware2 ran' : 'no middleware2'}`;
});

const result17 = router4.handle('GET', '/test');
console.assert(result17 === 'Test page: middleware1 ran and middleware2 ran', 'Test 17 failed');
console.log('✓ Test 17 passed');

console.log('All tests passed!');
// Test 18: Path matches but with wrong method should return 405
console.log('Test 18: Path matches but with wrong method');
const router5 = new Router();

// Add a route with GET method
router5.add('GET', '/home', (req) => {
  return `GET home: ${req.method} ${req.path}`;
});

// Try to access with POST method - should return 405
const result18 = router5.handle('POST', '/home');
console.assert(result18 === '405', 'Test 18 failed');
console.log('✓ Test 18 passed');

// Test 19: Path matches with correct method should work normally
console.log('Test 19: Path matches with correct method');
const result19 = router5.handle('GET', '/home');
console.assert(result19 === 'GET home: GET /home', 'Test 19 failed');
console.log('✓ Test 19 passed');

// Test 20: Non-matching path should still return 404
console.log('Test 20: Non-matching path');
const result20 = router5.handle('GET', '/about');
console.assert(result20 === '404', 'Test 20 failed');
console.log('✓ Test 20 passed');

// Test 21: Parameterized route with wrong method should return 405
console.log('Test 21: Parameterized route with wrong method');
const router6 = new Router();

// Add a parameterized route with GET method
router6.add('GET', '/user/:id', (req) => {
  return `User ${req.params.id}: ${req.method} ${req.path}`;
});

// Try to access with POST method - should return 405
const result21 = router6.handle('POST', '/user/123');
console.assert(result21 === '405', 'Test 21 failed');
console.log('✓ Test 21 passed');

// Test 22: Wildcard route with wrong method should return 405
console.log('Test 22: Wildcard route with wrong method');
const router7 = new Router();

// Add a wildcard route with GET method
router7.add('GET', '/files/*', (req) => {
  return `Files: ${req.params['*']}: ${req.method} ${req.path}`;
});

// Try to access with POST method - should return 405
const result22 = router7.handle('POST', '/files/a/b/c');
console.assert(result22 === '405', 'Test 22 failed');
console.log('✓ Test 22 passed');
