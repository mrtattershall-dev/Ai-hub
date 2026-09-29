const fs = require('fs');
console.log('File contents:');
console.log(fs.readFileSync('./q7_buffer.js', 'utf8'));
console.log('\n\nModule exports:');
console.log(require('./q7_buffer.js'));