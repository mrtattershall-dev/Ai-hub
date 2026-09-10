function spawnAnimal(type, pen) {
  const def = ANIMAL_DEFS[type];
  // Random position inside pen bounds
  const ax = (pen.x + 1 + Math.random()*(pen.w-2)) * T + T/2;
  const ay = (pen.y + 1 + Math.random()*(pen.h-2)) * T + T/2;
  const animal = {
    id: animalIdCounter++,
    type, def,
    x: ax, y: ay,
    hp: def.hp, maxHp: def.maxHp,
    penId: pen.id,
    state: 'idle',       // idle | feeding | sleeping | panic
    stateTimer: 0,
    panicTimer: 0,
    facing: 'down',
    walkTimer: 0, walkFrame: 0,
    moveX: 0, moveY: 0,
    dirTimer: 1 + Math.random()*2,
    fedToday: false,
    productReady: false,
    productDaysCycle: 0, // counts days toward productRate
    lastProductDay: 0,
  };
  pen.animals.push(animal.id);
  animals.push(animal);
  return animal;
}