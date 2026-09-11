// Reference solution (final state of chain s3) - used only to prove checks-F.mjs can pass.
const fmt = (v) => {
  const s = (Math.round(v * 1000) / 1000).toFixed(3).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};

class Matrix {
  constructor(rows) {
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('a matrix needs at least one row');
    const w = Array.isArray(rows[0]) ? rows[0].length : 0;
    if (w === 0) throw new Error('rows must not be empty');
    for (const r of rows) {
      if (!Array.isArray(r) || r.length !== w) throw new Error('rows must all have the same length');
      for (const v of r) if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('entries must be finite numbers');
    }
    this.a = rows.map((r) => [...r]);
  }

  shape() { return [this.a.length, this.a[0].length]; }

  get(r, c) {
    const [n, m] = this.shape();
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= n || c >= m) throw new Error('outside the matrix');
    return this.a[r][c];
  }

  toArray() { return this.a.map((r) => [...r]); }

  _sameShape(o) {
    const [r, c] = this.shape(), [r2, c2] = o.shape();
    if (r !== r2 || c !== c2) throw new Error('the shapes differ');
  }

  add(o) { this._sameShape(o); const B = o.toArray(); return new Matrix(this.a.map((row, i) => row.map((v, j) => v + B[i][j]))); }

  sub(o) { this._sameShape(o); const B = o.toArray(); return new Matrix(this.a.map((row, i) => row.map((v, j) => v - B[i][j]))); }

  mul(x) {
    if (typeof x === 'number') return new Matrix(this.a.map((row) => row.map((v) => v * x)));
    if (!x || typeof x.toArray !== 'function') throw new Error('mul takes a number or a Matrix');
    const B = x.toArray();
    if (this.a[0].length !== B.length) throw new Error('the inner dimensions differ');
    return new Matrix(this.a.map((row) => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0))));
  }

  transpose() { return new Matrix(this.a[0].map((_, j) => this.a.map((row) => row[j]))); }

  static identity(n) {
    if (!Number.isInteger(n) || n <= 0) throw new Error('n must be a positive integer');
    return new Matrix([...Array(n)].map((_, i) => [...Array(n)].map((__, j) => (i === j ? 1 : 0))));
  }

  equals(o, eps = 1e-9) {
    if (!o || typeof o.shape !== 'function') return false;
    const [r, c] = this.shape(), [r2, c2] = o.shape();
    if (r !== r2 || c !== c2) return false;
    const B = o.toArray();
    return this.a.every((row, i) => row.every((v, j) => Math.abs(v - B[i][j]) <= eps));
  }

  _square() { if (this.a.length !== this.a[0].length) throw new Error('the matrix is not square'); }

  determinant() {
    this._square();
    const n = this.a.length, m = this.toArray();
    let det = 1;
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
      if (m[p][c] === 0) return 0;
      if (p !== c) { [m[p], m[c]] = [m[c], m[p]]; det = -det; }
      det *= m[c][c];
      for (let r = c + 1; r < n; r++) {
        const f = m[r][c] / m[c][c];
        for (let k = c; k < n; k++) m[r][k] -= f * m[c][k];
      }
    }
    return det;
  }

  inverse() {
    this._square();
    if (Math.abs(this.determinant()) < 1e-12) throw new Error('the matrix is singular');
    const n = this.a.length;
    const m = this.a.map((row, i) => [...row, ...[...Array(n)].map((_, j) => (i === j ? 1 : 0))]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
      [m[p], m[c]] = [m[c], m[p]];
      const d = m[c][c];
      for (let k = 0; k < 2 * n; k++) m[c][k] /= d;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = m[r][c];
        for (let k = 0; k < 2 * n; k++) m[r][k] -= f * m[c][k];
      }
    }
    return new Matrix(m.map((row) => row.slice(n)));
  }

  solve(b) {
    this._square();
    if (!Array.isArray(b) || b.length !== this.a.length) throw new Error('b has the wrong length');
    const inv = this.inverse();
    return inv.a.map((row) => row.reduce((s, v, k) => s + v * b[k], 0));
  }

  toString() { return this.a.map((row) => row.map(fmt).join(' ')).join('\n'); }

  static fromString(text) {
    const rows = String(text).trim().split('\n').map((line) => line.trim().split(/\s+/).map((t) => {
      const v = Number(t);
      if (t === '' || !Number.isFinite(v)) throw new Error('not a number: ' + t);
      return v;
    }));
    return new Matrix(rows);
  }
}

module.exports = { Matrix };
