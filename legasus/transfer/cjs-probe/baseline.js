// Identity copy of the subject: byte-identical behaviour, different self-identification.
// Serving THIS is the probe's own control (T2) - if the arm that requests it still reports
// SUBJECT, the probe cannot tell substitution from its absence and is an apparatus failure.
require('./mark.js')('BASELINE', __filename);

function seg(s) {
  return String(s).split(';').map((x) => x.trim()).filter(Boolean);
}

module.exports = { seg };
