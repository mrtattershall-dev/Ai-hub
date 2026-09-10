function _applyHollowedAllyConsequences() {
  // 1. Raids permanently stop (already handled by getHollowedState !== 'hostile')
  // 2. Legal paper scaffolding
  gameState._hollowedPaperFiled = true;

  // 3. Compliance Level drops significantly — Hollowed actively obscure patrol routes
  if (typeof gameState._complianceLevel !== 'undefined') {
    gameState._complianceLevel = Math.max(0, gameState._complianceLevel - 1.5);
    updateComplianceHUD();
  }

  // 4. Jungle rep boost
  gainRep('jungle', 20);

  // 5. Tobias gets a note from Hessa's people
  setTimeout(() => {
    showMsg('⚓ Tobias: "Word reached me. Whatever you did — Hessa\'s people stopped cutting the freight routes."');
    showMsg('⚓ "There\'s a legal angle here. If the Verdant Court comes on board too, the bond becomes a paper problem. Paper problems can be solved with paper."');
    showMsg('⚓ "I\'ve done it before. Different company, same playbook." He pauses. "Find the Court."');
  }, 4000);

  // 6. Kit response — fires next time player talks to Kit
  jungleTalkSeen.add('hollowed_allied_notify_kit');
}