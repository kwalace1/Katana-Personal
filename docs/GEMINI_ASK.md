# Gemini Flash for Ask (via OpenRouter)

Optional open-ended Ask through OpenRouter. Rules still handle capture, close day, briefing, and action chips.

## Setup

1. Create an API key at [OpenRouter Keys](https://openrouter.ai/keys).
2. Local `.env` (do not commit):

```bash
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=google/gemini-2.5-flash
```

3. Restart `npm run dev` — Vite serves `POST /api/ask-llm` with the same handler as production.
4. Production: add the same vars in Vercel → Settings → Environment Variables, then redeploy.

## Behavior

- Known intents stay rules-based (fast, offline, chip actions).
- Unmatched / open-ended questions call OpenRouter (default Gemini Flash) with a compact life snapshot.
- If the key is missing or the call fails, Ask falls back to the rules default reply.

## Tuning the voice

Edit `KATANA_ASK_SYSTEM_PROMPT` in [`api/ask-llm-core.ts`](../api/ask-llm-core.ts).

## Swapping models

Change `OPENROUTER_MODEL` to any OpenRouter id (e.g. `google/gemini-2.5-flash-lite`) without an app update.
