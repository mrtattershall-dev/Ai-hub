function _onZoneEnter(zone) {
  if (zone === 'hoboCamp' && REPUTATION.hoboCamp === 0) {
    gainRep('hoboCamp', 10);
    showMsg('🏕 You\'re known at the Hobo Camp now.');
  }
  if (zone === 'badlands' && REPUTATION.badlands === 0) {
    gainRep('badlands', 5);
  }
  if (zone === 'mine' && REPUTATION.mine === 0) {
    gainRep('mine', 5);
  }
  if (zone === 'ocean' && REPUTATION.ocean === 0) {
    gainRep('ocean', 10);
    showMsg('⚓ The dock. Salt air. Someone\'s been waiting here a while.');
  }
}