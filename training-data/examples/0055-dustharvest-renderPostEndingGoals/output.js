function renderPostEndingGoals() {
  const row = (icon, label, done, desc='') =>
    `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(180,140,60,.07);">
      <span style="font-size:13px;opacity:${done?1:0.35};">${icon}</span>
      <span style="flex:1;">
        <div style="font-size:10px;color:${done?'#80d060':'#c8b880'};text-decoration:${done?'line-through':'none'}">${label}</div>
        ${desc?`<div style="font-size:8px;color:#6a5020;">${desc}</div>`:''}
      </span>
      <span style="font-size:10px;">${done?'✓':''}</span>
    </div>`;

  const fishCaught = Object.keys(stats.fishCaught||{}).filter(k=>(stats.fishCaught[k]||0)>0).length;
  const allFishTotal = 30; // approximate total species
  const allRepMax = ['farm','town','mine','badlands','hoboCamp','ocean'].every(z => getRepTier(z)==='revered');
  const veraCaseDone = hcTalkSeen && hcTalkSeen.has('vera_case_acknowledged');
  const allNPCsDone = ['simons_vera_told','lena_full_study','dale_company_known','kit_ocean_reached'].every(k => hcTalkSeen && hcTalkSeen.has(k));
  const brewedAll = ['cook_fishStew','cook_swordfishSteak','cook_pepperStew','cook_porkRoast','cook_lavenderTea','cook_rosehipTonic','cook_mushroomSoup','cook_saltChowder','cook_grilledGrouper','cook_catfishTacos','cook_tunaNicoise'].every(id => (stats.itemsCrafted||{})[id] > 0);
  const logbookFull = fishCaught >= allFishTotal;
  const week25Survived = gameState.day > 25 * 7;
  const hasBaby = animals.some(a => a._baby);
  const breedingDone = (stats.babiesBorn||0) >= 3;

  const goals = [
    { icon:'📜', label:'Vera\'s case filed',         done: veraCaseDone,  desc:'Bring all evidence to Vera and hear her out.' },
    { icon:'🤝', label:'All Hobo Camp arcs resolved', done: allNPCsDone,   desc:'Complete every character\'s story thread.' },
    { icon:'⭐', label:'Revered in all 6 zones',      done: allRepMax,     desc:'Max reputation with farm, town, mine, badlands, hobo camp, ocean.' },
    { icon:'🎣', label:'Full fishing logbook',        done: logbookFull,   desc:`${fishCaught}/${allFishTotal} species caught.` },
    { icon:'🍳', label:'Every recipe cooked',         done: brewedAll,     desc:'Cook all cross-system and ocean recipes at least once.' },
    { icon:'🐣', label:'3 baby animals raised',       done: breedingDone,  desc:`${stats.babiesBorn||0}/3 born in your pens.` },
    { icon:'🌅', label:'Survived 25 weeks',           done: week25Survived,desc:'Keep the farm alive past week 25. It\'s just yours now.' },
  ];

  const doneCount = goals.filter(g=>g.done).length;
  const content = `
    <div style="display:flex;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid rgba(180,140,60,.2);margin-bottom:6px;">
      <span style="font-size:10px;color:#d4b060;">Legacy Goals</span>
      <span style="font-size:10px;color:#80d060;">${doneCount}/${goals.length} complete</span>
    </div>
    ${goals.map(g=>row(g.icon, g.label, g.done, g.desc)).join('')}
    <div style="margin-top:8px;font-size:8px;color:#6a5020;font-style:italic;">The debt is paid. What you build now is yours.</div>
  `;
  return section('🏆 LEGACY', '#d4b060', content);
}