function sum(xs) { return xs.reduce((a, b) => a + b, 0); }
function max(xs) { return xs.length ? Math.max(...xs) : null; }
function median(xs) {
    if (xs.length === 0) {
        return 0;
    }
    xs.sort((a, b) => a - b);
    const midIndex = Math.floor(xs.length / 2);
    if (xs.length % 2 === 0) {
        return (xs[midIndex - 1] + xs[midIndex]) / 2;
    } else {
        return xs[midIndex];
    }
}

module.exports = { sum, max, median };

module.exports = { sum, max, median };

module.exports = { sum, max, median };

module.exports = { sum, max, median };

module.exports = { sum, max, median };

module.exports = { sum, max, median };

module.exports = { sum, max, median };

module.exports = { sum, max, median };

module.exports = { sum, max, median };

module.exports = { sum, max, median };

module.exports = { sum, max, median };
