// BOUNDARIES, not "after line N".
//
// symbol_availability wrongly removed a boundary because it forbade positions from `i - 1` where `i`
// was the import-time use. Inserting AFTER line i-1 places the definition at line i, which is BEFORE
// the use and perfectly legal. That off-by-one is not a typo to patch; it is what happens whenever
// positions are represented as "after line N" and every consumer does its own arithmetic.
//
// So insertion points are BOUNDARIES BETWEEN LINES, and the conversions live in exactly one place:
//
//     B0   before line 0
//     B1   between line 0 and line 1
//     ...
//     BN   after the final line
//
//     beforeLine(i) = Bi          inserting here lands immediately BEFORE line i
//     afterLine(i)  = B(i+1)      inserting here lands immediately AFTER line i
//
// A provider required by an import-time use on line i is legal at any boundary <= beforeLine(i).
// Bi itself is legal - it inserts immediately before the use - which is exactly the boundary the old
// arithmetic threw away. Nobody downstream adds or subtracts one from a source line again.
const NL = String.fromCharCode(10);

export const beforeLine = (i) => i;
export const afterLine = (i) => i + 1;

// The number of boundaries in a text: one more than its line count.
export const boundaryCount = (text) => text.split(NL).length + 1;

// The ground truth and the candidate sweep both speak "insert after line p". This is the ONLY place
// that vocabulary is translated, so a mismatch is impossible rather than merely unlikely.
export const positionToBoundary = (p) => afterLine(p);
export const boundaryToPosition = (b) => b - 1;

// A closed constraint of the form "must sit at or before boundary b": returns the candidate POSITIONS
// it forbids, given the candidate set. Expressed through the helpers so the arithmetic is stated once.
export function forbidAfterBoundary(candidates, b) {
  return candidates.filter((p) => positionToBoundary(p) > b);
}

// "must sit at or after boundary b".
export function forbidBeforeBoundary(candidates, b) {
  return candidates.filter((p) => positionToBoundary(p) < b);
}

export { NL };
