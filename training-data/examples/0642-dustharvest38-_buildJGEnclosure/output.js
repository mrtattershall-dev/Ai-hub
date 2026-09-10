function _buildJGEnclosure(type) {
  const def = JG_ANIMAL_DEFS[type];
  if (!def) return null;
  if (type === 'forestBoar' && !_jgBoarDomesticated) {
    showMsg('🐖 Forest Boar must be domesticated first. Capture a wild boar.');
    return null;
  }
  if (def.buyCost > 0 && player.gold < def.buyCost) {
    showMsg(`⚠ Need $${def.buyCost} to acquire a ${def.name}.`);
    return null;
  }
  const slot = _getAvailableEnclosureSlot();
  if (!slot) { showMsg('⚠ No enclosure slots available in the cleared zone.'); return null; }
  if (def.buyCost > 0) { player.gold -= def.buyCost; trackGoldEarned && trackGoldEarned(-def.buyCost); }
  const enc = {
    id: _jgEnclosureIdCounter++,
    tx: slot.tx, ty: slot.ty,
    type, troughFill: 40,
    animalCount: 1,
  };
  jgEnclosures.push(enc);
  // Stamp fence tiles on map
  for (let dy = 0; dy < 4; dy++) {
    for (let dx = 0; dx < 4; dx++) {
      const onEdge = dx === 0 || dx === 3 || dy === 0 || dy === 3;
      setJGT(slot.tx + dx, slot.ty + dy, onEdge ? JG.WALL : JG.DIRT);
    }
  }
  // Gate
  setJGT(slot.tx + 1, slot.ty, JG.FLOOR);
  setJGT(slot.tx + 2, slot.ty, JG.FLOOR);

  // Spawn the animal
  _spawnJGAnimal(type, enc);
  showMsg(`${def.icon} ${def.name} enclosure built in the cleared zone.`);
  return enc;
}