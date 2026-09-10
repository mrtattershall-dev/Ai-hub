function farmhandHireWeek() {
  const cost = Math.round(40 * (getDifficultyConfig().debtMult||1));
  if (player.gold < cost) { showMsg(`⚠️ Need $${cost} to hire Jed for the week.`); return; }
  player.gold -= cost;
  _fhWeeksLeft = 7;
  const badge = document.getElementById('fhWeekBadge');
  if (badge) { badge.textContent = '7d'; badge.style.display = 'inline-block'; }
  showMsg(`🧑‍🌾 Jed hired for 7 days! He'll water and harvest each morning automatically.`);
  refreshFarmhandUI();
}