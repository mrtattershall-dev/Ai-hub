function refreshSaveSlotUI() {
  const list = document.getElementById('saveSlotList');
  if (!list) return;
  list.innerHTML = '';
  for (let s = 1; s <= SAVE_SLOT_COUNT; s++) {
    const info = getSaveInfo(s);
    const empty = !info;
    const isActive = s === window._activeSaveSlot;
    const div = document.createElement('div');
    div.style.cssText = `display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,.02);border:1px solid rgba(${isActive?'180,130,50':'95,75,36'},.${isActive?'5':'2'});border-left:3px solid rgba(${isActive?'200,150,50':'95,75,36'},.${isActive?'8':'3'});cursor:pointer;transition:all .12s;`;
    div.onmouseenter = () => div.style.background = 'rgba(155,105,36,.1)';
    div.onmouseleave = () => div.style.background = 'rgba(255,255,255,.02)';

    const slotLabel = `<div style="font-size:9px;color:rgba(155,115,52,.55);letter-spacing:.12em;text-transform:uppercase;margin-bottom:2px;">SLOT ${s}</div>`;
    const infoLine = empty
      ? `<div style="font-size:11px;color:rgba(130,100,50,.4);font-family:'Special Elite',serif;letter-spacing:.05em;">— Empty —</div>`
      : `<div style="font-size:11px;color:var(--bone);font-family:'Special Elite',serif;letter-spacing:.04em;">${info}</div>`;

    div.innerHTML = `
      <div style="flex:1;min-width:0;">
        ${slotLabel}
        ${infoLine}
      </div>
      ${!empty && _slotModalMode === 'load' ? `<button onclick="event.stopPropagation();deleteSlot(${s})" style="flex-shrink:0;padding:3px 8px;font-size:9px;font-family:'Special Elite',serif;cursor:pointer;background:rgba(120,20,20,.15);border:1px solid rgba(160,40,40,.35);color:#b06060;letter-spacing:.04em;border-radius:0;" title="Delete slot ${s}">✕</button>` : ''}
    `;

    div.onclick = () => selectSlot(s);
    list.appendChild(div);
  }
}