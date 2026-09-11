// Reference solution (final state of chain 4) - used only to prove checks-C.mjs can pass.
function dims(m) {
  if (!Array.isArray(m) || m.length === 0 || !Array.isArray(m[0]) || m[0].length === 0) throw new Error('not a matrix');
  const c = m[0].length;
  for (const row of m) {
    if (!Array.isArray(row) || row.length !== c) throw new Error('not a matrix: rows differ in length');
    for (const v of row) if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('not a matrix: entries must be numbers');
  }
  return [m.length, c];
}
function add(a, b) { const [r, c] = dims(a); const [r2, c2] = dims(b); if (r !== r2 || c !== c2) throw new Error('dimension mismatch'); return a.map((row, i) => row.map((v, j) => v + b[i][j])); }
function multiply(a, b) {
  const [r, k] = dims(a); const [k2, c] = dims(b); if (k !== k2) throw new Error('dimension mismatch');
  return Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => { let s = 0; for (let t = 0; t < k; t++) s += a[i][t] * b[t][j]; return s; }));
}
function transpose(m) { const [r, c] = dims(m); return Array.from({ length: c }, (_, j) => Array.from({ length: r }, (_, i) => m[i][j])); }
function identity(n) { return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))); }
function determinant(m) {
  const [r, c] = dims(m); if (r !== c) throw new Error('not square');
  if (r === 1) return m[0][0];
  if (r === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
  let d = 0;
  for (let j = 0; j < c; j++) { const minor = m.slice(1).map((row) => row.filter((_, k) => k !== j)); d += (j % 2 ? -1 : 1) * m[0][j] * determinant(minor); }
  return d;
}
function inverse(m) {
  const [n, c] = dims(m); if (n !== c) throw new Error('not square');
  if (Math.abs(determinant(m)) < 1e-12) throw new Error('singular matrix');
  const I = identity(n); const a = m.map((row, i) => [...row, ...I[i]]);
  for (let col = 0; col < n; col++) {
    let p = col; for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[p][col])) p = r;
    [a[col], a[p]] = [a[p], a[col]];
    const pv = a[col][col]; for (let j = 0; j < 2 * n; j++) a[col][j] /= pv;
    for (let r = 0; r < n; r++) if (r !== col) { const f = a[r][col]; for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[col][j]; }
  }
  return a.map((row) => row.slice(n));
}
module.exports = { add, multiply, transpose, identity, determinant, inverse };
