const assert = require('assert');
const Router = require('./s8_router.js');

describe('Router', function() {
  describe('#add', function() {
    it('should add a route', function() {
      const router = new Router();
      router.add('GET', '/test', (req) => 'Test');
      assert.strictEqual(router.routes.GET['/test'], (req) => 'Test');
    });
  });

  describe('#handle', function() {
    it('should handle a route', function() {
      const router = new Router();
      router.add('GET', '/test', (req) => 'Test');
      assert.strictEqual(router.handle('GET', '/test'), 'Test');
    });

    it('should return 404 for non-existent route', function() {
      const router = new Router();
      assert.strictEqual(router.handle('GET', '/test'), '404');
    });
  });
});