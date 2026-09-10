function openCharCustomModal() {
  // Copy current player customization into draft
  window._ccDraft = {
    name:       player.name       || 'Stranger',
    gender:     player.gender     || 'male',
    skinTone:   player.skinTone   || 0,
    hairStyle:  player.hairStyle  || 0,
    hairColor:  player.hairColor  || 1,
    shirtStyle: player.shirtStyle || 0,
    shirtColor: player.shirtColor || 0,
    pantsColor: player.pantsColor || 0,
    hatColor:   player.hatColor   || 0,
  };
  window._ccPreviewFacing = 'down';
  window._ccPreviewFrame  = 0;

  const modal = document.getElementById('charCustomModal');
  modal.style.display = 'flex';
  document.getElementById('ccName').value = window._ccDraft.name;

  _buildCCRows();
  _updateCCSelections();

  // Animate walk frames
  if (_ccPreviewTimer) clearInterval(_ccPreviewTimer);
  _ccPreviewTimer = setInterval(() => {
    window._ccPreviewFrame = (window._ccPreviewFrame + 1) % 4;
    refreshCharPreview();
  }, 220);

  refreshCharPreview();
}