# AI Coding Hub

> **Orientation — this repository contains two distinct things.**
>
> **The AI Coding Hub** (documented below) is a standalone multi-provider coding UI. It is a real
> product, it predates the research programme, and it keeps its name.
>
> **[Legasus](LEGASUS.md)** is the software-engineering architecture and research programme developed in
> this repository, using the hub and its goal sets as experimental substrate. Legasus is the parent
> identity for the architecture and its components — **LegaCore** (orchestration and planning),
> **LegaGate** (risk estimation and authority control), **LegaVerify** (truth and commit authority),
> **LegaParse** (deterministic program analysis), **LegaLabs** (research and measurement), and
> **LegaEngine** (AI-native creative environment, in a separate repository).
>
> LEGACY + PEGASUS. *Preserve what already works; extend it without regenerating or destroying it.*
> The research question: **how much neural scale remains necessary once software-engineering
> responsibilities that do not inherently require neural generation are externalized into deterministic,
> testable machinery?**
>
> | | |
> |---|---|
> | Identity, vocabulary, glossary | [`LEGASUS.md`](LEGASUS.md) |
> | Intended direction and predictions | [`LEGASUS_DIRECTION.md`](LEGASUS_DIRECTION.md) |
> | Findings and raw evidence | [`measurements/2026-09-13-setH-1p5b/README.md`](measurements/2026-09-13-setH-1p5b/README.md) |
>
> Findings are kept separate from direction on purpose. Historical logs, commit messages and frozen
> experiment artifacts do not use the Legasus vocabulary and are deliberately not rewritten to.

---

A standalone, self-hosted hub for working with multiple AI providers from one
UI: a **Code** tab for explain/refactor/debug/generate-style tasks, a
**Strategy** tab for structured project planning (project maps, action plans,
architecture sketches, reviews), persistent **History**, and a **Settings**
tab for managing API keys per provider.

- **Client**: React 18 + Vite + Zustand
- **Server**: Express + better-sqlite3 (SQLite file, no external DB needed)
- **Providers supported**: Claude (Anthropic), OpenAI, DeepSeek, Kimi
  (Moonshot), Mistral, Groq, and Ollama (local, no key required)

## Project structure

```
ai-hub/
├── server/           Express API + SQLite storage
│   ├── index.js
│   └── package.json
├── client/           React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/        api client, prompt builders, markdown renderer
│   │   └── store/       zustand global state
│   └── package.json
└── package.json      root scripts (run both with one command)
```

## Setup

Requires Node.js 18+ (for native `fetch` in the server and `crypto.randomUUID`).

```bash
cd ai-hub
npm run install:all
```

This installs dependencies in both `server/` and `client/`.

## Running

From the project root:

```bash
npm run dev
```

This starts:
- the API server on `http://localhost:3001`
- the Vite dev server on `http://localhost:5173` (proxies `/api` to the server)

Open `http://localhost:5173` in your browser.

Alternatively, run each piece separately:

```bash
npm run server   # API on :3001
npm run client   # UI on :5173
```

## Adding API keys

Go to the **Settings** tab and paste an API key for any provider you want to
use (OpenAI, Claude, DeepSeek, Kimi, Mistral, Groq). Keys are stored server-side
in `server/hub.db` (SQLite) and are never sent back to the browser.

You can also override the default model or base URL per provider - useful for
self-hosted/compatible endpoints (e.g. an OpenAI-compatible proxy, or a custom
Mistral/Groq deployment).

**Ollama** runs locally and needs no API key - just make sure `ollama serve`
is running on `http://localhost:11434` (or set a custom base URL in Settings).

## How requests are routed

The server normalizes every provider into one of three request shapes:

- **anthropic** (Claude): `POST {base_url}/v1/messages`
- **openai-compatible** (OpenAI, DeepSeek, Kimi, Mistral, Groq, and any other
  OpenAI-compatible endpoint): `POST {base_url}/v1/chat/completions`
- **ollama**: `POST {base_url}/api/generate`

Both streaming (SSE) and non-streaming requests are supported. Every
completed request (with prompt, response, token usage, and duration) is saved
to the `history` table and is browsable from the History tab.

## Building for production

```bash
npm run build   # builds the client into client/dist
npm run server  # serve the API (you'd typically put a static file server
                 # or reverse proxy in front of client/dist + the API)
```

## Notes

- Provider responses are rendered as lightly-formatted markdown (headers,
  bold, lists, links, fenced code blocks).
- The Strategy tab asks the model to respond with specific `##` section
  headers (e.g. *Overview*, *Key Components*, *Dependencies*) and renders
  each section as its own card.
- Token counts come from provider usage data when available, and are
  estimated otherwise.
