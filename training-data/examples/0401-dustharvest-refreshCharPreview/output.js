function refreshCharPreview() {
  const canvas = document.getElementById('charPreviewCanvas');
  if (!canvas) return;
  const ctx2 = canvas.getContext('2d');
  ctx2.clearRect(0,0,96,120);

  // Dark ground
  ctx2.fillStyle = '#1a1510';
  ctx2.fillRect(0,0,96,120);
  // Subtle ground shadow
  ctx2.fillStyle = 'rgba(0,0,0,0.4)';
  ctx2.beginPath(); ctx2.ellipse(48,102,14,5,0,0,Math.PI*2); ctx2.fill();

  const d = window._ccDraft;
  const facing = window._ccPreviewFacing || 'down';
  const wf = window._ccPreviewFrame || 0;

  drawCharacter(ctx2, 48, 96, facing, wf, false, d);
}