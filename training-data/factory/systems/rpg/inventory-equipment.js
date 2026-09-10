/**
 * RPG inventory + equipment: an Inventory that stacks items, an Equipment system that
 * moves gear between the inventory and equip slots while applying stat modifiers, and a
 * Character whose effective stats reflect what is equipped. The systems talk only through
 * method calls — none reaches into another's fields.
 */
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

class Inventory {
  constructor() { this.slots = new Map(); }            // id -> { item, qty }
  add(item, qty = 1) {
    const e = this.slots.get(item.id);
    if (e) e.qty += qty; else this.slots.set(item.id, { item, qty });
    return this;
  }
  remove(id, qty = 1) {
    const e = this.slots.get(id);
    if (!e || e.qty < qty) return null;
    e.qty -= qty;
    if (e.qty === 0) this.slots.delete(id);
    return e.item;
  }
  has(id) { return this.slots.has(id); }
  count(id) { const e = this.slots.get(id); return e ? e.qty : 0; }
}

class Equipment {
  constructor(inventory) { this.inv = inventory; this.worn = new Map(); }   // slot -> item
  equip(id) {
    const item = this.inv.remove(id, 1);
    if (!item) return false;
    const prev = this.worn.get(item.slot);
    if (prev) this.inv.add(prev, 1);                   // swap old gear back into the bag
    this.worn.set(item.slot, item);
    return true;
  }
  unequip(slot) {
    const item = this.worn.get(slot);
    if (!item) return false;
    this.worn.delete(slot);
    this.inv.add(item, 1);
    return true;
  }
  bonus(stat) {
    let total = 0;
    for (const item of this.worn.values()) total += (item.mods && item.mods[stat]) || 0;
    return total;
  }
}

class Character {
  constructor(base, equipment) { this.base = base; this.equipment = equipment; }
  stat(name) { return (this.base[name] || 0) + this.equipment.bonus(name); }
}

// --- self-checking demo ---
const inv = new Inventory();
const equip = new Equipment(inv);
const hero = new Character({ attack: 5, defense: 2 }, equip);
const sword = { id: 'sword', slot: 'hand', mods: { attack: 4 } };
const shield = { id: 'shield', slot: 'offhand', mods: { defense: 3 } };
inv.add(sword).add(shield);

assert(hero.stat('attack') === 5, 'base attack before equipping');
equip.equip('sword');
assert(hero.stat('attack') === 9, 'attack rises with equipped sword');
assert(!inv.has('sword'), 'equipped item leaves the inventory');
equip.equip('shield');
assert(hero.stat('defense') === 5, 'defense rises with equipped shield');
equip.unequip('hand');
assert(hero.stat('attack') === 5, 'attack returns to base after unequip');
assert(inv.has('sword'), 'unequipped item returns to the inventory');
console.log('rpg/inventory-equipment OK');
