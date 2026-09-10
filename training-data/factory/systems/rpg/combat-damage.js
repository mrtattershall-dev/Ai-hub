/**
 * RPG combat: a Health pool, a DamageCalculator that turns attacker/defender stats into a
 * final damage number with armor mitigation and deterministic crits, and a CombatSystem
 * that applies a strike and reports kills. The calculator is pure; the combat system owns
 * the side effects.
 */
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

class Health {
  constructor(max) { this.max = max; this.current = max; }
  damage(n) { this.current = Math.max(0, this.current - n); return this.current; }
  heal(n) { this.current = Math.min(this.max, this.current + n); return this.current; }
  get dead() { return this.current <= 0; }
}

class DamageCalculator {
  compute(attacker, defender, roll) {                 // roll in [0,1)
    const raw = Math.max(1, attacker.attack - Math.floor(defender.defense / 2));
    return roll >= attacker.critAt ? raw * 2 : raw;
  }
}

class CombatSystem {
  constructor(calc) { this.calc = calc; this.log = []; }
  strike(attacker, defender, defenderHealth, roll = 0) {
    const dmg = this.calc.compute(attacker, defender, roll);
    defenderHealth.damage(dmg);
    const killed = defenderHealth.dead;
    this.log.push({ dmg, killed });
    return { dmg, killed };
  }
}

// --- self-checking demo ---
const calc = new DamageCalculator();
const combat = new CombatSystem(calc);
const orc = { attack: 10, defense: 4, critAt: 0.9 };
const knight = { attack: 8, defense: 6, critAt: 0.9 };
const knightHp = new Health(30);

let r = combat.strike(orc, knight, knightHp, 0.1);
assert(r.dmg === 7, 'normal damage = attack - floor(defense/2)');     // 10 - 3
assert(knightHp.current === 23, 'health drops by the damage dealt');
r = combat.strike(orc, knight, knightHp, 0.95);
assert(r.dmg === 14, 'a crit doubles the damage');
assert(knightHp.current === 9, 'health now reduced to 9');
r = combat.strike(orc, knight, knightHp, 0.95);
assert(r.killed && knightHp.dead, 'a lethal blow reports a kill');
console.log('rpg/combat-damage OK');
