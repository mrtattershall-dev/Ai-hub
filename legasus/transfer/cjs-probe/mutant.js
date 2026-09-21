// The perturbation: RETURN_EMPTY, the same family member BIND-1 used as its must-fire control.
// Identical to baseline.js except the body and the identity.
require('./mark.js')('MUTANT', __filename);

function seg(s) {
  return [];
}

module.exports = { seg };
