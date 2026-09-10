function renderContracts(body) {
  const streakLabel = contractStreak >= 3
    ? `🔥 Streak: ${contractStreak} in a row!`
    : contractStreak > 0
      ? `🔥 Streak: ${contractStreak}`
      : '';
  const nextBonusNote = streakBonus
    ? `<span style="color:#f0c030;font-size:9px;font-weight:bold"> — next contract has 20% streak bonus!</span>`
    : contractStreak === 2
      ? `<span style="color:#c09020;font-size:9px"> — 1 more to earn a bonus contract</span>`
      : '';
  let h = `<div style="font-size:9px;color:#6a5020;margin-bottom:4px">ACTIVE CONTRACTS — deliver goods for bonus gold</div>`;
  if (streakLabel) {
    h += `<div style="font-size:9px;color:#e09030;margin-bottom:7px">${streakLabel}${nextBonusNote}</div>`;
  }

  if (activeContracts.length === 0) {
    h += `<div style="color:#705030;font-size:10px;padding:12px">No active contracts right now. Check back tomorrow.</div>`;
  }

  activeContracts.forEach((c, i) => {
    const have     = countItem(c.crop);
    const daysLeft = c.deadline - gameState.day;
    const pct      = Math.min(100, Math.round(have / c.qty * 100));
    const canDeliver = have >= c.qty;
    const urgColor = daysLeft <= 0 ? '#e06050' : daysLeft <= 1 ? '#e06050' : daysLeft <= 2 ? '#d09030' : '#705030';
    const streakTag = c.hasStreakBonus
      ? `<span style="color:#f0c030;font-size:9px;font-weight:bold">🔥 +20% streak</span> `
      : '';
    const acceptedBorder = c.accepted
      ? (daysLeft <= 0 ? 'border-left:3px solid #e06050;' : 'border-left:3px solid #60a040;')
      : '';

    if (!c.accepted) {
      // Pending card — offer to accept or decline
      h += `<div class="contract-card" style="${acceptedBorder}opacity:.85">
        <div class="cc-header">
          <span class="cc-title">${c.icon} ${c.title}</span>
          <span class="cc-reward">${streakTag}$${c.reward} + $${c.bonus} on-time</span>
        </div>
        <div class="cc-desc">${c.desc}<br>
          <span style="color:${urgColor}">Expires: Day ${c.deadline} (${Math.max(0,daysLeft)} day${daysLeft===1?'':'s'} to decide)</span>
        </div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button class="btn-deliver" onclick="acceptContract(${i})" style="flex:1">✓ ACCEPT</button>
          <button class="btn-deliver" onclick="declineContract(${i})" style="flex:0 0 auto;background:rgba(80,40,20,.4);border-color:rgba(110,60,30,.4);color:#907050">✗</button>
        </div>
      </div>`;
    } else {
      // Accepted card — show progress and deliver button
      h += `<div class="contract-card" style="${acceptedBorder}">
        <div class="cc-header">
          <span class="cc-title">${c.icon} ${c.title}</span>
          <span class="cc-reward">${streakTag}$${c.reward} + $${c.bonus} on-time</span>
        </div>
        <div class="cc-desc">${c.desc}<br>
          <span style="color:${urgColor}">Deadline: Day ${c.deadline} (${daysLeft <= 0 ? 'OVERDUE' : daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + ' left'})</span>
        </div>
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px">
          <span style="font-size:9px;color:#907050">${have}/${c.qty} ${(ITEMS[c.crop] && ITEMS[c.crop].icon)||''}</span>
          <div class="cc-prog-bg"><div class="cc-prog-fill" style="width:${pct}%;background:${canDeliver?'#60d040':'#d0a030'}"></div></div>
          <span style="font-size:9px;color:${canDeliver?'#80e060':'#907050'}">${pct}%</span>
        </div>
        <button class="btn-deliver" onclick="fulfillContract(${i})" ${canDeliver?'':'disabled'}>${canDeliver?'✓ DELIVER NOW':'NEED MORE'}</button>
      </div>`;
    }
  });

  if (completedContracts.length > 0) {
    h += `<div style="font-size:9px;color:#6a5020;margin:12px 0 6px">COMPLETED</div>`;
    completedContracts.slice(-4).reverse().forEach(c => {
      const tag = c.hadStreakBonus ? ' 🔥' : c.onTime ? ' ⏱' : '';
      h += `<div class="contract-card" style="opacity:.55">
        <div class="cc-header"><span class="cc-title">${c.icon} ${c.title}</span><span style="color:#80e060;font-size:10px">+$${c.earned}${tag}</span></div>
        <div style="font-size:9px;color:#705030">Completed Day ${c.completedDay}</div>
      </div>`;
    });
  }

  body.innerHTML = h;
}