function ccSet(key, val) {
  window._ccDraft[key] = val;
  // Reset hair/shirt style to 0 on gender change so index stays valid
  if (key === 'gender') {
    window._ccDraft.hairStyle  = 0;
    window._ccDraft.shirtStyle = 0;
    _buildCCRows();
  }
  _updateCCSelections();
  refreshCharPreview();
}