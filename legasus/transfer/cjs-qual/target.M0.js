// Identity copy: behaviour identical to target.js, identity distinct so substitution is
// observable even when nothing about the witness outcome changes (Q-B).
require('./mark.js')('TARGET_M0');
function seg(s) { return String(s).split(';').map((x) => x.trim()).filter(Boolean); }
module.exports = { seg };
