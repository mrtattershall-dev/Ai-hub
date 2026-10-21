# Sourced after .env. Shared by the desktop hub, collector, fuzzer and Inspector.
export LEGASUS_RESOURCE_GUARD=1
export LEGASUS_RESOURCE_LOCK="$HOME/.local/state/legasus/heavy.lock"
export LEGASUS_STATUS_DIR="$HOME/.local/state/legasus/status"
export AGENT_AUTO_RECOVER=1
export NUM_CTX=8192
export OLLAMA_KEEP_ALIVE=2m
export MODEL_FIRST_BYTE_S=1800
export GATHER_FIRST_BYTE_S=1800
export MODEL_TIMEOUT_S=3600
export MODEL_STALL_S=300
export AGENT_WORKER_MEMORY=512m
export AGENT_WORKER_CPUS=1
export NODE_OPTIONS=--max-old-space-size=384
