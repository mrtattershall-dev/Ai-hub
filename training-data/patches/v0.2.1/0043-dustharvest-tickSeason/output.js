function tickSeason(day){
  const totalDays = SEASONS.reduce((s,ss)=>s+ss.days,0); // 40-day cycle
  const cycleDay = (day-1) % totalDays;
  let acc=0;
  for(let i=0;i<SEASONS.length;i++){
    acc += SEASONS[i].days;
    if(cycleDay < acc){
      if(currentSeasonIdx!==i){
        currentSeasonIdx=i;
        gameState.season = SEASONS[i].name;
        showMsg(SEASONS[i].changeMsg || `${SEASONS[i].icon} Season changed: ${SEASONS[i].name} — ${SEASONS[i].desc}`);
      }
      return;
    }
  }
}