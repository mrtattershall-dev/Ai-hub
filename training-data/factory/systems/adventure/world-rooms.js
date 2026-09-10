/**
 * Adventure navigation: a RoomGraph of connected rooms with optionally locked exits, an
 * Inventory of keys, and a Navigator that moves the player between rooms, consulting the
 * inventory to pass locked doors and consuming the key when it does. The graph and the
 * inventory stay independent; the navigator coordinates them.
 */
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

class Inventory {
  constructor() { this.items = new Set(); }
  add(id) { this.items.add(id); }
  has(id) { return this.items.has(id); }
  take(id) { return this.items.delete(id); }
}

class RoomGraph {
  constructor(rooms) { this.rooms = rooms; }
  exit(room, dir) {
    const r = this.rooms[room];
    return (r && r.exits[dir]) || null;
  }
}

class Navigator {
  constructor(graph, inventory, start) { this.graph = graph; this.inv = inventory; this.room = start; }
  move(dir) {
    const exit = this.graph.exit(this.room, dir);
    if (!exit) return { ok: false, reason: 'no exit' };
    if (exit.locked && !this.inv.has(exit.key)) return { ok: false, reason: 'locked' };
    if (exit.locked) this.inv.take(exit.key);                   // the key is used up
    this.room = exit.to;
    return { ok: true, reason: 'moved' };
  }
}

// --- self-checking demo ---
const graph = new RoomGraph({
  hall: { exits: { north: { to: 'vault', locked: true, key: 'goldKey' }, east: { to: 'library' } } },
  library: { exits: { west: { to: 'hall' } } },
  vault: { exits: {} },
});
const inv = new Inventory();
const nav = new Navigator(graph, inv, 'hall');

assert(nav.move('north').reason === 'locked', 'the vault is locked without the key');
assert(nav.move('east').ok && nav.room === 'library', 'an open exit moves the player');
nav.move('west');                                              // back to the hall
inv.add('goldKey');
assert(nav.move('north').ok && nav.room === 'vault', 'the key opens the locked vault');
assert(!inv.has('goldKey'), 'the key is consumed when used');
console.log('adventure/world-rooms OK');
