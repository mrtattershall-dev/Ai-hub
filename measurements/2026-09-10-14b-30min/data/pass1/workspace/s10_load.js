const config = require('./s10_config.json');

if (!config.version) {
  throw new Error('Version key is missing in the configuration file.');
}

console.log('Configuration loaded successfully:', config);