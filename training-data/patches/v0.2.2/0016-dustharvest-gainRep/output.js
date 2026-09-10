function gainRep(faction, amount) {
  if (!(faction in REPUTATION)) return;
  const prev = REPUTATION[faction];
  REPUTATION[faction] = Math.min(100, REPUTATION[faction] + amount);
  const next = REPUTATION[faction];
  // Fire milestone messages when a faction crosses a tier threshold
  const _milestones = [
    { at: 34, msgs: {
      mine:     '⛏ Silas nods at you as you pass. Not a greeting exactly. More like acknowledgment.',
      badlands: '💀 Crane glances up when you walk in. Doesn\'t look away. Something shifted.',
      hoboCamp: '🏕️ The camp feels a little more comfortable. People make eye contact now.',
      ocean:    '⚓ Maren says your name first today. That\'s new.',
    }},
    { at: 67, msgs: {
      mine:     '⛏ Silas told you something today he hasn\'t told anyone. You can feel the weight of it.',
      badlands: '💀 Crane mentioned something about a back room. Said it like he expected you to already know.',
      hoboCamp: '🏕️ Dr. Lena called you by name without looking up. You\'ve been coming long enough it\'s just habit now.',
      ocean:    '⚓ Maren offered you a discount without being asked. Said you\'d earned it.',
    }},
  ];
  for (const m of _milestones) {
    if (prev < m.at && next >= m.at && m.msgs[faction]) {
      setTimeout(() => showMsg(m.msgs[faction]), 2200);
    }
  }
}