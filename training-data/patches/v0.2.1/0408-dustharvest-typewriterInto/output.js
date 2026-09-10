function typewriterInto(el, fullText, msPerChar) {
  if (_typeInterval) clearInterval(_typeInterval);
  el.textContent = '';
  const lines = fullText.split('\n');
  let lineIdx = 0, charIdx = 0;
  let displayed = '';
  _typeInterval = setInterval(() => {
    if (_introSkipped) { clearInterval(_typeInterval); return; }
    const line = lines[lineIdx];
    if (charIdx < line.length) {
      displayed += line[charIdx++];
      el.textContent = displayed;
    } else if (lineIdx < lines.length - 1) {
      displayed += '\n';
      el.textContent = displayed;
      lineIdx++; charIdx = 0;
    } else {
      clearInterval(_typeInterval);
    }
  }, msPerChar);
}