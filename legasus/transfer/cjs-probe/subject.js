// The pristine subject. CommonJS, plain .js, required relatively - the foreign shape.
// Self-identifies at load: this is APPARATUS evidence that a file was actually executed,
// never subject semantics. All three served files carry the same marker, so the arms differ
// only by which file answered the require.
require('./mark.js')('SUBJECT', __filename);

function seg(s) {
  return String(s).split(';').map((x) => x.trim()).filter(Boolean);
}

module.exports = { seg };
