function charPreviewFacing(f) {
  window._ccPreviewFacing = f;
  // Highlight active button
  ['down','up','left','right'].forEach(d => {
    const btn = document.getElementById('cpf'+d.charAt(0).toUpperCase()+d.slice(1));
    if (btn) {
      btn.style.background = d===f ? 'rgba(140,100,30,.2)' : 'rgba(80,60,20,.1)';
      btn.style.borderColor = d===f ? 'rgba(140,100,30,.5)' : 'rgba(95,75,36,.3)';
      btn.style.color = d===f ? '#c8a040' : '#907040';
    }
  });
  refreshCharPreview();
}