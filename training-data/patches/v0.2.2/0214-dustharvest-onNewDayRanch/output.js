function onNewDayRanch() {
  // Fix 6: Animal fertilizer synergy — owning animals passively boosts crop growth 15%
  const aliveCount = animals.filter(a => a.hp > 0).length;
  if (aliveCount > 0) {
    player._growMult = Math.max(player._growMult || 1, 1.15);
  }

  // Per-pen trough consumption
  const totalFeedCost = animals.reduce((s,a) => s + ANIMAL_DEFS[a.type].feedCost, 0);
  // Each pen feeds its own animals from its own trough
  pens.forEach(pen => {
    const penAnimals = animals.filter(a => a.penId === pen.id && a.hp > 0);
    const penCost = penAnimals.reduce((s,a) => s + ANIMAL_DEFS[a.type].feedCost, 0);
    // Copper Trough: -20% drain rate
    const actualCost = pen._copperTrough ? Math.ceil(penCost * 0.8) : penCost;
    const penUnfed = (pen.troughFill || 0) < actualCost;
    pen.troughFill = Math.max(0, (pen.troughFill || 0) - actualCost);
    penAnimals.forEach(a => {
      a.productDaysCycle++;
      const rate = ANIMAL_DEFS[a.type].productRate;
      if (!penUnfed && a.productDaysCycle >= rate && a.hp > 0 && a.state !== 'panic') {
        a.productReady = true;
        a.productDaysCycle = 0;
        // Happy animals (mood score 3) produce an extra item — well-fed is now mechanically rewarded
        const moodMult  = getAnimalProductMult(a);
        const baseProd  = player._barnLoft ? 2 : 1; // Barn Loft doubles base yield
        const prodCount = moodMult >= 1.2 ? baseProd + 1 : baseProd; // happy = +1 bonus item
        for (let _pi=0; _pi<prodCount; _pi++) {
          products.push({ id: animalIdCounter++, x: a.x + (_pi*T*0.5), y: a.y - T, type: a.type, icon: ANIMAL_DEFS[a.type].productIcon, animalId: a.id, despawnDay: gameState.day + 1 });
        }
      }
      a.fedToday = !penUnfed;
      if (penUnfed) a.hp = Math.max(1, a.hp - 1);
      if (a.state === 'panic') { a.state = 'idle'; a.panicTimer = 0; }
    });
    if (penUnfed && penAnimals.length > 0) {
      const icons = ANIMAL_ICONS;
      const penType = penAnimals[0]?.type;
      showMsg(`🪣 ${icons[penType]||'🐾'} Pen trough empty — animals unfed! Fill it with crops [E].`);
    }
  });
  // Products already despawned at noon — clear any stragglers just in case
  products = products.filter(p => p.despawnDay > gameState.day);

  // ── Sickness ──────────────────────────────────────────────────────────────
  // Animals get sick if: trough was empty 2+ consecutive days, or it's Cold Winter
  const isWinter = getCurrentSeason()?.name === 'Cold Winter';
  animals.filter(a => a.hp > 0).forEach(a => {
    const pen = getPenById(a.penId);
    const hungry = !a.fedToday || (pen && (pen.troughFill||0) < 10);
    if (hungry) a._hungryDays = (a._hungryDays||0) + 1;
    else a._hungryDays = 0;
    // Sick chance: 15% if hungry 2+ days, +10% in winter
    const sickChance = (a._hungryDays >= 2 ? 0.15 : 0) + (isWinter && hungry ? 0.10 : 0);
    if (!a.sick && sickChance > 0 && Math.random() < sickChance) {
      a.sick = true;
      showMsg(`🐾 ${ANIMAL_DEFS[a.type]?.icon||'🐾'} One of your ${a.type}s looks sick — it won't produce until treated. Use a Poultice near the pen.`);
    }
    // Sick animals lose HP slowly and can't produce
    if (a.sick) {
      a.hp = Math.max(1, a.hp - 1);
      a.productReady = false;
    }
  });

  // ── Breeding ──────────────────────────────────────────────────────────────
  // 2+ healthy same-type animals in same pen → 8% daily chance of a baby
  pens.forEach(pen => {
    const penAnimals = animals.filter(a => a.penId === pen.id && a.hp > 0 && !a.sick);
    const types = {};
    penAnimals.forEach(a => { types[a.type] = (types[a.type]||0) + 1; });
    Object.entries(types).forEach(([type, count]) => {
      if (count < 2) return;
      if (Math.random() > 0.08) return;
      // Check pen capacity
      const def = ANIMAL_DEFS[type];
      if (!def) return;
      if (penAnimals.length >= 6) return; // pen full
      // Spawn baby — starts with half HP, grows to full over 3 days
      const baby = {
        id: animalIdCounter++, type, penId: pen.id,
        x: pen.x * T + Math.random() * pen.w * T,
        y: pen.y * T + Math.random() * pen.h * T,
        hp: Math.ceil(def.maxHp / 2), maxHp: def.maxHp,
        speed: def.speed, state: 'idle', stateTimer: 1, dirTimer: 1,
        dx: 0, dy: 0, fedToday: false, productReady: false,
        productDaysCycle: 0, _baby: true, _babyDays: 0,
        _hungryDays: 0, sick: false,
      };
      animals.push(baby);
      stats.babiesBorn = (stats.babiesBorn||0) + 1;
      spawnParticles(baby.x, baby.y, '#80e060', 5, '🐣');
      showMsg(`🐣 A baby ${type} was born in your pen! It'll be full-grown in 3 days.`);
    });
  });

  // Grow babies
  animals.filter(a => a._baby).forEach(a => {
    a._babyDays = (a._babyDays||0) + 1;
    if (a._babyDays >= 3) {
      a._baby = false;
      a.hp = a.maxHp;
      showMsg(`🐾 Your baby ${a.type} is fully grown!`);
    }
  });

  updateRanchPanel();
}