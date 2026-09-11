module.exports = {
  match: function(pattern, path) {
    const patternSegments = pattern.split('/');
    const pathSegments = path.split('/');

    if (patternSegments.length !== pathSegments.length) {
      return null;
    }

    const captures = {};

    for (let i = 0; i < patternSegments.length; i++) {
      const patternSegment = patternSegments[i];
      const pathSegment = pathSegments[i];

      if (patternSegment.startsWith(':')) {
        captures[patternSegment.substring(1)] = pathSegment;
      } else if (patternSegment !== pathSegment) {
        return null;
      }
    }

    return captures;
  }
};
const assert = require('assert');

// Test cases
assert.deepStrictEqual(match('/u/:id', '/u/7'), { id: '7' });
assert.deepStrictEqual(match('/u/:id', '/u/123'), { id: '123' });
assert.deepStrictEqual(match('/u/:id', '/u/abc'), { id: 'abc' });
assert.strictEqual(match('/u/:id', '/u'), null);
assert.strictEqual(match('/u/:id', '/user/7'), null);
assert.deepStrictEqual(match('/users/:id/posts/:post_id', '/users/123/posts/456'), { id: '123', post_id: '456' });
assert.strictEqual(match('/users/:id/posts/:post_id', '/users/123/posts'), null);
assert.strictEqual(match('/users/:id/posts/:post_id', '/users/123/posts/456/comments'), null);
