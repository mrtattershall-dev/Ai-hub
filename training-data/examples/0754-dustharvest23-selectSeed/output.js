function selectSeed(s) {
  _manualToolTimer = 8;
  player.selectedSeed = s; player.tool = 'plant';
  document.querySelectorAll('.sbtn').forEach(b=>b.classList.remove('sel'));
  document.querySelectorAll('.tbtn').forEach(b=>b.classList.remove('sel'));
  const map = { carrot:'seedCarrot', corn:'seedCorn', pumpkin:'seedPumpkin', glowroot:'seedGlowroot', tomato:'seedTomato', dustwheat:'seedDustwheat', sunblossom:'seedSunblossom', pepper:'seedPepper', melon:'seedMelon', potato:'seedPotato', lavender:'seedLavender', cactusFruit:'seedCactusFruit', blueberry:'seedBlueberry' };
  const _el2=document.getElementById(map[s]); if(_el2) _el2.classList.add('sel');
  buildHotbar();
}