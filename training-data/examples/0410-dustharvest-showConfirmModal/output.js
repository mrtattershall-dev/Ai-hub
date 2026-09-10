function showConfirmModal(msg, onConfirm) {
  _confirmCallback = onConfirm;
  document.getElementById('confirmMsg').textContent = msg;
  const modal = document.getElementById('confirmModal');
  modal.style.display = 'flex';
  document.getElementById('confirmYes').onclick = function() {
    const cb = _confirmCallback;
    hideConfirmModal();
    if (cb) cb();
  };
}