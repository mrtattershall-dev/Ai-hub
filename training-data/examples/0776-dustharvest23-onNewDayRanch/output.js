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
    const penUnfed = (pen.troughFill || 0) < penCost;
    pen.troughFill = Math.max(0, (pen.troughFill || 0) - penCost);
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
  updateRanchPanel();
}