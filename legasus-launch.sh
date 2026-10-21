#!/usr/bin/env bash
# Desktop launcher: warm the local model, start the governed hub if it is not already up, open it.
cd "$(dirname "$0")"
MODEL=$(python3 -c "import json;print(json.load(open('server/hub.json'))['api_keys']['ollama']['model'])" 2>/dev/null || echo qwen3.5:4b)
echo "Warming $MODEL in Ollama..."
curl -s -m 3 -o /dev/null localhost:11434/api/version || echo "Ollama is not answering - is the ollama service running?"
# Load the model in the background: Ollama queues requests, so waiting here would block behind any running job.
( curl -s -o /dev/null localhost:11434/api/generate -d "{\"model\":\"$MODEL\",\"keep_alive\":\"30m\"}" >/dev/null 2>&1 < /dev/null &)
if ss -ltn | grep -q ':5173 '; then
  echo "The hub is already running - opening it."
  xdg-open http://localhost:5173/ >/dev/null 2>&1
  sleep 3
else
  ./start-hub-governed.sh
fi
