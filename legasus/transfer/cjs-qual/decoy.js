// A second require-able module in the same process. Never requested in the scope-positive
// condition; its identity proves substitution did not leak beyond what was authorized.
require('./mark.js')('DECOY');
function joinAll(xs) { return xs.join('+'); }
module.exports = { joinAll };
