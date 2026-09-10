function bail() {
  elBailFlash.style.opacity='1';
  setTimeout(()=>{elBailFlash.style.opacity='0';},200);
  const bailDmg = shopState.kneePadsCharges > 0 ? 8 : 15;
  if (shopState.kneePadsCharges > 0) {
    shopState.kneePadsCharges--;
    toast('Knee pads absorbed impact. ' + shopState.kneePadsCharges + ' charges left', '');
  }
  player.bruise=Math.min(100,player.bruise+bailDmg);
  player.flow=Math.max(0,player.flow-30);
  player.comboScore=0; player.lastTricks=[];
  updateBruise();
  elComboScore.textContent='';
  updateFlow();
  trickDisplay.textContent='BAILED!';
  trickDisplay.style.opacity='1';
  clearTimeout(trickTimeout);
  trickTimeout=setTimeout(()=>{ trickDisplay.style.opacity='0'; },1200);
  player.vel.x*=0.3; player.vel.z*=0.3;
}