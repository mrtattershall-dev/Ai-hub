function setStatsTab(tab) {
  _statsTab = tab;
  const statsBtn   = document.getElementById('statsTabStats');
  const journalBtn = document.getElementById('statsTabJournal');
  if (statsBtn) {
    statsBtn.style.borderBottomColor   = tab === 'stats'   ? 'var(--rust)' : 'transparent';
    statsBtn.style.color               = tab === 'stats'   ? '#d4b870' : 'rgba(180,140,60,.45)';
  }
  if (journalBtn) {
    journalBtn.style.borderBottomColor = tab === 'journal' ? 'var(--rust)' : 'transparent';
    journalBtn.style.color             = tab === 'journal' ? '#d4b870' : 'rgba(180,140,60,.45)';
  }
  const body = document.getElementById('statsBody');
  if (!body) return;
  if (tab === 'journal') {
    body.innerHTML = renderJournalTab();
  } else {
    renderStatsPage();
  }
}