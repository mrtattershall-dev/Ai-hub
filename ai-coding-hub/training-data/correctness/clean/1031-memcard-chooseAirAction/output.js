function chooseAirAction(p) {
  const input = p.app.input;
  if (input.pressed("dodge")) {
    if (p.app.progression.hasAirDash() && !p.airDashUsed) return "airdash";
  }
  if (input.pressed("heavy")) return "slam";
  if (input.pressed("light")) return "attackAir";
  if (input.pressed("ability")) { p._fireBurst(); return null; }
  return null;
}