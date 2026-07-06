# SmartPrompting

React-aware prompt enhancer for AI coding assistants. Type a rough prompt, answer a couple of sharp clarifying questions, get back a precise, version-aware prompt to paste into Copilot, Claude Code, Cursor, or whatever you use.

## Setup

1. Get a free API key from one of:
   - **Gemini** (recommended, free tier): https://aistudio.google.com/apikey
   - **OpenAI**: https://platform.openai.com/api-keys
   - **Anthropic (Claude)**: https://console.anthropic.com/settings/keys
2. Open the SmartPrompting panel (activity bar icon) and click **Enhance** — you'll be prompted to paste the key on first use. Or run **SmartPrompting: Set API Key** from the Command Palette anytime.
3. That's it. Open a React project, type a rough prompt, hit Enhance.

No key configured? The extension also reads `GEMINI_API_KEY` / `GOOGLE_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` from your environment (matching whichever provider is selected), so nothing needs typing if one is already set.

## What it does

- **Detects your stack.** Scans `package.json` (monorepo-aware) across 19 categories — router, state, styling, data-fetching, forms, UI kit, icons, testing, animation, charts, tables, drag-drop, notifications, validation, auth, i18n, dates, build tool, backend — plus your React/Next version, App Router vs Pages Router, the active file's imports, and any code you have selected.
- **Suggest libraries.** For categories your project doesn't cover, click **Suggest libraries** for curated, compatibility-tiered picks (high/medium/low) with a reason and what pairs well with it. Accept, cycle to an alternative, dismiss with the **×**, or skip — no library gets pushed onto an already-covered category.
- **"Why?" on demand.** Click **Why?** on any suggestion for an AI-generated explanation tailored to your actual detected stack, not just the generic note. This is the only part of suggestions that calls the API, and only when you click it — nothing generates automatically.
- **Add files for context.** For prompts touching multiple files (e.g. a refactor across pages), click **Add files for context** to pick related files from your workspace. Their contents get fed into Enhance alongside the active file.
- **Asks sharp questions.** Enhance generates 0–3 clarifying questions (skipped automatically if the prompt's already clear, or force this with the **Just expand** button). Answer via dropdowns, or hit Skip.
- **Expands with full context.** The final prompt targets your exact library versions, reuses your existing components/icons/imports, states what NOT to do, and (optionally) grounds itself in current library docs — see `smartprompting.docGrounding` below.
- **Persists across reloads.** Your last prompt/output and a 10-entry history (with re-copy and reuse buttons) survive hiding the panel or restarting VS Code.
- **`@smartprompt` in Copilot Chat.** Type `@smartprompt add a login form` directly in Chat to get the expanded prompt inline — no copy-paste, no interactive questions (that's what the sidebar panel is for).

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `smartprompting.provider` | `gemini` | Which AI provider to use: `gemini`, `openai`, or `anthropic`. |
| `smartprompting.apiKey` | *(empty)* | API key for the selected provider. Leave blank to be prompted, or to fall back to an environment variable. |
| `smartprompting.model` | *(empty)* | Model ID for the selected provider. Leave blank for the provider's default (see table below). |
| `smartprompting.maxQuestions` | `3` | Max clarifying questions per Enhance (0–3). Set to `0` to always skip straight to expansion. |
| `smartprompting.docGrounding` | `false` | Fetch current README excerpts (unpkg, version-exact) for your most version-sensitive detected libraries and include them when expanding. More accurate for fast-moving libraries, adds a few seconds and extra tokens per Enhance. |

### Model choices (roughly cheapest → priciest per call)

| Provider | Model | Notes |
|---|---|---|
| Gemini | `gemini-2.0-flash` | Fastest, free-tier friendly — check quota if you hit `429` |
| Gemini | `gemini-2.5-flash` *(default)* | Strong quality, still cheap and fast |
| Gemini | `gemini-2.5-pro` | Most capable Gemini, more tokens/$ |
| OpenAI | `gpt-4.1-mini` *(default)* | Cheap, capable enough for this task |
| OpenAI | `gpt-4o`, `gpt-5*` | Noticeably higher cost per call |
| Anthropic | `claude-haiku-4-5` | Fastest and cheapest Claude |
| Anthropic | `claude-opus-4-8` *(default)* | Most capable, highest cost |

Each Enhance click makes one or two model calls (question generation is skipped entirely at `maxQuestions: 0` or via **Just expand**). At default settings that's roughly a fraction of a cent per use on any provider — the free-tier "flash"/"mini"/"haiku" tiers cost effectively nothing for normal daily use. Library suggestions themselves are free — that step is local data, no API call — only clicking **Why?** on a specific suggestion makes a (small) call.

## Commands

- **SmartPrompting: Enhance Prompt** — focuses the panel.
- **SmartPrompting: Set API Key** — set or change the stored key for the current provider.

## Requirements

None beyond an API key for your chosen provider (free tier available for Gemini).
