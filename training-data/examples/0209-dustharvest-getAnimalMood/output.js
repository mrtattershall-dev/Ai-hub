function getAnimalMood(animal) {
  if (animal.hp <= 0) return { icon:'💀', label:'Dead', score:0 };
  if (animal.sick)    return { icon:'🤒', label:'Sick — needs Poultice', score:0 };
  if (animal._baby)   return { icon:'🐣', label:`Baby (${3-(animal._babyDays||0)}d)`, score:2 };
  if (animal.state === 'panic') return { icon:'😨', label:'Panicked', score:0 };
  const pen = getPenById(animal.penId);
  const penTrough = pen ? (pen.troughFill || 0) : 0;
  if (!animal.fedToday || penTrough < 15) return { icon:'😟', label:'Hungry', score:1 };
  if (penTrough < 40) return { icon:'😐', label:'Content', score:2 };
  return { icon:'😊', label:'Happy', score:3 };
}