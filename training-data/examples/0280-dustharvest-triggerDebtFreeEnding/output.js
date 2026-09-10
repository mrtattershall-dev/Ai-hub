function triggerDebtFreeEnding() {
  if (endingFired) {
    showMsg(`🎉 ALL WEEKLY PAYMENTS CLEARED! The land is truly yours, ${player.name||'Stranger'}.`);
    return;
  }
  endingFired = true;

  // Particle shower
  for (let i = 0; i < 40; i++) {
    setTimeout(() => {
      spawnParticles(
        player.x + (Math.random()-0.5)*300,
        player.y + (Math.random()-0.5)*200,
        ['#f0d060','#60d040','#e07050','#80c0ff'][Math.floor(Math.random()*4)],
        3, ['🌟','✨','🎉','💰'][Math.floor(Math.random()*4)]
      );
    }, i * 80);
  }

  // Show ending screen after brief delay
  setTimeout(() => showEndingScreen(), 1200);
}