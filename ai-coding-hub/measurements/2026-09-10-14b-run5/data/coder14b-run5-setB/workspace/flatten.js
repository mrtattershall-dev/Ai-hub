/**
 * Compare version strings like '1.10.2' and return -1, 0 or 1.
 * @returns {number} -1 if a < b, 0 if a === b, 1 if a > b.
 */
function compare(a, b) {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aNum = aParts[i] || 0;
    const bNum = bParts[i] || 0;
    if (aNum < bNum) return -1;
    if (aNum > bNum) return 1;
  }
  return 0;
}{ compare };