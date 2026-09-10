function updateStatWarnings() {
  const acadLabel=elAcadLabel;
  const cloutLabel=elCloutLabel;
  const skateLabel=elSkateLabel;

  // Academics
  if (player.academics < THRESH.academics.ground) {
    acadLabel.classList.add('danger'); acadLabel.classList.remove('warn');
  } else if (player.academics < THRESH.academics.warn) {
    acadLabel.classList.add('warn'); acadLabel.classList.remove('danger');
  } else {
    acadLabel.classList.remove('danger','warn');
  }

  // Clout
  if (player.clout < THRESH.clout.sponsorLock) {
    cloutLabel.classList.add('danger'); cloutLabel.classList.remove('warn');
  } else if (player.clout < THRESH.clout.warn) {
    cloutLabel.classList.add('warn'); cloutLabel.classList.remove('danger');
  } else {
    cloutLabel.classList.remove('danger','warn');
  }

  // Skate
  if (player.skate < THRESH.skate.warn) {
    skateLabel.classList.add('warn');
  } else {
    skateLabel.classList.remove('warn','danger');
  }

  // Sponsor lock badge
  const lock=elSponsorLock;
  lock.style.opacity = player.clout < THRESH.clout.sponsorLock ? '1' : '0';
  lock.textContent = player.clout < THRESH.clout.sponsorLock
    ? '⛔ CLOUT TOO LOW — SPONSORS NOT WATCHING'
    : '';

  // Check grounded trigger
  if (player.academics <= THRESH.academics.ground && !groundedState.active && gameRunning) {
    triggerGrounded('Grades tanked.<br>Parents confiscated your board.<br>Sit tight until curfew lifts.');
  }
}