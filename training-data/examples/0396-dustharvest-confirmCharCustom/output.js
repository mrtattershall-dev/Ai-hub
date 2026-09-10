function confirmCharCustom() {
  const d = window._ccDraft;
  player.name       = (document.getElementById('ccName').value.trim() || 'Stranger').slice(0,16);
  player.gender     = d.gender;
  player.skinTone   = d.skinTone;
  player.hairStyle  = d.hairStyle;
  player.hairColor  = d.hairColor;
  player.shirtStyle = d.shirtStyle;
  player.shirtColor = d.shirtColor;
  player.pantsColor = d.pantsColor;
  player.hatColor   = d.hatColor;
  document.getElementById('charCustomModal').style.display = 'none';
  if (_ccPreviewTimer) { clearInterval(_ccPreviewTimer); _ccPreviewTimer = null; }
  startNewGame();
}