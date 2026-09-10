function openSaveSlotModal(mode) {
  _slotModalMode = mode;
  const modal = document.getElementById('saveSlotModal');
  document.getElementById('saveSlotTitle').textContent = mode === 'new' ? 'NEW GAME — CHOOSE SLOT' : 'CONTINUE — CHOOSE SLOT';
  document.getElementById('saveSlotSubtitle').textContent = mode === 'new' ? 'Existing saves will be overwritten' : 'Select a save to load';
  refreshSaveSlotUI();
  modal.style.display = 'flex';
}