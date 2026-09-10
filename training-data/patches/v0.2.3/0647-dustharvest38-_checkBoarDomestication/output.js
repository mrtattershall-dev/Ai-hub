function _checkBoarDomestication() {
  if (_jgBoarDomesticated) return;
  if (_jgBoarNurseOffered) return;
  // Find a critically injured boar
  const weakBoar = enemies.find(e => e.type === 'jungleBoar' && e._isJungle && e.hp > 0 && e.hp <= 5);
  if (!weakBoar) return;
  const dist = Math.hypot(player.x - weakBoar.x, player.y - weakBoar.y);
  if (dist > 80) return;
  _jgBoarNurseOffered = true;
  showMsg('🐗 A boar is cornered and injured. [E] to approach it carefully.');
  gameState._nearWeakBoar = true;
  gameState._weakBoarId = weakBoar.id;
}