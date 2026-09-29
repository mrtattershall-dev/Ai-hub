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

  equals(other, eps = 1e-9) {
    if (!other instanceof Matrix) {
      return false;
    }
    const [rows, cols] = this.shape();
    const [otherRows, otherCols] = other.shape();
    if (rows !== otherRows || cols !== otherCols) {
      return false;
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.abs(this.get(r, c) - other.get(r, c)) > eps) {
          return false;
        }
      }
    }
    return true;
  }

  transpose() {
    const [rows, cols] = this.shape();
    const result = [];
    for (let i = 0; i < cols; i++) {
      const row = [];
      for (let j = 0; j < rows; j++) {
        row.push(this.get(j, i));
      }
      result.push(row);
    }
    return new Matrix(result);
  }

  mul(x) {
    if (typeof x === 'number') {
      return new Matrix(this.rows.map(row => row.map(value => value * x)));
    } else if (x instanceof Matrix) {
      const [rowsA, colsA] = this.shape();
      const [rowsB, colsB] = x.shape();
      if (colsA !== rowsB) {
        throw new Error("Inner dimensions do not match for matrix multiplication");
      }
      const result = [];
      for (let i = 0; i < rowsA; i++) {
        const row = [];
        for (let j = 0; j < colsB; j++) {
          let sum = 0;
          for (let k = 0; k < colsA; k++) {
            sum += this.get(i, k) * x.get(k, j);
          }
          row.push(sum);
        }
        result.push(row);
      }
      return new Matrix(result);
    } else {
      throw new Error("Invalid argument type for mul");
    }
  }
}

module.exports = Matrix;