function getBusted() {
  if (player.busted) return;
  player.busted=true; player.bustedTimer=3;
  player.vel.set(0,0,0);
  trickDisplay.textContent='🚫 BUSTED!';
  trickDisplay.style.opacity='1';
  clearTimeout(trickTimeout);
  trickTimeout=setTimeout(()=>{ trickDisplay.style.opacity='0'; },2500);
  player.academics=Math.max(0,player.academics-15);
  toast('Confiscated! Academics -15','danger');
  player.flow=0; updateFlow();
}