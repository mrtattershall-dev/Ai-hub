#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
repo=$PWD
units="$HOME/.config/systemd/user"
mkdir -p "$units"
cat > "$units/legasus.slice" <<'UNIT'
[Unit]
Description=Legasus background workload budget
[Slice]
MemoryAccounting=yes
MemoryHigh=1G
MemoryMax=2G
MemorySwapMax=2G
TasksMax=768
UNIT
for job in hub gather fuzz watchers; do
  cat > "$units/legasus-$job.service" <<UNIT
[Unit]
Description=Legasus $job (memory guarded)
StartLimitIntervalSec=0
[Service]
Type=simple
WorkingDirectory=$repo
ExecStart=/bin/bash "$repo/scripts/unattended-job.sh" $job
Slice=legasus.slice
Restart=always
RestartSec=30
KillMode=control-group
TimeoutStopSec=30
OOMPolicy=stop
Nice=10
[Install]
WantedBy=default.target
UNIT
done
# Inspector is a periodic maintenance task, never a tight restart loop.
sed -i 's/Type=simple/Type=oneshot/; s/Restart=always/Restart=no/' "$units/legasus-watchers.service"
sed -i '/Restart=no/a SuccessExitStatus=SIGTERM' "$units/legasus-watchers.service"
cat > "$units/legasus-client.service" <<UNIT
[Unit]
Description=Legasus web client
StartLimitIntervalSec=0
[Service]
WorkingDirectory=$repo
ExecStart=/usr/bin/npm run dev --prefix client -- --host 127.0.0.1
Slice=legasus.slice
Restart=always
RestartSec=15
KillMode=control-group
Environment=NODE_OPTIONS=--max-old-space-size=384
[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable legasus-hub.service legasus-client.service legasus-gather.service legasus-fuzz.service legasus-watchers.timer
# Start only after tests and the previous hub have been shut down.
echo 'Installed. Start with: systemctl --user start legasus-hub legasus-client legasus-gather legasus-fuzz legasus-watchers.timer'
