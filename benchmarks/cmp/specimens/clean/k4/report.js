// Reporting helpers built on inventory.js.
function lowStock(inv, threshold) { return Object.keys(inv).filter((k) => inv[k] < threshold).sort(); }
module.exports = { lowStock };
