function updateClock() {
  const p=periods[periodIdx];
  const mins=Math.floor(periodTimer/60), secs=Math.floor(periodTimer%60);
  document.getElementById('period-label').textContent=p.name;
  document.getElementById('clock-display').textContent=String(mins).padStart(2,'0')+':'+String(secs).padStart(2,'0');
}