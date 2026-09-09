'use strict';

/**
 * inventory.js
 *
 * A weight-capped inventory.
 *
 *   - add(name, weight, quantity)  add items; refused if it would exceed the cap
 *   - remove(name, quantity)       remove items; refused if you do not have them
 *   - totalWeight()                current total weight carried
 *
 * Running this file directly executes a self-checking demo that asserts every
 * behaviour and prints a PASS line per check:
 *
 *   node inventory.js
 */

/** Thrown when an add would push total weight past the cap. */
class CapacityError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'CapacityError';
    Object.assign(this, details);
  }
}

/** Thrown when you try to remove items you do not have. */
class MissingItemError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'MissingItemError';
    Object.assign(this, details);
  }
}

// Weights are floats, and summing them repeatedly drifts (0.1 * 3 = 0.30000000000000004).
// Round every derived weight to a fixed precision so cap checks and reported
// totals are stable and comparable.
function round(n) {
  return Math.round(n * 1e6) / 1e6;
}

function assertName(name) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new TypeError('item name must be a non-empty string');
  }
  return name.trim();
}

function assertWeight(weight) {
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
    throw new TypeError('weight must be a finite number >= 0');
  }
  return weight;
}

function assertQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new TypeError('quantity must be an integer >= 1');
  }
  return quantity;
}

class Inventory {
  /**
   * @param {number} capacity maximum total weight this inventory may hold.
   */
  constructor(capacity) {
    if (typeof capacity !== 'number' || !Number.isFinite(capacity) || capacity < 0) {
      throw new TypeError('capacity must be a finite number >= 0');
    }
    this.capacity = capacity;
    /** @type {Map<string, {name: string, weight: number, quantity: number}>} */
    this._stacks = new Map();
  }

  /** Total weight of everything currently held. */
  totalWeight() {
    let sum = 0;
    for (const stack of this._stacks.values()) {
      sum += stack.weight * stack.quantity;
    }
    return round(sum);
  }

  /** How much more weight can still be added. */
  remainingCapacity() {
    return round(this.capacity - this.totalWeight());
  }

  /** Number of distinct item kinds held. */
  get size() {
    return this._stacks.size;
  }

  /** Total number of individual items held, counting quantities. */
  itemCount() {
    let n = 0;
    for (const stack of this._stacks.values()) n += stack.quantity;
    return n;
  }

  has(name) {
    return this._stacks.has(assertName(name));
  }

  /** How many of `name` are held (0 if none). */
  quantityOf(name) {
    const stack = this._stacks.get(assertName(name));
    return stack ? stack.quantity : 0;
  }

