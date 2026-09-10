function saveGame(silent=false) {
  try {
    const data = JSON.stringify(getSaveData());
    // Write backup before overwriting
    const existing = localStorage.getItem(SAVE_KEY);
    if (existing) localStorage.setItem(SAVE_BACKUP_KEY, existing);
    localStorage.setItem(SAVE_KEY, data);
    if (!silent) {
      const notif = document.getElementById('saveNotif');
      notif.classList.add('show');
      setTimeout(() => notif.classList.remove('show'), 2000);
      dSound('save');
    }
  } catch(e) { showMsg('⚠️ Save failed: ' + e.message); }
}