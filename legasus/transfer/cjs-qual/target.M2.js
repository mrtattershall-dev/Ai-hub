// Perturbation 2: a DIFFERENT wrong answer. Exists so that "served the wrong mutant" is
// distinguishable from "served the right one" by evidence rather than by assumption (Q-D).
require('./mark.js')('TARGET_M2');
function seg(s) { return ['WRONG']; }
module.exports = { seg };
