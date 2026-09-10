function renderBank(body) {
  generateWeeklyBills(gameState.day);
  const debt    = getTotalDebt();
  const paid    = getTotalPaid();
  const currentWeek = getWeekNumber(gameState.day);
  const nextWeek = currentWeek + 1;
  const nextBillAmt = getWeeklyBillAmount(nextWeek);
  const daysUntilNextBill = (nextWeek - 1) * DEBT_WEEK_LENGTH + 1 - gameState.day;

  const payments = [100, 250, 500].filter(a => a <= debt);
  if (debt > 0 && debt < 100) payments.unshift(debt);

  let h = `
    <div style="margin-bottom:14px">
      <div style="font-size:10px;color:#6a5020;letter-spacing:.05em;margin-bottom:8px">FRONTIER BANK — WEEKLY LAND PAYMENT</div>
      <div style="background:rgba(255,255,255,.02);border:1px solid rgba(200,60,40,.28);border-radius:5px;padding:12px 14px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
          <span style="font-size:11px;color:#c09060">Outstanding Balance</span>
          <span style="font-size:22px;font-weight:bold;color:${debt<=0?'#60d040':debt<200?'#d0a030':'#e07050'};font-family:'Special Elite',serif">
            ${debt <= 0 ? 'PAID IN FULL' : '$'+debt.toLocaleString()}
          </span>
        </div>
        <div style="font-size:9px;color:#705830">Week ${currentWeek} of the season · $${paid.toLocaleString()} paid so far</div>
      </div>`;

  if (debt > 0) {
    h += `
      <div style="background:rgba(200,80,20,.06);border:1px solid rgba(200,80,20,.2);border-radius:4px;padding:8px 12px;margin-bottom:12px;font-size:9px;color:#c07840">
        ⏰ Week ${nextWeek} payment due in <b>${daysUntilNextBill} day${daysUntilNextBill!==1?'s':''}</b>: $${nextBillAmt.toLocaleString()} (bills increase $${DEBT_WEEKLY_STEP}/week)
      </div>
      <div style="font-size:9px;color:#6a5020;margin-bottom:7px;letter-spacing:.04em">MAKE A PAYMENT — your gold: <span style="color:#f0d060">$${player.gold.toLocaleString()}</span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
        ${payments.map(a => `
          <button onclick="payDebt(${a})" ${player.gold<a?'disabled':''} style="padding:7px 16px;font-size:10px;font-family:'Special Elite',serif;cursor:pointer;border-radius:3px;background:rgba(180,140,60,.12);border:1px solid rgba(180,140,60,${player.gold>=a?'.5':'.2'});color:${player.gold>=a?'#f0d060':'#504020'};transition:all .12s"
            onmouseover="this.style.background='rgba(180,140,60,.25)'" onmouseout="this.style.background='rgba(180,140,60,.12)'">
            PAY $${a.toLocaleString()}
          </button>`).join('')}
        ${player.gold > 0 && player.gold < debt ? `
          <button onclick="payDebt(${player.gold})" style="padding:7px 16px;font-size:10px;font-family:'Special Elite',serif;cursor:pointer;border-radius:3px;background:rgba(80,160,60,.1);border:1px solid rgba(80,160,60,.4);color:#80d060"
            onmouseover="this.style.background='rgba(80,160,60,.22)'" onmouseout="this.style.background='rgba(80,160,60,.1)'">
            PAY ALL ($${player.gold.toLocaleString()})
          </button>` : ''}
        ${player.gold >= debt ? `
          <button onclick="payDebt(${debt})" style="padding:7px 16px;font-size:10px;font-family:'Special Elite',serif;cursor:pointer;border-radius:3px;background:rgba(60,200,60,.15);border:1px solid rgba(60,200,60,.6);color:#80ff80;font-weight:bold"
            onmouseover="this.style.background='rgba(60,200,60,.28)'" onmouseout="this.style.background='rgba(60,200,60,.15)'">
            ✓ CLEAR ALL DEBT ($${debt.toLocaleString()})
          </button>` : ''}
      </div>`;
  } else {
    h += `<div style="text-align:center;padding:20px;font-size:12px;color:#60d040;font-family:'Special Elite',serif;letter-spacing:.08em">✓ DEBT CLEARED — THIS LAND IS YOURS</div>`;
  }

  // Weekly payment schedule
  const totalScheduled = Array.from({length:DEBT_TOTAL_WEEKS}, (_,i) => getWeeklyBillAmount(i+1)).reduce((a,b)=>a+b,0);
  h += `<div style="font-size:9px;color:#6a5020;margin-bottom:6px;letter-spacing:.04em">WEEKLY BILL SCHEDULE — ${DEBT_TOTAL_WEEKS} WEEKS</div>
    <div style="max-height:220px;overflow-y:auto;margin-bottom:4px;scrollbar-width:thin;scrollbar-color:rgba(180,140,60,.4) rgba(0,0,0,.2);">`;
  const allBills = [];
  for (let w = 1; w <= Math.max(currentWeek + 3, DEBT_TOTAL_WEEKS); w++) {
    const amt = getWeeklyBillAmount(w);
    const existing = weeklyBills.find(b => b.week === w);
    const isPaid = (existing && existing.paid) || false;
    const isBilled = !!existing;
    const isCurrent = w === currentWeek;
    allBills.push({ w, amt, isPaid, isBilled, isCurrent });
  }
  for (const b of allBills) {
    const col = b.isPaid ? '#60d040' : b.isCurrent ? '#f0d060' : b.isBilled ? '#e07050' : '#504020';
    const status = b.isPaid ? '✓ PAID' : b.isCurrent ? '▶ DUE NOW' : b.isBilled ? '⚠ OVERDUE' : `Day ${(b.w-1)*7+1}`;
    h += `<div style="display:flex;justify-content:space-between;padding:4px 8px;font-size:9px;border-bottom:1px solid rgba(180,140,60,.08);${b.isCurrent?'background:rgba(240,208,80,.05);':''}">
      <span style="color:#705830">Week ${b.w}</span>
      <span style="color:#c0a060">$${b.amt}</span>
      <span style="color:${col}">${status}</span>
    </div>`;
  }
  h += `</div>
  <div style="display:flex;justify-content:space-between;padding:5px 8px;font-size:10px;border:1px solid rgba(180,140,60,.22);border-radius:3px;margin-bottom:12px;background:rgba(180,140,60,.05)">
    <span style="color:#a09060;letter-spacing:.04em">FULL 24-WEEK TOTAL</span>
    <span style="color:#f0d060;font-weight:bold">$${totalScheduled.toLocaleString()}</span>
    <span style="color:#705830;font-size:9px">$${paid.toLocaleString()} paid · $${(totalScheduled-paid).toLocaleString()} remaining</span>
  </div>`;

  // Payment history
  if (debtPaidLog.length > 0) {
    h += `<div style="font-size:9px;color:#6a5020;margin-bottom:6px;letter-spacing:.04em">PAYMENT HISTORY</div>
      <div style="max-height:120px;overflow-y:auto">`;
    [...debtPaidLog].reverse().slice(0,8).forEach(entry => {
      h += `<div style="display:flex;justify-content:space-between;padding:4px 8px;font-size:9px;border-bottom:1px solid rgba(180,140,60,.08)">
        <span style="color:#705830">Day ${entry.day}</span>
        <span style="color:#d4b870">-$${entry.amount.toLocaleString()}</span>
      </div>`;
    });
    h += `</div>`;
  }

  h += `<div style="margin-top:14px;padding:8px 10px;background:rgba(255,255,255,.02);border-radius:3px;font-size:8px;color:#504020;line-height:1.7">
    💬 <i>"Week one's five hundred, Cole. Week two's seven hundred. Goes up two hundred every week — twenty-four weeks total. You fall behind, it stacks. You stay ahead, you keep the land."</i>
    <span style="display:block;margin-top:3px;color:#403018">— Banker Harlan Mott, Dustridge Frontier Bank</span>
  </div>`;

  h += `</div>`;
  body.innerHTML = h;
}