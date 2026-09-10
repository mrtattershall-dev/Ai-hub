function updateStormOverlay() {
  const ov = document.getElementById('stormOverlay');
  if (gameState.stormActive && !gameState.stormSheltering) {
    ov.style.display='block';
    ov.style.background='rgba(180,140,60,0.22)';
    ov.style.backdropFilter='blur(1px)';
  } else {
    ov.style.display='none';
  }
}