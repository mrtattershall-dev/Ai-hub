function _tryNurseBoar() {
  if (!gameState._nearWeakBoar) return false;
  const boar = enemies.find(e => e.id === gameState._weakBoarId && e.hp > 0);
  if (!boar) { gameState._nearWeakBoar = false; return false; }
  // Remove from enemies (domesticate)
  enemies.splice(enemies.indexOf(boar), 1);
  gameState._nearWeakBoar = false;
  _jgBoarDomesticated = true;
  gameState._jgBoarDomesticated = true;
  jungleTalkSeen.add('boar_domesticated');
  showMsg('🐖 You stayed still. The boar held its ground. You held yours.');
  setTimeout(() => showMsg('🐖 It doesn\'t flee. It watches you. Maybe that\'s enough.'), 3500);
  setTimeout(() => showMsg('🐖 Forest Boar domesticated — build an enclosure in the cleared zone to house it.'), 7000);
  gainRep('jungle', 6);
  return true;
}