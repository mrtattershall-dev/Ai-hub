function _onHollowedAllied() {
  gameState._hollowedQuestStage = 4;
  setHollowedState('allied');
  gainRep('hollowed', 30);
  jungleTalkSeen.add('hollowed_allied');
  showMsg('💀 Hessa reads it slowly. Doesn\'t speak for a long time.');
  showMsg('💀 "This changes what we can do together. This changes the paper."');
  showMsg('💀 The Hollowed are allies. Hessa knows the jungle better than anyone. She knows what the ruins really are.');
}