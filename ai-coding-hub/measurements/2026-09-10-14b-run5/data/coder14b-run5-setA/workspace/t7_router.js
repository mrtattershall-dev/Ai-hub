/**
 * t7_router.js — a router that matches a path to a handler and calls it with the parameters.
 * A trailing '*' in the pattern matches any remaining path.
 * @module t7/router
 */

/**
 * A Router that matches a path to a handler and calls it with the parameters.
 * @param {Object} routes - An object mapping paths to handler functions.
 */
function Router(routes) {
  this.routes = routes;
}

/**
 * Matches a path to a handler and calls it with the parameters.
 * @param {string} path - The path to match.
 * @returns {boolean} - True if a handler was found and called, false otherwise.
 */
Router.prototype.match = function(path) {
  for (const pattern in this.routes) {
    const handler = this.routes[pattern];
    const params = this._extractParams(pattern, path);
    if (params !== null) {
      handler(params);
      return true;
    }
  }
  return false;
};

/**
 * Extracts parameters from a path based on a pattern.
 * @param {string} pattern - The pattern to match against.
 * @param {string} path - The path to extract parameters from.
 * @returns {Object|null} - An object containing the parameters, or null if the pattern does not match.
 */
Router.prototype._extractParams = function(pattern, path) {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart === '*') {
      // Match any remaining path
      params['*'] = pathParts.slice(i).join('/');
      return params;
    } else if (patternPart.startsWith(':')) {
      // Match a parameter
      const paramName = patternPart.slice(1);
      params[paramName] = pathPart;
    } else if (patternPart !== pathPart) {
      // No match
      return null;
    }
  }

  return params;
};

module.exports = { Router };