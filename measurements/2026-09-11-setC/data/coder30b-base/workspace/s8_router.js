// Router class implementation
class Router {
  constructor() {
    this.routes = [];
    this.middleware = [];
  }
  
  add(method, pattern, handler) {
    // Store route with method, pattern, and handler
    this.routes.push({ method, pattern, handler });
  }
  
  handle(method, path) {
    // Find matching route
    let matchedRoute = null;
    for (const route of this.routes) {
      // Check if pattern matches path (with parameter support)
      const params = this._matchPattern(route.pattern, path);
      if (params !== null) {
        // If we found a matching pattern, store it
        matchedRoute = route;
        // If the method also matches, we can proceed with handling
        if (route.method === method) {
          // Parse query string if present
          let query = {};
          const queryIndex = path.indexOf('?');
          if (queryIndex !== -1) {
            const queryString = path.substring(queryIndex + 1);
            const pairs = queryString.split('&');
            for (const pair of pairs) {
              const [key, value] = pair.split('=');
              query[key] = value;
            }
          }
          
          // Create request object with params and query
          const req = { method, path, params, query };
          
          // Execute middleware functions
          for (const middleware of this.middleware) {
            const result = middleware(req);
            if (result !== undefined) {
              return result;
            }
          }
          
          // Call handler with request object
          return route.handler(req);
        }
      }
    }
    // If we found a matching pattern but with wrong method, return 405
    if (matchedRoute !== null) {
      return '405';
    }
    // No matching route found
    return '404';
  }
  
  _matchPattern(pattern, path) {
    // Split pattern and path into segments
    const patternSegments = pattern.split('/');
    const pathSegments = path.split('/');
    
    // Check if pattern ends with '*' wildcard
    const isWildcard = patternSegments[patternSegments.length - 1] === '*';
    
    // If pattern ends with '*', we allow more path segments than pattern segments
    if (isWildcard) {
      // Remove the '*' from pattern segments for comparison
      const patternSegmentsWithoutWildcard = patternSegments.slice(0, -1);
      
      // Check if we have enough path segments (at least as many as pattern segments)
      if (patternSegmentsWithoutWildcard.length > pathSegments.length) {
        return null;
      }
      
      // If we have exactly the same number of segments, it's not a wildcard match
      // because there are no additional segments after the pattern
      if (patternSegmentsWithoutWildcard.length === pathSegments.length) {
        return null;
      }
      
      const params = {};
      
      // Check each pattern segment against path segment
      for (let i = 0; i < patternSegmentsWithoutWildcard.length; i++) {
        const patternSegment = patternSegmentsWithoutWildcard[i];
        const pathSegment = pathSegments[i];
        
        // If pattern segment starts with ':' it's a parameter
        if (patternSegment.startsWith(':')) {
          const paramName = patternSegment.substring(1); // Remove the ':'
          params[paramName] = pathSegment;
        } else {
          // Exact match required
          if (patternSegment !== pathSegment) {
            return null;
          }
        }
      }
      
      // Add wildcard match as a parameter
      const remainingPathSegments = pathSegments.slice(patternSegmentsWithoutWildcard.length);
      params['*'] = remainingPathSegments.join('/');
      
      return params;
    } else {
      // Original logic for non-wildcard patterns
      // If number of segments don't match, no match
      if (patternSegments.length !== pathSegments.length) {
        return null;
      }
      
      const params = {};
      
      // Check each segment
      for (let i = 0; i < patternSegments.length; i++) {
        const patternSegment = patternSegments[i];
        const pathSegment = pathSegments[i];
        
        // If pattern segment starts with ':' it's a parameter
        if (patternSegment.startsWith(':')) {
          const paramName = patternSegment.substring(1); // Remove the ':'
          params[paramName] = pathSegment;
        } else {
          // Exact match required
          if (patternSegment !== pathSegment) {
            return null;
          }
        }
      }
      
      return params;
    }
  }
  
  use(fn) {
    this.middleware.push(fn);
  }
}

// Export the Router class
module.exports = { Router };
