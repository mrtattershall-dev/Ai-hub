class Matrix {
  constructor(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('No rows provided');
    }

    const cols = rows[0].length;
    if (cols === 0) {
      throw new Error('Empty rows provided');
    }

    rows.forEach(row => {
      if (!Array.isArray(row) || row.length !== cols) {
        throw new Error('Rows must be of equal length');
      }
      row.forEach(value => {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw new Error('All entries must be finite numbers');
        }
      });
    });

    this.rows = rows;
    this.cols = cols;
  }
  shape() {
    return [this.rows.length, this.cols];
  }
  get(r, c) {
    if (r < 0 || r >= this.rows.length || c < 0 || c >= this.cols) {
      throw new Error('Index out of bounds');
    }
    return this.rows[r][c];
  }
  toArray() {
    return this.rows.map(row => [...row]);
  }

  add(other) {
    if (this.rows.length !== other.rows.length || this.cols !== other.cols) {
      throw new Error('Matrices must have the same shape');
    }
    const result = this.rows.map((row, i) => row.map((value, j) => value + other.rows[i][j]));
    return new Matrix(result);
  }

  sub(other) {
    if (this.rows.length !== other.rows.length || this.cols !== other.cols) {
      throw new Error('Matrices must have the same shape');
    }
    const result = this.rows.map((row, i) => row.map((value, j) => value - other.rows[i][j]));
    return new Matrix(result);
  }
}

module.exports = Matrix;