  /** A copy of the contents, sorted by name. Safe to mutate. */
  items() {
    return [...this._stacks.values()]
      .map((s) => ({ name: s.name, weight: s.weight, quantity: s.quantity }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Would adding this fit under the cap? Does not mutate.
   * @returns {boolean}
   */
  canFit(weight, quantity = 1) {
    const w = assertWeight(weight);
    const q = assertQuantity(quantity);
    return round(this.totalWeight() + w * q) <= this.capacity;
  }

  /**
   * Add items. Items sharing a name must share a unit weight; they stack.
   *
   * @throws {CapacityError} if the add would exceed the cap (nothing is added).
   * @returns {{name: string, weight: number, quantity: number}} the resulting stack.
   */
  add(name, weight, quantity = 1) {
    const key = assertName(name);
    const w = assertWeight(weight);
    const q = assertQuantity(quantity);

    const existing = this._stacks.get(key);
    if (existing && existing.weight !== w) {
      throw new TypeError(
        `"${key}" is already stored at unit weight ${existing.weight}, refusing to store it at ${w}`
      );
    }

    const added = round(w * q);
    const after = round(this.totalWeight() + added);
    if (after > this.capacity) {
      throw new CapacityError(
        `cannot add ${q} x "${key}" (${added}): would put the total at ${after}, over the cap of ${this.capacity}`,
        {
          item: key,
          attempted: added,
          totalWeight: this.totalWeight(),
          capacity: this.capacity,
          remainingCapacity: this.remainingCapacity(),
        }
      );
    }

    if (existing) {
      existing.quantity += q;
      return { ...existing };
    }
    const stack = { name: key, weight: w, quantity: q };
    this._stacks.set(key, stack);
    return { ...stack };
  }

  /**
   * Remove items. Removing the last of a kind drops the stack entirely.
   *
   * @throws {MissingItemError} if fewer than `quantity` are held (nothing is removed).
   * @returns {{name: string, weight: number, quantity: number}} what was removed.
   */
  remove(name, quantity = 1) {
    const key = assertName(name);
    const q = assertQuantity(quantity);

    const existing = this._stacks.get(key);
    if (!existing) {
      throw new MissingItemError(`no "${key}" in the inventory`, {
        item: key,
        held: 0,
        requested: q,
      });
    }
    if (existing.quantity < q) {
      throw new MissingItemError(`cannot remove ${q} x "${key}": only ${existing.quantity} held`, {
        item: key,
        held: existing.quantity,
        requested: q,
      });
    }

    existing.quantity -= q;
    if (existing.quantity === 0) this._stacks.delete(key);
    return { name: key, weight: existing.weight, quantity: q };
  }

  /** Remove everything. */
  clear() {
    this._stacks.clear();
  }

  toString() {
    const body = this.items()
      .map((s) => `${s.quantity} x ${s.name} @ ${s.weight}`)
      .join(', ');
    return `Inventory(${this.totalWeight()}/${this.capacity}${body ? ': ' + body : ', empty'})`;
  }
}

module.exports = { Inventory, CapacityError, MissingItemError };

/* ------------------------------------------------------------------ *
 * Self-checking demo. Runs only when this file is executed directly.  *
 * ------------------------------------------------------------------ */

function runDemo() {
  const assert = require('node:assert/strict');

  let passed = 0;
  function check(label, fn) {
    fn();
    passed += 1;
    console.log(`PASS - ${label}`);
  }

  console.log('inventory.js self-check');
  console.log('-----------------------');

  check('a new inventory is empty and has its full capacity', () => {
    const inv = new Inventory(10);
    assert.equal(inv.totalWeight(), 0);
    assert.equal(inv.remainingCapacity(), 10);
    assert.equal(inv.size, 0);
    assert.deepEqual(inv.items(), []);
  });

  check('add() puts an item in and reports it back', () => {
    const inv = new Inventory(10);
    const stack = inv.add('rope', 2.5);
    assert.deepEqual(stack, { name: 'rope', weight: 2.5, quantity: 1 });
    assert.equal(inv.has('rope'), true);
    assert.equal(inv.quantityOf('rope'), 1);
  });

  check('totalWeight() sums unit weight times quantity', () => {
    const inv = new Inventory(50);
    inv.add('rope', 2.5, 2); // 5.0
    inv.add('lantern', 3, 1); // 3.0
    assert.equal(inv.totalWeight(), 8);
    assert.equal(inv.remainingCapacity(), 42);
    assert.equal(inv.itemCount(), 3);
    assert.equal(inv.size, 2);
  });

  check('repeated adds of the same item stack instead of duplicating', () => {
    const inv = new Inventory(50);
    inv.add('arrow', 0.1, 10);
    inv.add('arrow', 0.1, 5);
    assert.equal(inv.size, 1);
    assert.equal(inv.quantityOf('arrow'), 15);
    assert.equal(inv.totalWeight(), 1.5); // 15 * 0.1, no float drift
  });

  check('an add that exceeds the cap is refused and changes nothing', () => {
    const inv = new Inventory(10);
    inv.add('anvil', 8);
    assert.throws(() => inv.add('anvil', 8), CapacityError);
    assert.equal(inv.totalWeight(), 8, 'weight must be unchanged after refusal');
    assert.equal(inv.quantityOf('anvil'), 1, 'quantity must be unchanged after refusal');
  });

  check('a refused add reports the numbers that caused it', () => {
    const inv = new Inventory(10);
    inv.add('anvil', 8);
    try {
      inv.add('brick', 5, 2);
      assert.fail('expected a CapacityError');
    } catch (err) {
      assert.ok(err instanceof CapacityError);
      assert.equal(err.item, 'brick');
      assert.equal(err.attempted, 10);
      assert.equal(err.capacity, 10);
      assert.equal(err.remainingCapacity, 2);
    }
  });

  check('an add landing exactly on the cap is allowed', () => {
    const inv = new Inventory(10);
    inv.add('plank', 2.5, 4);
    assert.equal(inv.totalWeight(), 10);
    assert.equal(inv.remainingCapacity(), 0);
    assert.equal(inv.canFit(0.001), false);
    assert.equal(inv.canFit(0), true);
  });

  check('canFit() answers without mutating the inventory', () => {
    const inv = new Inventory(10);
    inv.add('rock', 6);
    assert.equal(inv.canFit(4), true);
    assert.equal(inv.canFit(4.5), false);
    assert.equal(inv.canFit(2, 2), true);
    assert.equal(inv.canFit(2, 3), false);
    assert.equal(inv.totalWeight(), 6);
  });

  check('remove() takes items out and frees the weight', () => {
    const inv = new Inventory(20);
    inv.add('ingot', 4, 3); // 12
    const removed = inv.remove('ingot', 2);
    assert.deepEqual(removed, { name: 'ingot', weight: 4, quantity: 2 });
    assert.equal(inv.quantityOf('ingot'), 1);
    assert.equal(inv.totalWeight(), 4);
    assert.equal(inv.remainingCapacity(), 16);
  });

  check('removing the last of an item drops it from the inventory', () => {
    const inv = new Inventory(20);
    inv.add('torch', 1, 2);
    inv.remove('torch', 2);
    assert.equal(inv.has('torch'), false);
    assert.equal(inv.size, 0);
    assert.equal(inv.totalWeight(), 0);
  });

  check('removing what you do not have is refused and changes nothing', () => {
    const inv = new Inventory(20);
    inv.add('coin', 0.01, 5);
    assert.throws(() => inv.remove('gem'), MissingItemError);
    assert.throws(() => inv.remove('coin', 6), MissingItemError);
    assert.equal(inv.quantityOf('coin'), 5, 'quantity must be unchanged after refusal');
    assert.equal(inv.totalWeight(), 0.05);
  });

  check('freeing weight makes room for an add that was refused before', () => {
    const inv = new Inventory(10);
    inv.add('anvil', 8);
    assert.throws(() => inv.add('shield', 5), CapacityError);
    inv.remove('anvil');
    const stack = inv.add('shield', 5);
    assert.deepEqual(stack, { name: 'shield', weight: 5, quantity: 1 });
    assert.equal(inv.totalWeight(), 5);
  });

  check('items() returns a sorted copy that cannot corrupt the inventory', () => {
    const inv = new Inventory(30);
    inv.add('zinc', 1);
    inv.add('apple', 1, 2);
    const listed = inv.items();
    assert.deepEqual(
      listed.map((s) => s.name),
      ['apple', 'zinc']
    );
    listed[0].quantity = 999;
    assert.equal(inv.quantityOf('apple'), 2, 'mutating the copy must not affect the inventory');
  });

  check('bad inputs are rejected with a TypeError', () => {
    assert.throws(() => new Inventory(-1), TypeError);
    assert.throws(() => new Inventory('heavy'), TypeError);
    const inv = new Inventory(10);
    assert.throws(() => inv.add('', 1), TypeError);
    assert.throws(() => inv.add('rope', -1), TypeError);
    assert.throws(() => inv.add('rope', NaN), TypeError);
    assert.throws(() => inv.add('rope', 1, 0), TypeError);
    assert.throws(() => inv.add('rope', 1, 1.5), TypeError);
    assert.equal(inv.size, 0);
  });

  check('the same name cannot be stored at two different unit weights', () => {
    const inv = new Inventory(10);
    inv.add('stone', 2);
    assert.throws(() => inv.add('stone', 3), TypeError);
    assert.equal(inv.quantityOf('stone'), 1);
    assert.equal(inv.totalWeight(), 2);
  });

  check('clear() empties the inventory and restores capacity', () => {
    const inv = new Inventory(10);
    inv.add('sand', 2, 4);
    inv.clear();
    assert.equal(inv.size, 0);
    assert.equal(inv.totalWeight(), 0);
    assert.equal(inv.remainingCapacity(), 10);
  });

  console.log('-----------------------');

  // A short walkthrough, so running the file also shows the thing working.
  const bag = new Inventory(12);
  bag.add('rope', 2.5, 2);
  bag.add('lantern', 3);
  bag.add('arrow', 0.1, 20);
  console.log(String(bag));
  try {
    bag.add('anvil', 8);
  } catch (err) {
    console.log(`refused as expected: ${err.message}`);
  }
  bag.remove('rope', 2);
  console.log(`after dropping the rope: ${bag.totalWeight()} / ${bag.capacity}`);

  console.log('-----------------------');
  console.log(`${passed}/${passed} checks passed`);
}

if (require.main === module) {
  runDemo();
}
