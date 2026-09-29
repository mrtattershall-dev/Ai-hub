function renderTemplate(template, data, partials = {}) {
  let result = template;
  let openSections = [];
  for (let key in data) {
    const value = data[key];
// Handle {{! anything }} pattern
if (Array.isArray(value)) {
  const regex = new RegExp(`\\{\\{#${key}\\}\\}([^\\{]*)\\{\\{\\/${key}\\}\\}`, 'g');
  result = result.replace(regex, (match, content) => {
    openSections.push(key);
    return value.length > 0 ? value.map(item => content.replace(/\{\.\}/g, item)).join('') : '';
  });
  const invertedRegex = new RegExp(`\\{\\{^${key}\\}\\}([^\\{]*)\\{\\{\\/${key}\\}\\}`, 'g');
  result = result.replace(invertedRegex, (match, content) => {
    return value.length === 0 ? content : '';
  });
} else {
  const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
  result = result.replace(regex, value);
  const invertedRegex = new RegExp(`\\{\\{^${key}\\}\\}([^\\{]*)\\{\\{\\/${key}\\}\\}`, 'g');
  result = result.replace(invertedRegex, (match, content) => {
    return value === false || value === undefined || value === null || value === '' ? content : '';
  });
}
  }
  if (openSections.length > 0) {
    throw new Error(`Unclosed sections: ${openSections.join(', ')}`);
  }
  return result;
}

const template = `
  <ul>
    {{#items}}
      <li>{{.}}</li>
    {{/items}}
  </ul>
`;

const data = {
  items: []
};

console.log(renderTemplate(template, data));
// Handle {{> name}} pattern
const partialRegex = new RegExp(`\\{\\{>\\s*(\\w+)\\s*\\}\\}`, 'g');
let result = template;
result = result.replace(partialRegex, (match, partialName) => {
  if (partials[partialName]) {
    return renderTemplate(partials[partialName], data, partials);
  } else {
    throw new Error(`Missing partial: ${partialName}`);
  }
});
function compile(template) {
  // Placeholder for the compile function implementation
  return function(data, partials) {
    // Placeholder for the rendering function implementation
    return renderTemplate(template, data, partials);
  };
}

module.exports.compile = compile;
