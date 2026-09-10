function openBLBountyBoard() {
  blBountyBoardOpen = true;
  const ov = document.getElementById('blBountyOverlay');
  if (!ov) return;
  let h = `<div style="font-size:11px;color:#e09040;margin-bottom:6px;letter-spacing:.06em">📋 WANTED BOARD — BADLANDS</div>`;
  h += `<div style="font-size:8px;color:#705030;margin-bottom:10px">Collect bounties to earn gold. Kills count during your current visit.</div>`;
  blBounties.forEach((b, i) => {
    const pct = Math.min(100, Math.round(b.progress / b.qty * 100));
    const canClaim = b.complete;
    h += `<div style="padding:9px 10px;margin-bottom:6px;background:rgba(255,255,255,${canClaim ? '.06' : '.02'});border:1px solid rgba(180,100,20,${canClaim ? '.4' : '.18'});border-radius:4px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">
        <span style="font-size:10px;color:#e0a040;font-weight:bold">${b.icon} ${b.label}</span>
        <span style="font-size:11px;color:#f0d060">$${b.reward}</span>
      </div>
      <div style="font-size:8px;color:#907050;margin-bottom:5px">${b.desc}</div>
      <div style="display:flex;align-items:center;gap:7px">
        <span style="font-size:8px;color:#a07040">${b.progress}/${b.qty}</span>
        <div style="flex:1;height:4px;background:rgba(255,255,255,.08);border-radius:2px">
          <div style="height:4px;border-radius:2px;background:${canClaim?'#60d040':'#c09040'};width:${pct}%"></div>
        </div>
        ${canClaim ? `<button onclick="claimBLBounty(${i})" style="padding:3px 10px;font-size:8px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(80,180,60,.2);border:1px solid rgba(80,180,60,.5);color:#80e060;border-radius:2px">CLAIM</button>` : `<span style="font-size:8px;color:#604028">${canClaim?'✓':'⏳'}</span>`}
      </div>
    </div>`;
  });
  h += `<button onclick="closeBLBountyBoard()" style="margin-top:4px;width:100%;font-size:9px;padding:5px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(100,60,20,.3);border:1px solid rgba(180,100,20,.3);color:#907050;border-radius:3px">CLOSE</button>`;
  ov.innerHTML = h;
  ov.style.display = 'block';
}