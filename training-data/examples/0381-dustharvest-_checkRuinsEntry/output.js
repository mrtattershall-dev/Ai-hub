function _checkRuinsEntry() {
  if (!gameState.inJungle) return;
  const ptx = Math.floor(player.x / JG_T);
  const pty = Math.floor(player.y / JG_T);
  const inRuins = ptx >= JG_RUINS_X1 && ptx <= JG_RUINS_X2 &&
                  pty >= JG_RUINS_Y1 && pty <= JG_RUINS_Y2;
  if (inRuins && !_ruinsEntryFired) {
    _ruinsEntryFired = true;
    raiseCompliance('ruinsEntry');
    if (!jungleTalkSeen.has('ruins_first_entry')) {
      jungleTalkSeen.add('ruins_first_entry');
      showMsg('🏚 The Altaverde processing facility. Abandoned in a hurry. Some of their equipment is still here.');
      showMsg('⚓ Compliance Level raised — you\'re in a restricted area.');
    }
  }
  if (!inRuins) _ruinsEntryFired = false;
}