function updateHeatHUD() {
  const el = document.getElementById('blHeatHUD');
  if (!el) return;
  if (!gameState.inBadlands) { el.style.display = 'none'; return; }
  const tier = getHeatTier();
  const pct = (blHeat / BL_HEAT_MAX * 100).toFixed(0);
  el.style.display = 'block';
  el.style.borderColor = tier.border;
  el.innerHTML = `
    <div style="font-size:8px;color:#6a4020;letter-spacing:.08em;text-transform:uppercase;margin-bottom:2px">🔥 HEAT</div>
    <div style="font-size:12px;font-weight:bold;color:${tier.color};letter-spacing:.06em">${tier.label}</div>
    <div style="width:80px;height:3px;background:rgba(255,255,255,.08);border-radius:2px;margin-top:3px">
      <div style="height:3px;border-radius:2px;background:${tier.color};width:${pct}%;transition:width .3s"></div>
    </div>
    <div style="font-size:8px;color:#6a4020;margin-top:2px">${blHeat}/${BL_HEAT_MAX} · ×${tier.lootMult.toFixed(1)} loot</div>`;
}