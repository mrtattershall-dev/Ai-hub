function _addAnimalToEnclosure(enclosureId) {
  const enc = jgEnclosures.find(e => e.id === enclosureId);
  if (!enc) return;
  const def = JG_ANIMAL_DEFS[enc.type];
  const count = jgAnimals.filter(a => a.enclosureId === enclosureId && a.hp > 0).length;
  if (count >= 6) { showMsg('⚠ Enclosure full (max 6).'); return; }
  if (def.buyCost > 0 && player.gold < def.buyCost) {
    showMsg(`⚠ Need $${def.buyCost} to add another ${def.name}.`);
    return;
  }
  if (def.buyCost > 0) player.gold -= def.buyCost;
  _spawnJGAnimal(enc.type, enc);
  showMsg(`${def.icon} Added another ${def.name}.`);
}