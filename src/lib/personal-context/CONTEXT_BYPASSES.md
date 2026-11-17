# PersonalContext bypasses (Phase 4.0 review)

PersonalContext (`buildPersonalContext`) is the intended shared situation model.
Ask opening, Ask LLM, and Today already consume it. These paths still assemble
life/focus data independently. Phase 4.0 does **not** rewrite them; this note
records which bypasses create meaningful inconsistency.

| Path | Rebuilds | Meaningful inconsistency? | Notes |
|------|----------|---------------------------|--------|
| `answerQuestionWithActions` (`engine.ts`) | `buildSnapshot` only | **Yes (moderate)** | Rules coaching misses workload/conflicts and does not receive the full memory slice (only about-me / memory intents). Focus can differ from Today after `dayClosed`. |
| `engine-orchestration.ts` / `share-more.ts` | `pickNextStep` + `assessContextGaps` | **Yes (low–moderate)** | Recomputes focus/gaps; usually same inputs, but can drift if `dayClosed` / prefs differ. |
| `orchestration-nudge` / push | `buildSnapshot` + pick | **Yes (moderate)** | Notifications can recommend a different next step than Today/Ask open. |
| `ask-tools.ts` task/habit lookup | `buildSnapshot` | **No (cost only)** | Lookup correctness unaffected; extra reads. |
| `compactSnapshot` without PersonalContext | Life only | **Yes if reused** | Omits memory, workload, conflicts. Ask LLM path uses `compactPersonalContext` when PC is passed. |
| Dashboard unused workload fields | — | **No** | Builds PC correctly; workload/conflicts stored but not rendered. |

## Fixed in Phase 4.0

- Ask now passes `dayClosed: dayClosedToday(preferences)` into every `buildPersonalContext` call on AskPage (open, LLM, clear).

## Deferred (not 4.0)

- Threading PersonalContext through `answerQuestionWithActions` (candidate for 4.5).
- Notification nudge alignment with PersonalContext.
