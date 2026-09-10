function _onHollowedDocumentFound() {
  gameState._hollowedPromise    = true;
  gameState._hollowedQuestStage = 3;
  gainRep('hollowed', 15);
  showMsg('📄 Altaverde\'s original land promise to the Hollowed. In writing. Dated and signed.');
  showMsg('💀 Hessa doesn\'t know you have this yet. She will.');
  jungleTalkSeen.add('hollowed_document_found');
}