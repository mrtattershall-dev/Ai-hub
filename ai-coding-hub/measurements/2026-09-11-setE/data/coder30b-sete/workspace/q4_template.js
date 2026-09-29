// Template rendering function
function render(template, data) {
  // Handle inverted sections first - {{^items}}...{{/items}}
  // This regex matches {{^section}}content{{/section}} patterns
  template = template.replace(/\{\{\\^([^}]+)\}\}(.*?)\{\{\/\1\}\}/gs, (match, sectionName, content) => {
    // Get the value from data using the section name
    const keys = sectionName.split('.');
    let value = data;
    
    // Traverse the object using the dotted path
    for (let i = 0; i < keys.length; i++) {
      if (value === null || value === undefined) {
        return content; // Return content if any part is missing
      }
      value = value[keys[i]];
    }
    
    // If value is false, null, or empty, render the content
    if (!value) {
      return content;
    }
    
    // If value is truthy, render nothing
    return '';
  });
  
  // Handle sections second - {{#items}}...{{/items}}
  // This regex matches {{#section}}content{{/section}} patterns
  template = template.replace(/\{\{#([^}]+)\}\}(.*?)\{\{\/\1\}\}/gs, (match, sectionName, content) => {
    // Get the value from data using the section name
    const keys = sectionName.split('.');
    let value = data;
    
    // Traverse the object using the dotted path
    for (let i = 0; i < keys.length; i++) {
      if (value === null || value === undefined) {
        return ''; // Return empty string if any part is missing
      }
      value = value[keys[i]];
    }
    
    // If value is false, null, or empty, render nothing
    if (!value) {
      return '';
    }
    
    // If value is an array, render the content for each element
    if (Array.isArray(value)) {
      let result = '';
      for (let i = 0; i < value.length; i++) {
        // Create a new data object with the current element as the root
        const itemData = value[i];
        let sectionContent = content;
        
        // Replace {{.}} with the current item
        sectionContent = sectionContent.replace(/\{\{\.\}\}/g, (match) => {
          if (itemData === null || itemData === undefined) {
            return '';
          }
          return itemData;
        });
        
        // Handle raw insertion {{{key}}} in section content
        sectionContent = sectionContent.replace(/\{\{\{([^}]+)\}\}\}/g, (match, keyPath) => {
          const keys = keyPath.split('.');
          let itemValue = itemData;
          
          // Traverse the item using the dotted path
          for (let j = 0; j < keys.length; j++) {
            if (itemValue === null || itemValue === undefined) {
              return ''; // Return empty string if any part is missing
            }
            itemValue = itemValue[keys[j]];
          }
          
          // Return the value if found, otherwise return empty string
          return itemValue !== undefined ? itemValue : '';
        });
        
        // Replace other keys with the current item's properties
        sectionContent = sectionContent.replace(/\{\{([^}]+)\}\}/g, (match, keyPath) => {
          const keys = keyPath.split('.');
          let itemValue = itemData;
          
          // Traverse the item using the dotted path
          for (let j = 0; j < keys.length; j++) {
            if (itemValue === null || itemValue === undefined) {
              return ''; // Return empty string if any part is missing
            }
            itemValue = itemValue[keys[j]];
          }
          
          // Apply filters if present
          if (keyPath.includes('|')) {
            const parts = keyPath.split('|').map(part => part.trim());
            const mainKey = parts[0].trim();
            
            // Extract the value using the main key path
            let mainValue = itemData;
            const mainKeys = mainKey.split('.');
            for (let j = 0; j < mainKeys.length; j++) {
              if (mainValue === null || mainValue === undefined) {
                mainValue = '';
                break;
              }
              mainValue = mainValue[mainKeys[j]];
            }
            
            // Apply filters in order
            let result = mainValue !== undefined ? mainValue.toString() : '';
            
            // Define available filters
            const filters = {
              'upper': (str) => str.toUpperCase(),
              'lower': (str) => str.toLowerCase(),
              'trim': (str) => str.trim()
            };
            
            // Apply each filter
            for (let j = 1; j < parts.length; j++) {
              const filterName = parts[j].trim();
              if (!filters[filterName]) {
                throw new Error(`Unknown filter: ${filterName}`);
              }
              result = filters[filterName](result);
            }
            
            itemValue = result;
          }
          
          // HTML-escape the value if found, otherwise return empty string
          if (itemValue === undefined) {
            return '';
          }
          
          // HTML escape function
          const escapeHtml = (text) => {
            const map = {
              '&': '&amp;',
              '<': '&lt;',
              '>': '&gt;',
              '"': '&quot;',
              "'": '&#39;'
            };
            return text.toString().replace(/[&<>"']/g, (m) => map[m]);
          };
          
          return escapeHtml(itemValue);
        });
        
        result += sectionContent;
      }
      return result;
    }
    
    // For non-array values, render the content once
    let sectionContent = content;
    
    // Replace {{.}} with the value
    sectionContent = sectionContent.replace(/\{\{\.\}\}/g, (match) => {
      if (value === null || value === undefined) {
        return '';
      }
      return value;
    });
    
    // Handle raw insertion {{{key}}} in section content
    sectionContent = sectionContent.replace(/\{\{\{([^}]+)\}\}\}/g, (match, keyPath) => {
      const keys = keyPath.split('.');
      let itemValue = value;
      
      // Traverse the value using the dotted path
      for (let i = 0; i < keys.length; i++) {
        if (itemValue === null || itemValue === undefined) {
          return ''; // Return empty string if any part is missing
        }
        itemValue = itemValue[keys[i]];
      }
      
      // Return the value if found, otherwise return empty string
      return itemValue !== undefined ? itemValue : '';
    });
    
    // Replace other keys with the value's properties
    sectionContent = sectionContent.replace(/\{\{([^}]+)\}\}/g, (match, keyPath) => {
      const keys = keyPath.split('.');
      let itemValue = value;
      
      // Traverse the value using the dotted path
      for (let i = 0; i < keys.length; i++) {
        if (itemValue === null || itemValue === undefined) {
          return ''; // Return empty string if any part is missing
        }
        itemValue = itemValue[keys[i]];
      }
      
      // Apply filters if present
      if (keyPath.includes('|')) {
        const parts = keyPath.split('|').map(part => part.trim());
        const mainKey = parts[0].trim();
        
        // Extract the value using the main key path
        let mainValue = value;
        const mainKeys = mainKey.split('.');
        for (let i = 0; i < mainKeys.length; i++) {
          if (mainValue === null || mainValue === undefined) {
            mainValue = '';
            break;
          }
          mainValue = mainValue[mainKeys[i]];
        }
        
        // Apply filters in order
        let result = mainValue !== undefined ? mainValue.toString() : '';
        
        // Define available filters
        const filters = {
          'upper': (str) => str.toUpperCase(),
          'lower': (str) => str.toLowerCase(),
          'trim': (str) => str.trim()
        };
        
        // Apply each filter
        for (let i = 1; i < parts.length; i++) {
          const filterName = parts[i].trim();
          if (!filters[filterName]) {
            throw new Error(`Unknown filter: ${filterName}`);
          }
          result = filters[filterName](result);
        }
        
        itemValue = result;
      }
      
      // HTML-escape the value if found, otherwise return empty string
      if (itemValue === undefined) {
        return '';
      }
      
      // HTML escape function
      const escapeHtml = (text) => {
        const map = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        };
        return text.toString().replace(/[&<>"']/g, (m) => map[m]);
      };
      
      return escapeHtml(itemValue);
    });
    
    return sectionContent;
  });
  
  // Handle simple replacements {{key}} and {{{key}}} (raw)
  template = template.replace(/\{\{([^}]+)\}\}/g, (match, keyPath) => {
    // Get the value from data using the key path
    const keys = keyPath.split('.');
    let value = data;
    
    // Traverse the object using the dotted path
    for (let i = 0; i < keys.length; i++) {
      if (value === null || value === undefined) {
        return ''; // Return empty string if any part is missing
      }
      value = value[keys[i]];
    }
    
    // HTML-escape the value if found, otherwise return empty string
    if (value === undefined) {
      return '';
    }
    
    // HTML escape function
    const escapeHtml = (text) => {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return text.toString().replace(/[&<>"']/g, (m) => map[m]);
    };
    
    return escapeHtml(value);
  });
  
  // Handle raw insertion {{{key}}}
  template = template.replace(/\{\{\{([^}]+)\}\}\}/g, (match, keyPath) => {
    // Get the value from data using the key path
    const keys = keyPath.split('.');
    let value = data;
    
    // Traverse the object using the dotted path
    for (let i = 0; i < keys.length; i++) {
      if (value === null || value === undefined) {
        return ''; // Return empty string if any part is missing
      }
      value = value[keys[i]];
    }
    
    // Return the value if found, otherwise return empty string
    return value !== undefined ? value : '';
  });
  
  return template;
}

// Test the template engine
const testTemplate = `
{{^items}}
No items found!
{{/items}}

{{#items}}
{{#name}}<li>{{name}}</li>{{/name}}
{{/items}}
`;

const testData1 = { items: [] };
const testData2 = { items: [{ name: "Item 1" }, { name: "Item 2" }] };
const testData3 = { items: null };
const testData4 = { items: undefined };

console.log("Test 1 (empty array):");
console.log(render(testTemplate, testData1));

console.log("\nTest 2 (with items):");
console.log(render(testTemplate, testData2));

console.log("\nTest 3 (null items):");
console.log(render(testTemplate, testData3));

console.log("\nTest 4 (undefined items):");
console.log(render(testTemplate, testData4));