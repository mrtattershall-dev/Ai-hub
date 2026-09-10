function _renderTobiasDockPanel() {
  if (!_tobiasPanelOpen) return;
  const ov = document.getElementById('hcTalkOverlay');
  if (!ov) return;

  const jgDebt   = getJGTotalDebt();
  const jgPaid   = getJGTotalPaid();
  const week     = getJGWeekNumber(gameState.day);
  const bill     = jgWeeklyBills.find(b => b.week === week);
  const minDue   = bill && !bill.paid ? Math.max(0, bill.minPayment - (bill.paidAmount || 0)) : 0;

  // ── Sell section: items player is carrying that can go to frontier ────────
  const sellableIds = SELL_ITEMS.filter(id => countItem(id) > 0);
  let sellRows = '';
  for (const id of sellableIds) {
    const qty = countItem(id);
    const price = _getJGExportPrice(id);
    const item = ITEMS[id];
    if (!item) continue;
    sellRows += `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(80,160,80,.1);">
      <span style="color:#90c890;font-size:10px;">${item.icon} ${item.name} ×${qty}</span>
      <span style="color:#c8e880;font-size:10px;">$${price}/ea</span>
      <button onclick="jgSellItem('${id}',1)" style="padding:2px 8px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(80,160,60,.1);border:1px solid rgba(80,160,60,.35);color:#70c060;border-radius:0;">SELL 1</button>
      <button onclick="jgSellItem('${id}',${qty})" style="padding:2px 8px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(80,160,60,.15);border:1px solid rgba(80,160,60,.4);color:#80d060;border-radius:0;">ALL</button>
    </div>`;
  }
  if (!sellRows) sellRows = `<div style="color:#405840;font-size:9px;padding:6px 0;">Nothing sellable in bag.</div>`;

  // ── Buy section ───────────────────────────────────────────────────────────
  let buyRows = '';
  for (const good of JG_BUY_GOODS) {
    const cost = _getTobiasImportCost(good.baseCost);
    const canAfford = player.gold >= cost;
    buyRows += `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(80,160,80,.08);">
      <span style="color:#90c890;font-size:10px;" title="${good.desc}">${good.icon} ${good.name}</span>
      <span style="color:#c8a060;font-size:10px;">$${cost}</span>
      <button onclick="jgBuyItem('${good.id}',${cost})" ${canAfford?'':'disabled'} style="padding:2px 8px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(80,130,200,.1);border:1px solid rgba(80,130,200,${canAfford?'.35':'.15'});color:${canAfford?'#78a8e0':'#405060'};border-radius:0;">BUY</button>
    </div>`;
  }

  // ── Debt / bank section ───────────────────────────────────────────────────
  const debtColor = jgDebt <= 0 ? '#60d040' : jgDebt > 80000 ? '#e06040' : '#d4b870';
  const payAmts = [500, 1000, 2500, 5000].filter(a => a <= jgDebt && player.gold >= a);
  if (jgDebt > 0 && player.gold >= jgDebt) payAmts.push(jgDebt);
  const payBtns = payAmts.map(a =>
    `<button onclick="payJGDebt(${a})" style="padding:4px 10px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(160,100,40,.1);border:1px solid rgba(160,100,40,.4);color:#d4a060;border-radius:0;margin:2px;">PAY $${a.toLocaleString()}</button>`
  ).join('');

  // Minimum payment shortcut
  const minBtn = minDue > 0 && player.gold >= minDue
    ? `<button onclick="payJGDebt(${minDue})" style="padding:4px 12px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(200,160,40,.12);border:1px solid rgba(200,160,40,.5);color:#f0c840;border-radius:0;margin:2px;">PAY MINIMUM ($${minDue.toLocaleString()})</button>` : '';

  const billHistory = [...jgDebtPaidLog].reverse().slice(0, 5).map(e =>
    `<div style="display:flex;justify-content:space-between;padding:2px 6px;font-size:9px;color:#608060;">
      <span>Day ${e.day}</span><span style="color:#90c860;">-$${e.amount.toLocaleString()}</span>
    </div>`).join('');

  ov.innerHTML = `
    <div style="font-size:var(--ui-font-sm);color:#70c878;margin-bottom:8px;letter-spacing:.06em">🌿 Tobias · Freight Runner — Eastern Dock</div>

    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
      <button onclick="_jgPanelTab='sell';_renderTobiasDockPanel()" style="padding:4px 10px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;border:1px solid rgba(80,160,60,${window._jgPanelTab!=='buy'&&window._jgPanelTab!=='bank'?'.6':'.25'});background:rgba(80,160,60,${window._jgPanelTab!=='buy'&&window._jgPanelTab!=='bank'?'.15':'.04'});color:${window._jgPanelTab!=='buy'&&window._jgPanelTab!=='bank'?'#a0e070':'#506040'};border-radius:0;">SELL GOODS</button>
      <button onclick="_jgPanelTab='buy';_renderTobiasDockPanel()" style="padding:4px 10px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;border:1px solid rgba(80,130,200,${window._jgPanelTab==='buy'?'.6':'.25'});background:rgba(80,130,200,${window._jgPanelTab==='buy'?'.15':'.04'});color:${window._jgPanelTab==='buy'?'#80b0e0':'#405060'};border-radius:0;">BUY SUPPLIES</button>
      <button onclick="_jgPanelTab='bank';_renderTobiasDockPanel()" style="padding:4px 10px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;border:1px solid rgba(200,140,40,${window._jgPanelTab==='bank'?'.6':'.25'});background:rgba(200,140,40,${window._jgPanelTab==='bank'?'.15':'.04'});color:${window._jgPanelTab==='bank'?'#f0c040':'#806020'};border-radius:0;">BOND PAYMENT</button>
    </div>

    ${(window._jgPanelTab !== 'buy' && window._jgPanelTab !== 'bank') ? `
      <div style="font-size:9px;color:#506840;margin-bottom:6px;letter-spacing:.04em">SELL — frontier market pays eastern premium (×${JG_EXPORT_MULT}) · your gold: <span style="color:#f0d060;">$${player.gold.toLocaleString()}</span></div>
      ${sellRows}
      ${sellableIds.length >= 1 ? `<button onclick="jgSellAll()" style="margin-top:8px;width:100%;padding:5px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(80,160,60,.12);border:1px solid rgba(80,160,60,.4);color:#80d060;border-radius:0;">SELL ALL GOODS</button>` : ''}
    ` : ''}

    ${window._jgPanelTab === 'buy' ? `
      <div style="font-size:9px;color:#405060;margin-bottom:6px;letter-spacing:.04em">BUY — frontier supplies, jungle import markup (×${JG_IMPORT_MULT}) · your gold: <span style="color:#f0d060;">$${player.gold.toLocaleString()}</span></div>
      ${buyRows}
    ` : ''}

    ${window._jgPanelTab === 'bank' ? `
      <div style="background:rgba(200,80,20,.06);border:1px solid rgba(200,80,20,.2);border-radius:4px;padding:10px 12px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
          <span style="font-size:10px;color:#a08060;">Land Restoration Bond</span>
          <span style="font-size:20px;font-weight:bold;color:${debtColor};font-family:'Special Elite',serif;">${jgDebt <= 0 ? 'CLEARED' : '$'+jgDebt.toLocaleString()}</span>
        </div>
        <div style="font-size:9px;color:#705030;">Week ${week} of ${JG_DEBT_TOTAL_WEEKS} · $${jgPaid.toLocaleString()} paid so far</div>
        ${minDue > 0 ? `<div style="font-size:9px;color:#d08040;margin-top:4px;">⏰ Week ${week} minimum: <b>$${minDue.toLocaleString()}</b> still owed</div>` : ''}
      </div>
      <div style="font-size:9px;color:#6a5020;margin-bottom:6px;">your gold: <span style="color:#f0d060;">$${player.gold.toLocaleString()}</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">
        ${minBtn}${payBtns}
      </div>
      ${jgDebt <= 0 ? '<div style="text-align:center;padding:12px;font-size:11px;color:#60d040;font-family:\'Special Elite\',serif;letter-spacing:.08em;">✓ BOND CLEARED — THE TERRITORY IS FREE</div>' : ''}
      ${billHistory ? `<div style="font-size:9px;color:#506040;margin-bottom:4px;letter-spacing:.04em">RECENT PAYMENTS</div>${billHistory}` : ''}
      <div style="margin-top:10px;padding:8px 10px;background:rgba(255,255,255,.02);border-radius:3px;font-size:8px;color:#504020;line-height:1.7;">
        💬 <i>"Altaverde filed a Land Restoration Bond against the territory before they left. Legal instrument, capital office. Nobody out here signed it. That's how they do it."</i>
        <span style="display:block;margin-top:3px;color:#403018;">— Tobias</span>
      </div>
    ` : ''}

    <button onclick="closeTobiasPanel()" style="margin-top:10px;width:100%;font-size:var(--ui-font-xs);padding:5px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(10,20,10,.5);border:1px solid rgba(60,120,60,.3);color:#507050;border-radius:0;">LEAVE [E]</button>`;

  ov.style.display = 'block';
  ov.scrollTop = 0;
}