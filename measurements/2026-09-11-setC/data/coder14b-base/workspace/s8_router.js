class Router {
  constructor() {
    this.routes = {};
  }

  add(method, pattern, handler) {
    if (!this.routes[method]) {
      this.routes[method] = {};
    }
    if (pattern.endsWith('*')) {
      const wildcardPattern = pattern.slice(0, -1);
      if (!this.routes[method][wildcardPattern]) {
        this.routes[method][wildcardPattern] = {};
      }
      this.routes[method][wildcardPattern]['*'] = handler;
    } else {
      this.routes[method][pattern] = handler;
    }
  }

  handle(method, path) {
    const [routePath, queryString] = path.split('?');
    const route = this.routes[method][routePath];
    if (route) {
      const queryParams = this.parseQueryString(queryString);
      return route({ method, path: routePath, params: {}, query: queryParams });
    }
    const wildcardPattern = routePath.split('/').slice(0, -1).join('/');
    const wildcardRoute = this.routes[method][wildcardPattern] && this.routes[method][wildcardPattern]['*'];
    if (wildcardRoute) {
      const params = { '*': routePath.split('/').slice(-1)[0] };
      const queryParams = this.parseQueryString(queryString);
      return wildcardRoute({ method, path: routePath, params, query: queryParams });
    }
    return '404';
  }

  parseQueryString(queryString) {
    const queryParams = {};
    if (queryString) {
      const pairs = queryString.split('&');
      pairs.forEach(pair => {
        const [key, value] = pair.split('=');
        queryParams[key] = value;
      });
    }
    return queryParams;
  }
}

module.exports = Router;