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
    // Shape logic will go here
  }

  get(r, c) {
    // Get logic will go here
  }
  toArray() {
    // ToArray logic will go here
  }
  add(other) {
    if (this.rows.length !== other.rows.length || this.rows[0].length !== other.rows[0].length) {
      throw new Error('Matrices must have the same shape');
    }
    const result = this.rows.map((row, i) => row.map((value, j) => value + other.rows[i][j]));
    return new Matrix(result);
  }

  sub(other) {
    // Subtraction logic here
  }
}
module.exports = Matrix;