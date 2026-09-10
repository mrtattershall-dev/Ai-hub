/**
 * Adventure dialogue: a Flags store of world booleans, and a DialogueTree of nodes whose
 * choices branch to other nodes and can set flags or require them. Choosing an option
 * advances the tree and writes through to Flags — the tree keeps no global state of its own.
 */
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

class Flags {
  constructor() { this.map = new Map(); }
  set(name, val = true) { this.map.set(name, val); }
  get(name) { return this.map.get(name) || false; }
}

class DialogueTree {
  constructor(nodes, flags) { this.nodes = nodes; this.flags = flags; this.current = 'start'; }
  node() { return this.nodes[this.current]; }
  choices() {
    return this.node().choices.filter(c => !c.requires || this.flags.get(c.requires));
  }
  choose(index) {
    const c = this.choices()[index];
    if (!c) return false;
    if (c.sets) this.flags.set(c.sets);
    this.current = c.to;
    return true;
  }
  get done() { return this.node().choices.length === 0; }
}

// --- self-checking demo ---
const flags = new Flags();
const nodes = {
  start: { text: 'A guard blocks the gate.', choices: [
    { text: 'Bribe him', to: 'bribed', sets: 'paidGuard' },
    { text: 'Sneak past', to: 'caught' },
  ] },
  bribed: { text: 'He steps aside.', choices: [
    { text: 'Enter', to: 'inside', requires: 'paidGuard' },
  ] },
  caught: { text: 'You are caught.', choices: [] },
  inside: { text: 'You are inside.', choices: [] },
};
const dlg = new DialogueTree(nodes, flags);

assert(dlg.choices().length === 2, 'two choices are available at the start');
dlg.choose(0);                                                  // bribe -> sets flag, advances
assert(flags.get('paidGuard'), 'bribing sets the world flag');
assert(dlg.current === 'bribed', 'tree advanced to the bribed node');
assert(dlg.choices().length === 1, 'the flag unlocks the gated choice');
dlg.choose(0);
assert(dlg.current === 'inside' && dlg.done, 'reached a terminal node');
console.log('adventure/dialogue-tree OK');
