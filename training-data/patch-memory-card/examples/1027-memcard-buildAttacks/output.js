function buildAttacks(prog) {
  const L = COMBAT.lightDamage;
  const light = (i, extra = {}) => ({
    reach: 8, width: 56, height: 48, yOffset: -4,
    damage: L + (extra.bonus ?? 0), knockback: extra.knockback ?? 150,
    type: "light", dur: extra.dur ?? 0.26, active: extra.active ?? [0.05, 0.15],
    sfx: "light", style: extra.style ?? 8, launch: extra.launch ?? 0,
  });
  const chain = [
    light(0),
    light(1, { active: [0.04, 0.13], dur: 0.24 }),
    light(2, { bonus: 6, knockback: 300, style: 14, dur: 0.34, active: [0.06, 0.18] }),
  ];
  if (prog.comboMax() >= 5) {
    chain.push(light(3, { active: [0.04, 0.12], dur: 0.22 }));
    chain.push(light(4, { bonus: 10, knockback: 360, launch: -260, style: 20, dur: 0.4, active: [0.07, 0.2] }));
  }
  return {
    chain,
    heavy: {
      reach: 10, width: 66, height: 62, yOffset: -6,
      damage: COMBAT.heavyDamage, knockback: 220, launch: -560,
      type: "heavy", dur: 0.44, active: [0.13, 0.26], sfx: "heavy", style: 18,
    },
    air: {
      reach: 8, width: 60, height: 52, yOffset: 0,
      damage: COMBAT.lightDamage + 2, knockback: 180, launch: 0,
      type: "air", dur: 0.3, active: [0.05, 0.18], sfx: "light", style: 10,
    },
    slam: {
      reach: 0, width: 84, height: 56, yOffset: 18,
      damage: COMBAT.slamDamage, knockback: 260, launch: 0,
      type: "slam", dur: 0.2, active: [0, 0.18], sfx: "slam", style: 22,
    },
  };
}