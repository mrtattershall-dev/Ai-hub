function showEncounterPanel(enc) {
  const panel = document.getElementById('encounterPanel');
  document.getElementById('encTitle').textContent = enc.icon+' '+enc.title;
  document.getElementById('encDesc').textContent  = enc.desc;
  const btns = document.getElementById('encBtns');
  btns.innerHTML = '';
  for (const opt of enc.options) {
    const b = document.createElement('button');
    b.className = 'enc-btn'+(opt.cls?' '+opt.cls:'');
    b.textContent = opt.label;
    b.onclick = () => { opt.action(); };
    btns.appendChild(b);
  }
  panel.classList.add('show');
}