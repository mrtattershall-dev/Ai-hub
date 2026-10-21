#!/usr/bin/env bash
# Never sleep, suspend or hibernate - including with the lid closed. Run once with sudo; undo with: sudo ./no-sleep.sh --undo
set -e
if [ "$1" = "--undo" ]; then
  rm -f /etc/systemd/logind.conf.d/99-legasus-no-sleep.conf
  systemctl unmask sleep.target suspend.target hibernate.target hybrid-sleep.target suspend-then-hibernate.target
  kill -HUP "$(pidof systemd-logind)" 2>/dev/null || true
  echo "Sleep restored to the system defaults."; exit 0
fi
mkdir -p /etc/systemd/logind.conf.d
cat > /etc/systemd/logind.conf.d/99-legasus-no-sleep.conf <<'CONF'
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
IdleAction=ignore
CONF
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target suspend-then-hibernate.target
# Reload logind's settings without restarting it (a restart can end the desktop session).
kill -HUP "$(pidof systemd-logind)" 2>/dev/null || true
echo "Done: the laptop will not sleep, suspend or hibernate, even with the lid closed."
systemctl is-enabled sleep.target suspend.target hibernate.target 2>/dev/null | paste -sd' '
