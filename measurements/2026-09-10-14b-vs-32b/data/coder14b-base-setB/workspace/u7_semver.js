const compare = function(a, b) {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const partA = partsA[i] || 0;
    const partB = partsB[i] || 0;

    if (partA > partB) return 1;
    if (partA < partB) return -1;
  }

  const prereleaseA = a.split('-')[1];
  const prereleaseB = b.split('-')[1];

  if (prereleaseA && prereleaseB) {
    const prereleasePartsA = prereleaseA.split('.').map(Number);
    const prereleasePartsB = prereleaseB.split('.').map(Number);

    for (let i = 0; i < Math.max(prereleasePartsA.length, prereleasePartsB.length); i++) {
      const prereleasePartA = prereleasePartsA[i] || 0;
      const prereleasePartB = prereleasePartsB[i] || 0;

      if (prereleasePartA > prereleasePartB) return 1;
      if (prereleasePartA < prereleasePartB) return -1;
    }
  } else if (prereleaseA) {
    return 1;
  } else if (prereleaseB) {
    return -1;
  }

  if (prereleaseA && prereleaseB) {
    const prereleasePartsA = prereleaseA.split('.').map(Number);
    const prereleasePartsB = prereleaseB.split('.').map(Number);

    for (let i = 0; i < Math.max(prereleasePartsA.length, prereleasePartsB.length); i++) {
      const prereleasePartA = prereleasePartsA[i] || 0;
      const prereleasePartB = prereleasePartsB[i] || 0;

      if (prereleasePartA > prereleasePartB) return 1;
      if (prereleasePartA < prereleasePartB) return -1;
    }
  } else if (prereleaseA) {
    return 1;
  } else if (prereleaseB) {
    return -1;
  }

  if (prereleaseA && prereleaseB) {
    const prereleasePartsA = prereleaseA.split('.').map(Number);
    const prereleasePartsB = prereleaseB.split('.').map(Number);

    for (let i = 0; i < Math.max(prereleasePartsA.length, prereleasePartsB.length); i++) {
      const prereleasePartA = prereleasePartsA[i] || 0;
      const prereleasePartB = prereleasePartsB[i] || 0;

      if (prereleasePartA > prereleasePartB) return 1;
      if (prereleasePartA < prereleasePartB) return -1;
    }
  } else if (prereleaseA) {
    return 1;
  } else if (prereleaseB) {
    return -1;
  }

  return 0;
};

// Assertions
const assert = require('assert');

assert.strictEqual(compare('1.10.2', '1.10.2'), 0);
assert.strictEqual(compare('1.10.2', '1.10.1'), 1);
assert.strictEqual(compare('1.10.2', '1.11.0'), -1);
assert.strictEqual(compare('1.10.2', '1.10.3'), -1);
assert.strictEqual(compare('1.10.2', '1.9.9'), 1);
assert.strictEqual(compare('1.10.2', '2.0.0'), -1);
assert.strictEqual(compare('2.0.0', '1.10.2'), 1);
assert.strictEqual(compare('1.10.2', '1.10.2-alpha'), 1);
assert.strictEqual(compare('1.10.2-alpha', '1.10.2'), -1);
assert.strictEqual(compare('1.10.2-alpha', '1.10.1'), 1);
assert.strictEqual(compare('1.10.2-alpha', '1.11.0'), -1);
assert.strictEqual(compare('1.10.2-alpha', '1.10.3'), -1);
assert.strictEqual(compare('1.10.2-alpha', '1.9.9'), 1);
assert.strictEqual(compare('1.10.2-alpha', '2.0.0'), -1);
assert.strictEqual(compare('2.0.0', '1.10.2-alpha'), 1);