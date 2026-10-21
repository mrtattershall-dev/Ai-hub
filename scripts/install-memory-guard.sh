#!/usr/bin/env bash
# Run as root once. No existing swap is removed or reformatted.
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run this script with sudo.'; exit 1; }
SWAP=/var/lib/legasus-swap
if ! swapon --show=NAME --noheadings | grep -Fxq "$SWAP"; then
  if [[ -e "$SWAP" ]]; then
    [[ $(blkid -p -s TYPE -o value "$SWAP") == swap ]] || { echo 'Existing path is not swap; refusing to overwrite.'; exit 1; }
  else
    available=$(df --output=avail -k /var/lib | tail -1)
    (( available > 20 * 1024 * 1024 )) || { echo 'Need at least 20 GiB free disk.'; exit 1; }
    install -m 600 /dev/null "$SWAP"
    dd if=/dev/zero of="$SWAP" bs=1M count=12288 status=progress conv=fsync
    mkswap "$SWAP"
  fi
  chmod 600 "$SWAP"
  swapon "$SWAP"
fi
grep -q '^/var/lib/legasus-swap ' /etc/fstab || echo '/var/lib/legasus-swap none swap sw 0 0' >> /etc/fstab
mkdir -p /etc/systemd/system/ollama.service.d
cat > /etc/systemd/system/ollama.service.d/legasus-memory.conf <<'UNIT'
[Unit]
StartLimitIntervalSec=0
[Service]
Restart=always
RestartSec=15
MemoryAccounting=yes
MemoryHigh=3G
MemoryMax=4G
MemorySwapMax=8G
OOMPolicy=stop
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_MAX_QUEUE=4"
Environment="OLLAMA_CONTEXT_LENGTH=8192"
Environment="OLLAMA_KEEP_ALIVE=2m"
UNIT
systemctl daemon-reload
systemctl restart ollama
systemctl show ollama -p ActiveState -p MemoryHigh -p MemoryMax -p MemorySwapMax
swapon --show
