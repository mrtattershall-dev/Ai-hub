function showEndingScreen() {
  const screen = document.getElementById('endingScreen');
  const canvas = document.getElementById('endingCanvas');
  if (!screen || !canvas) return;

  screen.classList.add('show');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx2 = canvas.getContext('2d');

  // Stats
  const statsEl = document.getElementById('endingStats');
  if (statsEl) statsEl.innerHTML = `
    Day ${gameState.day} &nbsp;·&nbsp; $${player.gold.toLocaleString()} saved &nbsp;·&nbsp; ${completedContracts.length} contracts fulfilled
  `;

  const textEl = document.getElementById('endingText');
  if (textEl) textEl.textContent = `"You came out here with a hoe and a debt. The railroad took everything else. But this dust — this patch of nothing — turned out to be enough. The land is paid for. It's yours now, ${player.name||'Stranger'}. It always was."`;

  // Staggered reveals
  setTimeout(() => document.getElementById('endingDeco').classList.add('vis'), 200);
  setTimeout(() => document.getElementById('endingTitle').classList.add('vis'), 800);
  setTimeout(() => document.getElementById('endingSubtitle').classList.add('vis'), 1400);
  setTimeout(() => { statsEl.classList.add('vis'); }, 2000);
  setTimeout(() => { textEl.classList.add('vis'); }, 2600);
  setTimeout(() => document.getElementById('endingContinue').classList.add('vis'), 3400);

  // Starfield particle animation
  const stars = Array.from({length:120}, () => ({
    x: Math.random()*canvas.width, y: Math.random()*canvas.height,
    r: .5+Math.random()*1.5, op: .2+Math.random()*.8, speed: .2+Math.random()*.6
  }));
  let endAnim;
  function drawEnding() {
    endAnim = requestAnimationFrame(drawEnding);
    ctx2.fillStyle = 'rgba(6,3,0,0.12)';
    ctx2.fillRect(0,0,canvas.width,canvas.height);
    for (const s of stars) {
      s.y -= s.speed;
      if (s.y < 0) { s.y = canvas.height; s.x = Math.random()*canvas.width; }
      ctx2.beginPath();
      ctx2.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx2.fillStyle = `rgba(240,200,80,${s.op})`;
      ctx2.fill();
    }
  }
  drawEnding();

  // Play a triumphant tone
  dSound('victory');

  document.getElementById('endingContinue').addEventListener('click', () => {
    cancelAnimationFrame(endAnim);
    ctx2.clearRect(0,0,canvas.width,canvas.height);
    screen.classList.remove('show');
    showMsg(`🌵 The land is yours. Keep going, ${player.name||'Stranger'}.`);
    // Unlock post-ending goals
    gameState._postEnding = true;
    setTimeout(() => {
      showMsg('📜 New goals unlocked — check your Stats screen. The frontier isn\'t done with you yet.');
    }, 3000);
  }, { once: true });
}