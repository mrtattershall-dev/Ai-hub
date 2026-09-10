function _renderJGSeedShop(ov) {
  const BATCH_A = ['heartleaf','crimsonBloom','caneReed','jungleBanana'];
  const BATCH_B = ['darkroot','ashgrain','firepod','canopyMelon'];

  function _seedRow(cropId) {
    const crop = CROPS[cropId];
    if (!crop) return '';
    const owned = getJGSeedCount(cropId);
    const cost  = _getTobiasImportCost(JG_SEED_PRICES[cropId] || 20);
    const canBuy = player.gold >= cost;
    const soil  = crop.jgOnly ? (
      cropId === 'darkroot'    ? '<span style="color:#908060;font-size:8px;">recovering+ soil</span>' :
      cropId === 'ashgrain'    ? '<span style="color:#c07030;font-size:8px;">stripped/recovering only</span>' :
      cropId === 'canopyMelon' ? '<span style="color:#508060;font-size:8px;">stripped/recovering only</span>' : ''
    ) : '';
    const trait = crop.trait ? `<div style="color:#608050;font-size:8px;margin-top:2px;font-style:italic">${crop.trait}</div>` : '';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(80,160,80,.10);">
      <div>
        <span style="color:#90c890;font-size:10px;">${crop.icon} ${crop.name}</span>
        ${soil}${trait}
      </div>
      <div style="text-align:right;min-width:100px;">
        <div style="color:#c8e880;font-size:9px;">Owned: ${owned}</div>
        <div style="display:flex;gap:4px;justify-content:flex-end;margin-top:3px;">
          <button onclick="jgBuyItem('${cropId}_seed',${cost})" ${canBuy?'':'disabled'}
            style="padding:2px 8px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(80,160,60,.1);border:1px solid rgba(80,160,60,${canBuy?'.4':'.15'});color:${canBuy?'#70c060':'#405040'};border-radius:0;">
            ×5 — $${cost}
          </button>
        </div>
      </div>
    </div>`;
  }

  ov.innerHTML = `
    <div style="font-size:var(--ui-font-sm);color:#70c878;margin-bottom:8px;letter-spacing:.06em">🌿 Tobias · Freight Runner — Eastern Dock</div>

    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
      <button onclick="_jgPanelTab='sell';_renderTobiasDockPanel()" style="padding:4px 10px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;border:1px solid rgba(80,160,60,.25);background:rgba(80,160,60,.04);color:#506040;border-radius:0;">SELL GOODS</button>
      <button onclick="_jgPanelTab='buy';_renderTobiasDockPanel()"  style="padding:4px 10px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;border:1px solid rgba(80,130,200,.25);background:rgba(80,130,200,.04);color:#405060;border-radius:0;">BUY SUPPLIES</button>
      <button onclick="_jgPanelTab='bank';_renderTobiasDockPanel()" style="padding:4px 10px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;border:1px solid rgba(200,140,40,.25);background:rgba(200,140,40,.04);color:#806020;border-radius:0;">BOND PAYMENT</button>
      <button style="padding:4px 10px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;border:1px solid rgba(80,200,80,.6);background:rgba(80,200,80,.15);color:#80e070;border-radius:0;">SEEDS</button>
    </div>

    <div style="font-size:9px;color:#506840;margin-bottom:8px;letter-spacing:.04em">
      SEED SHOP — 5 seeds per pack · your gold: <span style="color:#f0d060">$${player.gold.toLocaleString()}</span>
    </div>

    <div style="font-size:9px;color:#4a6040;margin-bottom:4px;letter-spacing:.03em;text-transform:uppercase;">Batch A — Available Now</div>
    ${BATCH_A.map(_seedRow).join('')}

    <div style="font-size:9px;color:#3a4a30;margin-bottom:4px;margin-top:10px;letter-spacing:.03em;text-transform:uppercase;">Batch B — Coming Soon</div>
    ${BATCH_B.map(id => {
      const crop = CROPS[id];
      if (!crop) return '';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(80,160,80,.06);opacity:0.4;">
        <span style="color:#607850;font-size:10px;">${crop.icon} ${crop.name}</span>
        <span style="color:#405030;font-size:9px;font-style:italic">Not yet stocked</span>
      </div>`;
    }).join('')}

    <button onclick="closeTobiasPanel()" style="margin-top:10px;width:100%;font-size:var(--ui-font-xs);padding:5px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(10,20,10,.5);border:1px solid rgba(60,120,60,.3);color:#507050;border-radius:0;">LEAVE [E]</button>`;

  ov.style.display = 'block';
  ov.scrollTop = 0;
}