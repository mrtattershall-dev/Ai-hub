class Matrix {
  constructor(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("No rows provided");
    }
    const numCols = rows[0].length;
    if (numCols === 0) {
      throw new Error("Empty rows");
    }
    for (const row of rows) {
      if (!Array.isArray(row) || row.length !== numCols) {
        throw new Error("Rows of different lengths");
      }
      for (const value of row) {
        if (typeof value !== 'number' || !isFinite(value)) {
          throw new Error("Non-finite number");
        }
      }
    }
    this.rows = rows;
  }

  shape() {
    return [this.rows.length, this.rows[0].length];
  }

  get(r, c) {
    if (r < 0 || r >= this.rows.length || c < 0 || c >= this.rows[0].length) {
      throw new Error("Index out of bounds");
    }
    return this.rows[r][c];
  }

  toArray() {
    return this.rows.map(row => [...row]);
  }

  add(other) {
    if (!other instanceof Matrix) {
      throw new Error("Argument must be a Matrix");
    }
    const [rows1, cols1] = this.shape();
    const [rows2, cols2] = other.shape();
    if (rows1 !== rows2 || cols1 !== cols2) {
      throw new Error("Matrices must have the same shape");
    }
    const result = this.rows.map((row, i) => {
      return row.map((value, j) => {
        return value + other.get(i, j);
      });
    });
    return new Matrix(result);
  }

  sub(other) {
    if (!other instanceof Matrix) {
      throw new Error("Argument must be a Matrix");
    }
    const [rows1, cols1] = this.shape();
    const [rows2, cols2] = other.shape();
    if (rows1 !== rows2 || cols1 !== cols2) {
      throw new Error("Matrices must have the same shape");
    }
    const result = this.rows.map((row, i) => {
      return row.map((value, j) => {
        return value - other.get(i, j);
      });
    });
    return new Matrix(result);
  }
}

module.exports = Matrix;