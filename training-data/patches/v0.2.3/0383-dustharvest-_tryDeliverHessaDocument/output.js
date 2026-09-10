function _tryDeliverHessaDocument() {
  if (!gameState._hessaDeliveryOffered) return false;
  if (gameState._hollowedQuestStage !== 3) return false;
  if (!countItem('hollowedLandPromise')) {
    showMsg('💀 You don\'t have the land promise document.');
    return false;
  }

  // Remove the document
  removeItem('hollowedLandPromise', 1);
  gameState._hessaDeliveryOffered = false;

  // Fire the full resolution sequence (delayed for dramatic weight)
  const beats = [
    [0,    '💀 You hand her the document.'],
    [2200, '💀 She reads it. All of it. Twice.'],
    [5500, '💀 Hessa: "Dated. Witnessed. Signed by Voss himself."'],
    [8800, '💀 "They promised us the territory back. In writing. Then they cleared it anyway."'],
    [12000,'💀 "We tried to fight it without the paper. You can\'t fight a company without paper."'],
    [15500,'💀 "Now we have the paper."'],
    [18500,'💀 A long silence. She folds it carefully.'],
    [21000,'💀 Hessa: "I don\'t trust outsiders. I want to be honest with you about that."'],
    [24500,'💀 "But this changes what we can do together. The three groups — us, Kit\'s settlement, the Verdant Court."'],
    [28000,'💀 "Together we have standing. The bond becomes legally contestable."'],
    [31500,'💀 "It takes time. It takes everyone. But it\'s possible now."'],
    [34500,'💀 She meets your eyes. "Don\'t make me regret this."'],
    [37500,'✓ The Hollowed are now allies.'],
  ];

  beats.forEach(([delay, msg]) => {
    setTimeout(() => showMsg(msg, 4000), delay);
  });

  // Call the Slice 14 stub after the sequence concludes
  setTimeout(() => {
    _onHollowedAllied();
    _applyHollowedAllyConsequences();
  }, 38000);

  return true;
}