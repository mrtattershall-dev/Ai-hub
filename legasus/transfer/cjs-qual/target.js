require('./mark.js')('TARGET');
function seg(s) { return String(s).split(';').map((x) => x.trim()).filter(Boolean); }
module.exports = { seg };
