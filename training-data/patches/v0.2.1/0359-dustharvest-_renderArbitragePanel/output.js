function _renderArbitragePanel(ov) {
  const exportable = SELL_ITEMS.filter(id => {
    const item = ITEMS[id];
    return item && !item.jgOnly && countItem(id) > 0;
  });
  const jungleGoods = SELL_ITEMS.filter(id => {
    return ITEMS[id]?.jgOnly || Object.keys(_s7Items || {}).includes(id) ||
           ['jgWood','jgHerb','jgMushroom','boarHide','boarTusk'].includes(id);
  });

  function exportRow(id) {
    const frontierPrice = economy.prices[id] || BASE_PRICES[id] || 1;
    const exportPrice   = _getJGExportPrice(id);
    const margin        = exportPrice - frontierPrice;
    const pct           = Math.round((margin / Math.max(1, frontierPrice)) * 100);
    const qty           = countItem(id);
    const color         = margin > 0 ? '#80d060' : '#d06060';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(80,160,60,.08);font-size:9px;">
      <span style="color:#90c080;">${ITEMS[id]?.icon||''} ${ITEMS[id]?.name||id}</span>
      <span style="color:#607050;">×${qty}</span>
      <span style="color:#708060;">$${frontierPrice}</span>
      <span style="color:${color};font-weight:bold;">$${exportPrice} <span style="font-size:7px;">(+${pct}%)</span></span>
    </div>`;
  }

  function importRow(good) {
    const importCost    = _getTobiasImportCost(good.baseCost);
    const frontierCost  = economy.prices[good.id] || good.baseCost;
    const saving        = frontierCost - importCost;
    const pct           = Math.round((saving / Math.max(1, frontierCost)) * 100);
    const color         = saving > 0 ? '#80d060' : '#d06060';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(80,130,200,.08);font-size:9px;">
      <span style="color:#8090c0;">${good.icon||''} ${good.name}</span>
      <span style="color:#607080;">Tobias: $${importCost}</span>
      <span style="color:${color};font-weight:bold;">Frontier: $${frontierCost} <span style="font-size:7px;">(${saving>=0?'+':''}${pct}%)</span></span>
    </div>`;
  }

  const freightLog = gameState._jgFreightLog || {};
  const pendingItems = Object.entries(freightLog).filter(([,q])=>q>0);
  const pendingTotal = pendingItems.reduce((s,[id,q])=>s+(_getJGExportPrice(id)*q),0);

  ov.innerHTML = `
    <div style="font-size:var(--ui-font-sm);color:#70c878;margin-bottom:8px;letter-spacing:.06em">🌿 Tobias · Freight Runner — Eastern Dock</div>
    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
      <button onclick="_jgPanelTab='sell';_renderTobiasDockPanel()" style="padding:4px 10px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;border:1px solid rgba(80,160,60,.25);background:rgba(80,160,60,.04);color:#506040;border-radius:0;">SELL GOODS</button>
      <button onclick="_jgPanelTab='buy';_renderTobiasDockPanel()" style="padding:4px 10px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;border:1px solid rgba(80,130,200,.25);background:rgba(80,130,200,.04);color:#405060;border-radius:0;">BUY SUPPLIES</button>
      <button onclick="_jgPanelTab='bank';_renderTobiasDockPanel()" style="padding:4px 10px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;border:1px solid rgba(200,140,40,.25);background:rgba(200,140,40,.04);color:#806020;border-radius:0;">BOND PAYMENT</button>
      <button onclick="_jgPanelTab='seeds';_renderTobiasDockPanel()" style="padding:4px 10px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;border:1px solid rgba(80,200,80,.25);background:rgba(80,200,80,.04);color:#508040;border-radius:0;">SEEDS</button>
      <button style="padding:4px 10px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;border:1px solid rgba(180,180,80,.6);background:rgba(180,180,80,.15);color:#c0c040;border-radius:0;">ARBITRAGE</button>
    </div>

    ${pendingItems.length ? `
    <div style="background:rgba(200,180,40,.07);border:1px solid rgba(180,160,40,.2);border-radius:3px;padding:6px 8px;margin-bottom:8px;font-size:9px;color:#a09040;">
      📦 Pending freight: ${pendingItems.length} item type${pendingItems.length>1?'s':''} · Est. $${pendingTotal.toLocaleString()} when Tobias runs
    </div>` : ''}

    <div style="font-size:9px;color:#607050;margin-bottom:4px;letter-spacing:.04em;text-transform:uppercase;">Export opportunities (your bag → frontier)</div>
    ${exportable.length
      ? exportable.slice(0,8).map(exportRow).join('')
      : '<div style="font-size:9px;color:#405030;font-style:italic">No exportable frontier goods in bag.</div>'}

    <div style="font-size:9px;color:#506070;margin-top:8px;margin-bottom:4px;letter-spacing:.04em;text-transform:uppercase;">Import prices (Tobias vs frontier market)</div>
    ${JG_BUY_GOODS.filter(g => !g.isSeed).slice(0,7).map(importRow).join('')}

    <button onclick="closeTobiasPanel()" style="margin-top:10px;width:100%;font-size:var(--ui-font-xs);padding:5px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(10,20,10,.5);border:1px solid rgba(60,120,60,.3);color:#507050;border-radius:0;">LEAVE [E]</button>`;

  ov.style.display = 'block';
  ov.scrollTop = 0;
}