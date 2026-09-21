// A minimal process that loads the target and uses it. Used both as a DESCENDANT of the
// witness and, in P-D, as an INDEPENDENT process spawned by the driver. It cannot tell the
// difference, which is the point.
const path = require('node:path');
const T = require(path.join(__dirname, 'target.js'));
const ok = JSON.stringify(T.seg('a; b')) === JSON.stringify(['a', 'b']);
console.log(`${ok ? 'PASS' : 'FAIL'} loader(${process.env.LEGASUS_ROLE || 'unset'}) segments`);
process.exit(0);
