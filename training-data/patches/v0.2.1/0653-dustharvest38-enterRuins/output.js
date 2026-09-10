function enterRuins() {
  if (!_ruinsMapBuilt) buildRuinsMap();
  gameState.inRuins  = true;
  gameState.inJungle = false;
  player.x = 19.5 * RU_T;
  player.y = 2    * RU_T;
  _revealRuinsArea(19, 2, 5);
  if (!jungleTalkSeen.has('ruins_first_entry')) {
    jungleTalkSeen.add('ruins_first_entry');
    showMsg('🏚 The Altaverde processing facility. Abandoned in a hurry. Some of their equipment is still here.');
    setTimeout(() => showMsg('⚓ Compliance Level raised — you\'re in a restricted area.'), 1500);
    raiseCompliance('ruinsEntry');
  }
}