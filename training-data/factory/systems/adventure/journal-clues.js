/**
 * Adventure deduction: a Journal that records discovered clues (ignoring duplicates) and a
 * Mystery that unlocks its conclusion only when every required clue is present.
 * Investigation writes clues to the journal; the mystery reads them but never edits the
 * journal.
 */
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

class Journal {
  constructor() { this.clues = new Set(); this.order = []; }
  record(id) { if (!this.clues.has(id)) { this.clues.add(id); this.order.push(id); } }
  has(id) { return this.clues.has(id); }
  get count() { return this.clues.size; }
}

class Mystery {
  constructor(journal, required, conclusion) {
    this.journal = journal; this.required = required; this.conclusion = conclusion; this.solved = false;
  }
  missing() { return this.required.filter(id => !this.journal.has(id)); }
  trySolve() {
    if (this.missing().length === 0) this.solved = true;
    return this.solved ? this.conclusion : null;
  }
}

// --- self-checking demo ---
const journal = new Journal();
const mystery = new Mystery(journal, ['footprint', 'letter', 'witness'], 'The butler did it.');

journal.record('footprint');
journal.record('footprint');                                   // duplicate ignored
assert(journal.count === 1, 'a duplicate clue is not counted twice');
assert(mystery.trySolve() === null, 'the mystery cannot be solved early');
assert(mystery.missing().length === 2, 'two required clues are still missing');
journal.record('letter');
journal.record('witness');
assert(mystery.trySolve() === 'The butler did it.', 'the conclusion unlocks with all clues');
assert(mystery.solved, 'the mystery is marked solved');
console.log('adventure/journal-clues OK');
