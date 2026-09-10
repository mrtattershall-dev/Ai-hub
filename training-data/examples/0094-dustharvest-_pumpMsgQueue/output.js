function _pumpMsgQueue() {
  if (_msgQueue.length === 0) { _msgShowing = false; return; }
  _msgShowing = true;
  const next = _msgQueue.shift();
  const el = document.getElementById('msgBanner');
  if (next.isTip) el.classList.add('tip'); else el.classList.remove('tip');
  el.textContent = next.txt; el.style.opacity = '1';
  msgTimer2 = next.dur;
}