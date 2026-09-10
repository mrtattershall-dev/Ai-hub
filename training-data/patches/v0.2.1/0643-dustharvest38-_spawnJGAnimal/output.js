function _spawnJGAnimal(type, enc) {
  const def = JG_ANIMAL_DEFS[type];
  jgAnimals.push({
    id: _jgAnimalIdCounter++,
    type, def,
    enclosureId: enc.id,
    hp: def.hp,
    productDays: 0,
    product2Days: 0,
    fedToday: false,
    sick: false,
    _hungryDays: 0,
    // Render
    x: (enc.tx + 1.5) * JG_T + (Math.random() - 0.5) * JG_T,
    y: (enc.ty + 2)   * JG_T,
    facing: 'right',
    walkTimer: 0, walkFrame: 0,
    moveTimer: 2 + Math.random() * 3,
    moveX: 0, moveY: 0,
  });
  enc.animalCount = jgAnimals.filter(a => a.enclosureId === enc.id && a.hp > 0).length;
  return jgAnimals[jgAnimals.length - 1];
}