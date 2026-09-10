function _checkRuinsDocuments() {
  if (!gameState.inJungle) return;
  const ptx = Math.floor(player.x / JG_T);
  const pty = Math.floor(player.y / JG_T);

  for (const doc of JG_EVIDENCE_DOCS) {
    if (gameState._jgFoundDocs.has(doc.id)) continue;
    if (Math.abs(ptx - doc.tx) > 1 || Math.abs(pty - doc.ty) > 1) continue;
    // Player is adjacent — find it automatically on proximity
    gameState._jgFoundDocs.add(doc.id);
    gainRep('jungle', doc.repJungle);
    gainRep('hollowed', doc.repHollowed);
    // Show document text as a series of messages
    doc.text.forEach((line, i) => {
      setTimeout(() => showMsg(line, 3500), i * 3600);
    });
    setTimeout(() => {
      if (doc.onFind) doc.onFind();
      if (doc.goldValue > 0) {
        player.gold += doc.goldValue;
        spawnParticles(player.x, player.y, '#f0d060', 4, '+$' + doc.goldValue);
      }
    }, doc.text.length * 3600 + 200);
    break; // one doc per frame
  }
}