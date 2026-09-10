function renderQuests(body) {
  checkQuests();
  const doneIds = new Set(completedQuests.map(q => q.id));
  const remaining = QUEST_POOL.filter(q => !doneIds.has(q.id) && !activeQuests.find(a => a.id === q.id)).length;

  let h = `<div style="font-size:9px;color:#6a5020;margin-bottom:4px">QUESTS — no deadline, no pressure. Complete at your own pace.</div>`;
  h += `<div style="font-size:9px;color:#705030;margin-bottom:10px">${completedQuests.length} completed &nbsp;·&nbsp; ${remaining} more available</div>`;

  if (activeQuests.length === 0) {
    h += `<div style="color:#705030;font-size:10px;padding:12px">All quests completed. Well done.</div>`;
  }

  for (const q of activeQuests) {
    const current  = getQuestStat(q.stat) - q.startVal;
    const progress = Math.min(current, q.goal);
    const pct      = Math.min(100, Math.round(progress / q.goal * 100));
    const done     = claimableQuests.includes(q.id);
    const repName  = { town:'Town', badlands:'Badlands', mine:'Mine', ocean:'Ocean', hoboCamp:'Hobo Camp' }[q.rep] || q.rep;

    h += `<div class="contract-card" style="${done ? 'border-left:3px solid #60d040;' : ''}">
      <div class="cc-header">
        <span class="cc-title">${q.icon} ${q.title}</span>
        <span class="cc-reward">$${q.reward} · +${repName} rep</span>
      </div>
      <div class="cc-desc" style="margin-bottom:6px">${q.desc}</div>
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px">
        <span style="font-size:9px;color:#907050">${progress}/${q.goal}</span>
        <div class="cc-prog-bg"><div class="cc-prog-fill" style="width:${pct}%;background:${done?'#60d040':'#d0a030'}"></div></div>
        <span style="font-size:9px;color:${done?'#80e060':'#907050'}">${pct}%</span>
      </div>
      ${done
        ? `<button class="btn-deliver" onclick="claimQuest('${q.id}')">✓ CLAIM REWARD</button>`
        : `<button class="btn-deliver" disabled style="opacity:.35">IN PROGRESS</button>`
      }
    </div>`;
  }

  if (completedQuests.length > 0) {
    h += `<div style="font-size:9px;color:#6a5020;margin:12px 0 6px">COMPLETED</div>`;
    completedQuests.slice(-5).reverse().forEach(q => {
      h += `<div class="contract-card" style="opacity:.5">
        <div class="cc-header">
          <span class="cc-title">${q.icon} ${q.title}</span>
          <span style="color:#80e060;font-size:10px">+$${q.reward}</span>
        </div>
        <div style="font-size:9px;color:#705030">Claimed Day ${q.claimedDay}</div>
      </div>`;
    });
  }

  body.innerHTML = h;
}