function saveGame(silent=false) {
  try {
    const data = JSON.stringify(getSaveData());
    // Write backup before overwriting
    const existing = localStorage.getItem(saveKey());
    if (existing) localStorage.setItem(backupKey(), existing);
    localStorage.setItem(saveKey(), data);
    if (!silent) {
      const notif = document.getElementById('saveNotif');
      const ns = document.getElementById('saveNotifSlot'); if (ns) ns.textContent = window._activeSaveSlot || 1;
      notif.classList.add('show');
      setTimeout(() => notif.classList.remove('show'), 2000);
      dSound('save');
    }
  } catch(e) { showMsg('⚠️ Save failed: ' + e.message); }
}