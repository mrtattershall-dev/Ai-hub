function switchTab(tab) {
  app.tab = tab;
  ['concept','ai','score'].forEach(t => {
    document.getElementById('panel' + t.charAt(0).toUpperCase() + t.slice(1)).classList.toggle('hidden', t !== tab);
    document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1)).classList.toggle('active', t === tab);
  });
  document.getElementById('chatInputArea').style.display = tab === 'ai' ? 'flex' : 'none';
  if (tab === 'score') updateProgress();
}