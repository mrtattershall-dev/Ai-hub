function chooseAction(p) {
  const input = p.app.input;
  if (input.pressed("dodge") && p.dodgeCooldown <= 0) return "dodge";
  if (input.pressed("light")) { p.comboIndex = 0; return "attackLight"; }
  if (input.pressed("heavy")) return "attackHeavy";
  if (input.pressed("ability")) { p._fireBurst(); return null; }
  return null;
}