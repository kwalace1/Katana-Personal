# Ask LLM (via OpenRouter)

Deeper Ask is a **life-aware general assistant**: streaming replies, multi-turn memory, rich life context, and tools that create/complete tasks, habits, events, journal, water, and close the day.

Rules still handle capture phrases and known day intents offline. Open-ended questions and follow-ups in an LLM thread go through the model.

## Setup

1. Create an API key at [OpenRouter Keys](https://openrouter.ai/keys).
2. Local `.env` (do not commit):

```bash
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=google/gemini-2.5-flash
```

3. Restart `npm run dev` — Vite serves `POST /api/ask-llm` (JSON or SSE when `stream: true`).
4. Production: add the same vars in Vercel → Settings → Environment Variables, then redeploy.

## Behavior

- Free: **3** deeper Ask replies/day; Accountability pack = unlimited.
- Snapshot includes tasks/events (with ids), habits, goals + progress, recent journal excerpts, health, week stats.
- Model may call tools; the **client** executes them against local data, then continues the turn.
- Streaming uses SSE events: `delta` | `tool_calls` | `done` | `error`.
- Follow-ups after an LLM reply stay in the LLM thread (counts toward the free daily limit).

## Tuning

- Voice / personality: `KATANA_ASK_SYSTEM_PROMPT` in [`api/ask-llm-core.ts`](../api/ask-llm-core.ts)
- Tools: `ASK_TOOL_DEFINITIONS` (same file) + client runners in `src/modules/assistant/ask-tools.ts`

## Swapping models

Change `OPENROUTER_MODEL` to any OpenRouter id without an app update.
