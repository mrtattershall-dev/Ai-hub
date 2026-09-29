class Matrix {
  constructor(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("No rows provided");
    }

    const colLength = rows[0].length;
    if (colLength === 0) {
      throw new Error("Empty rows");
    }

    for (const row of rows) {
      if (!Array.isArray(row) || row.length !== colLength) {
        throw new Error("Rows of different lengths");
      }
      for (const element of row) {
        if (typeof element !== 'number' || !isFinite(element)) {
          throw new Error("Not a finite number");
        }
      }
    }

    this.rows = rows;
  }

  mul(x) {
    if (x instanceof Matrix) {
      if (this.rows[0].length !== x.rows.length) {
        throw new Error("Inner dimensions do not match");
      }

      const result = [];
      for (let i = 0; i < this.rows.length; i++) {
        const row = [];
        for (let j = 0; j < x.rows[0].length; j++) {
          let sum = 0;
          for (let k = 0; k < x.rows.length; k++) {
            sum += this.rows[i][k] * x.rows[k][j];
          }
          row.push(sum);
        }
        result.push(row);
      }
      return new Matrix(result);
    } else if (typeof x === 'number') {
      const result = [];
      for (const row of this.rows) {
        const newRow = row.map(element => element * x);
        result.push(newRow);
      }
      return new Matrix(result);
    } else {
      throw new Error("Invalid argument type");
    }
  }
}

module.exports = Matrix;