function _renderJGContractBoard() {
  const ov = document.getElementById('hcTalkOverlay');
  if (!ov) return;
  generateJGContracts(gameState.day);

  const repTier = getRepTier('jungle');
  const repVal  = getRep('jungle');

  function contractCard(c, idx) {
    const overdue  = gameState.day > c.deadline;
    const daysLeft = c.deadline - gameState.day;
    const dueColor = daysLeft <= 1 ? '#e06040' : daysLeft <= 3 ? '#e0b040' : '#608060';
    const have     = countItem(c.crop);
    const canFulfil= c.accepted && have >= c.qty;
    return `
      <div style="background:rgba(30,50,20,.4);border:1px solid rgba(80,160,60,${c.accepted?'.4':'.15'});border-radius:3px;padding:8px 10px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">
          <span style="font-size:10px;color:#90c880;">${c.icon} ${c.title}</span>
          <span style="font-size:9px;color:${dueColor};">${daysLeft > 0 ? daysLeft + 'd left' : 'OVERDUE'}</span>
        </div>
        <div style="font-size:8px;color:#607050;margin-bottom:5px;">${c.desc}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
          <span style="font-size:9px;color:#c8e880;">$${c.reward.toLocaleString()} + $${c.bonus.toLocaleString()} on-time</span>
          <span style="font-size:8px;color:${have>=c.qty?'#70c040':'#a06040'};">Have: ${have}/${c.qty}</span>
          ${!c.accepted
            ? `<button onclick="acceptJGContract(${idx})" style="padding:2px 8px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(80,160,60,.1);border:1px solid rgba(80,160,60,.4);color:#70c060;border-radius:0;">ACCEPT</button>`
            : canFulfil
              ? `<button onclick="fulfillJGContract(${idx})" style="padding:2px 8px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(80,200,60,.15);border:1px solid rgba(80,200,60,.5);color:#90e070;border-radius:0;">DELIVER ✓</button>`
              : `<span style="font-size:8px;color:#507040;font-style:italic;">Accepted — gather goods</span>`
          }
        </div>
      </div>`;
  }

  // Unclaimed settlement rewards
  const pendingRewards = JG_SETTLEMENT_REWARDS.filter(r => !gameState._jgRewardsClaimed.has(r.id));
  let rewardSection = '';
  if (pendingRewards.length) {
    rewardSection = `
      <div style="font-size:9px;color:#508060;margin-top:8px;margin-bottom:5px;letter-spacing:.04em;text-transform:uppercase;">Settlement Milestones</div>
      ${pendingRewards.slice(0,4).map(r => {
        let triggered = false;
        try { triggered = r.check(); } catch(e) {}
        const claimable = triggered;
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(80,160,60,.07);font-size:8.5px;">
          <span style="color:${claimable?'#80c870':'#507040'};">${r.label}</span>
          <span style="color:#507040;font-style:italic;font-size:8px;">${claimable ? '+$'+r.gold+' +'+r.rep+'rep — auto-claimed' : r.desc}</span>
        </div>`;
      }).join('')}`;
  }

  ov.innerHTML = `
    <div style="font-size:var(--ui-font-sm);color:#70c878;margin-bottom:4px;letter-spacing:.06em">📋 Settlement Contracts · Kit's Village</div>
    <div style="font-size:8px;color:#507050;margin-bottom:8px;">
      Jungle rep: <span style="color:${repTier==='revered'?'#80e060':repTier==='trusted'?'#c0d040':'#708060'};">${repVal}/100 — ${repTier.toUpperCase()}</span>
      · Contracts available: ${1 + Math.min(2, Math.floor(repVal/34))}
    </div>

    ${jgActiveContracts.length
      ? jgActiveContracts.map((c,i) => contractCard(c,i)).join('')
      : '<div style="font-size:9px;color:#405030;font-style:italic;padding:8px 0;">No contracts available — come back after dawn.</div>'}

    ${rewardSection}

    <div style="margin-top:8px;font-size:8px;color:#405030;">
      Completed: ${jgCompletedContracts.length} · Streak: ${jgContractStreak}
    </div>
    <button onclick="document.getElementById('hcTalkOverlay').style.display='none'" style="margin-top:10px;width:100%;font-size:var(--ui-font-xs);padding:5px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(10,20,10,.5);border:1px solid rgba(60,120,60,.3);color:#507050;border-radius:0;">CLOSE [F]</button>`;
  ov.style.display = 'block';
  ov.scrollTop = 0;
}