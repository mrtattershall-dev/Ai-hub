function showTitleScreen() {
  const ts = document.getElementById('titleScreen');
  ts.classList.add('show');
  if (hasSave()) {
    document.getElementById('continueBtn').disabled = false;
    document.getElementById('deleteSaveBtn').disabled = false;
    document.getElementById('saveInfo').textContent = '💾 ' + getSaveInfo();
  }
}