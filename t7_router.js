function match(pattern, path) {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');
  
  // Check if pattern ends with '*' wildcard
  const hasWildcard = patternParts.length > 0 && patternParts[patternParts.length - 1] === '*';
  
  // If pattern has wildcard, we allow path to be longer
  if (hasWildcard) {
    // Remove the wildcard for length comparison
    const patternPartsNoWildcard = patternParts.slice(0, -1);
    
    // Pattern without wildcard must match the beginning of path
    if (patternPartsNoWildcard.length > pathParts.length) {
      return null;
    }
    
    const params = {};
    
    for (let i = 0; i < patternPartsNoWildcard.length; i++) {
      const patternPart = patternPartsNoWildcard[i];
      const pathPart = pathParts[i];
      
      if (patternPart.startsWith(':')) {
        const paramName = patternPart.substring(1);
        params[paramName] = pathPart;
      } else if (patternPart !== pathPart) {
        return null;
      }
    }
    
    // Add wildcard match as a special parameter
    params['*'] = pathParts.slice(patternPartsNoWildcard.length).join('/');
    return params;
  } else {
    // Original behavior for non-wildcard patterns
    if (patternParts.length !== pathParts.length) {
      return null;
    }
    
    const params = {};
    
    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];
      
      if (patternPart.startsWith(':')) {
        const paramName = patternPart.substring(1);
        params[paramName] = pathPart;
      } else if (patternPart !== pathPart) {
        return null;
      }
    }
    
    return params;
  }
}

// Export the function
module.exports = { match };