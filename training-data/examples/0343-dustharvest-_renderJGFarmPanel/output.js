function _renderJGFarmPanel() {
  if (!_jgFarmPanelOpen) return;
  if (jgTalkOpen || _tobiasPanelOpen) { _jgFarmPanelOpen = false; return; }
  const ov = document.getElementById('hcTalkOverlay');
  if (!ov) return;

  const sum = _getJGFarmSummary();
  const jgDebt = getJGTotalDebt();
  const week = typeof getJGWeekNumber === 'function' ? getJGWeekNumber(gameState.day) : 1;

  // Soil breakdown
  const totalTillable = (JG_FARM_X2 - JG_FARM_X1 + 1) * (JG_FARM_Y2 - JG_FARM_Y1 + 1);
  const soilBar = (count, color, label) => count > 0
    ? `<div style="display:inline-flex;align-items:center;gap:3px;margin-right:8px;font-size:9px;">
        <div style="width:8px;height:8px;background:${color};border-radius:2px;flex-shrink:0;"></div>
        <span style="color:#90b080;">${label}: ${count}</span>
      </div>` : '';

  // Owned seeds summary
  const ownedSeeds = JG_CROP_IDS.map(id => {
    const n = getJGSeedCount(id);
    return n > 0 ? `${CROPS[id]?.icon || '🫘'} ${CROPS[id]?.name || id} ×${n}` : null;
  }).filter(Boolean).join('  ');

  // Growing plots detail
  let plotRows = '';
  const readyPlots = [], growingPlots = [];
  for (const key in jgPlots) {
    const p = jgPlots[key];
    if (!p.tilled || !p.crop) continue;
    const crop = CROPS[p.crop];
    if (!crop) continue;
    if (p.harvestReady) readyPlots.push({ p, crop, key });
    else growingPlots.push({ p, crop, key });
  }
  if (readyPlots.length > 0) {
    plotRows += `<div style="font-size:9px;color:#80e060;margin-bottom:4px;letter-spacing:.03em;">✓ READY TO HARVEST (${readyPlots.length})</div>`;
    readyPlots.slice(0, 5).forEach(({ crop }) => {
      const h = gameState.timeOfDay / 60;
      const dawn = crop.icon === '🌺' && h >= 6 && h < 9;
      plotRows += `<div style="font-size:9px;color:#80c870;padding:2px 0;border-bottom:1px solid rgba(80,160,40,.1);">${crop.icon} ${crop.name}${dawn ? ' <span style="color:#e0c040">🌅×3</span>' : ''}</div>`;
    });
    if (readyPlots.length > 5) plotRows += `<div style="font-size:8px;color:#507040;">…and ${readyPlots.length - 5} more</div>`;
  }
  if (growingPlots.length > 0) {
    plotRows += `<div style="font-size:9px;color:#609050;margin-top:6px;margin-bottom:4px;letter-spacing:.03em;">🌱 GROWING (${growingPlots.length})</div>`;
    growingPlots.slice(0, 4).forEach(({ p, crop }) => {
      const pct = Math.floor((p.growthProgress || 0) * 100);
      const tier = getJGSoilTierLabel(p.soilTier || 'stripped');
      plotRows += `<div style="font-size:9px;padding:2px 0;border-bottom:1px solid rgba(80,160,40,.08);">
        <span style="color:#80b870;">${crop.icon} ${crop.name}</span>
        <span style="color:#607050;float:right;">${pct}% · <span style="color:${tier.color}">${tier.text.split(' ')[1]}</span></span>
      </div>`;
    });
    if (growingPlots.length > 4) plotRows += `<div style="font-size:8px;color:#507040;">…and ${growingPlots.length - 4} more</div>`;
  }

  ov.innerHTML = `
    <div style="font-size:var(--ui-font-sm);color:#70c878;margin-bottom:8px;letter-spacing:.06em">🌿 JUNGLE FARM [F]</div>

    <div style="background:rgba(30,60,20,.4);border:1px solid rgba(60,140,60,.2);border-radius:3px;padding:8px 10px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:9px;color:#608050;letter-spacing:.04em">CLEARED ZONE PLOTS</span>
        <span style="font-size:9px;color:#70a060;">${sum.tilled} tilled of ${totalTillable} available</span>
      </div>
      <div style="margin-bottom:4px;">
        ${soilBar(sum.stripped,'#c07030','Stripped')}
        ${soilBar(sum.recovering,'#c0b050','Recovering')}
        ${soilBar(sum.restored,'#70c050','Restored')}
      </div>
      <div style="font-size:9px;color:#507040;">
        ${sum.ready > 0 ? `<span style="color:#80e060">✓ ${sum.ready} ready</span>  ` : ''}
        ${sum.growing > 0 ? `🌱 ${sum.growing} growing  ` : ''}
        ${sum.tilled - sum.growing - sum.ready > 0 ? `⬜ ${sum.tilled - sum.growing - sum.ready} empty` : ''}
      </div>
    </div>

    ${plotRows ? `<div style="margin-bottom:10px;">${plotRows}</div>` : ''}

    <div style="margin-bottom:10px;">
      <div style="font-size:9px;color:#508050;margin-bottom:4px;letter-spacing:.04em">SEED INVENTORY</div>
      <div style="font-size:9px;color:#70a060;">${ownedSeeds || '<span style="color:#405030;font-style:italic">No seeds — buy from Tobias</span>'}</div>
    </div>

    <div style="background:rgba(200,80,20,.06);border:1px solid rgba(200,80,20,.2);border-radius:3px;padding:6px 10px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;">
        <span style="font-size:9px;color:#a08060;">Land Restoration Bond</span>
        <span style="font-size:12px;font-family:'Special Elite',serif;color:${jgDebt<=0?'#60d040':jgDebt>80000?'#e06040':'#d4b870'}">
          ${jgDebt<=0 ? 'CLEARED' : '$'+jgDebt.toLocaleString()}
        </span>
      </div>
      ${typeof gameState._jgDebt !== 'undefined' && jgDebt > 0
        ? `<div style="font-size:8px;color:#705030;margin-top:2px;">Week ${week} of ${JG_DEBT_TOTAL_WEEKS} — talk to Tobias to pay</div>`
        : ''}
    </div>

    <div style="display:flex;gap:6px;">
      <button onclick="_jgFarmPanelOpen=false;closeTobiasPanel();openTobiasPanel();"
        style="flex:1;padding:5px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(80,160,60,.1);border:1px solid rgba(80,160,60,.35);color:#70c060;border-radius:0;">
        OPEN DOCK [M]
      </button>
      <button onclick="_closeJGFarmPanel()"
        style="flex:1;padding:5px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(10,20,10,.5);border:1px solid rgba(60,120,60,.3);color:#507050;border-radius:0;">
        CLOSE [F]
      </button>
    </div>`;

  ov.style.display = 'block';
  ov.scrollTop = 0;
}