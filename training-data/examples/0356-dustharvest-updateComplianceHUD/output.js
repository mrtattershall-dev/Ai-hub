function updateComplianceHUD() {
  const el = document.getElementById('jgComplianceHUD');
  if (!el) return;
  if (!gameState.inJungle) { el.style.display = 'none'; return; }

  const tier = getComplianceTier();
  const lvl  = gameState._complianceLevel || 0;
  const pct  = Math.min(100, (lvl / JG_COMPLIANCE_MAX) * 100).toFixed(0);

  el.style.display  = 'block';
  el.style.borderColor = tier.border;

  el.innerHTML = `
    <div style="font-size:8px;color:#405870;letter-spacing:.08em;text-transform:uppercase;margin-bottom:2px">⚓ COMPLIANCE</div>
    <div style="font-size:11px;font-weight:bold;color:${tier.color};letter-spacing:.05em;line-height:1.2">${tier.label}</div>
    <div style="width:90px;height:3px;background:rgba(255,255,255,.07);border-radius:2px;margin-top:3px">
      <div style="height:3px;border-radius:2px;background:${tier.color};width:${pct}%;transition:width .4s"></div>
    </div>
    <div style="font-size:7.5px;color:#304050;margin-top:2px;font-style:italic">${tier.sublabel}</div>`;
}