function _tickJGAnimalsDawn() {
  if (typeof gameState._jgDebt === 'undefined') return; // not in jungle arc
  if (!jgAnimals.length && !jgEnclosures.length) return;

  for (const enc of jgEnclosures) {
    const encAnimals = jgAnimals.filter(a => a.enclosureId === enc.id && a.hp > 0);
    const def = JG_ANIMAL_DEFS[enc.type];
    if (!def) continue;

    // Trough feed consumption
    const feedCost = encAnimals.reduce((s, a) => s + def.feedCost, 0);
    const unfed = (enc.troughFill || 0) < feedCost;
    enc.troughFill = Math.max(0, (enc.troughFill || 0) - feedCost);

    if (unfed && encAnimals.length > 0) {
      showMsg(`🪣 ${def.icon} ${def.name} enclosure trough empty — animals unfed!`);
    }

    // Group bonus check (Parrot)
    const groupBonus = def.groupBonus && encAnimals.length >= def.groupMin;

    // Silk moth adjacency check
    let adjacencyOk = true;
    if (def.adjacencyRequired) {
      adjacencyOk = false;
      const plants = def.adjacencyPlants;
      for (const [key, plot] of Object.entries(jgPlots)) {
        if (!plot.crop || !plants.includes(plot.crop)) continue;
        const [ptx, pty] = key.split(',').map(Number);
        if (Math.abs(ptx - enc.tx) <= 3 && Math.abs(pty - enc.ty) <= 3) {
          adjacencyOk = true;
          break;
        }
      }
      if (!adjacencyOk) showMsg(`🦋 Silk Moth needs Heartleaf or Cane Reed within 3 tiles to produce.`);
    }

    for (const animal of encAnimals) {
      animal.fedToday = !unfed;
      if (unfed) {
        animal.hp = Math.max(1, animal.hp - 1);
        animal._hungryDays = (animal._hungryDays || 0) + 1;
        continue;
      }
      animal._hungryDays = 0;

      // Primary product
      animal.productDays++;
      if (animal.productDays >= def.productRate && adjacencyOk) {
        animal.productDays = 0;
        const qty = groupBonus ? 2 : 1;
        addItem(def.product, qty);
        spawnParticles(animal.x, animal.y, '#70c080', 3, def.productIcon);

        // Parrot group message
        if (groupBonus) showMsg(`🦜 Flock bonus — ${qty}× feathers collected!`);

        // Jungle compost — certain animals produce compost as by-product
        if (def.compostRate > 0 && Math.random() < def.compostRate) {
          addItem('jungleCompost', 1);
        }
      }

      // Secondary product (tortoise egg, boar compost)
      if (def.product2 && def.productRate2) {
        animal.product2Days++;
        if (animal.product2Days >= def.productRate2) {
          animal.product2Days = 0;
          addItem(def.product2, 1);
          spawnParticles(animal.x, animal.y, '#c0e080', 2, def.productIcon2);
        }
      }
    }
  }
}