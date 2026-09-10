function deleteSave() {
  showConfirmModal('Delete your save? This cannot be undone.', function() {
    localStorage.removeItem(SAVE_KEY);
    document.getElementById('continueBtn').disabled = true;
    document.getElementById('deleteSaveBtn').disabled = true;
    document.getElementById('saveInfo').textContent = 'No save found';
  });
}