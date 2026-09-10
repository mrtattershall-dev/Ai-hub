function selectTool(t, auto=false) {
  if (!auto) _manualToolTimer = 8; // 8 seconds of manual override
  player.tool = t;
  document.querySelectorAll('.tbtn').forEach(b=>b.classList.remove('sel'));
  const map = { till:'toolTill', water:'toolWater', harvest:'toolHarvest' };
  const _el1=document.getElementById(map[t]); if(_el1) _el1.classList.add('sel');
  buildHotbar();
}