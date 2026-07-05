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

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `smartprompting.provider` | `gemini` | Which AI provider to use: `gemini`, `openai`, or `anthropic`. |
| `smartprompting.apiKey` | *(empty)* | API key for the selected provider. Leave blank to be prompted, or to fall back to an environment variable. |
| `smartprompting.model` | *(empty)* | Model ID for the selected provider. Leave blank for the provider's default (see table below). |
| `smartprompting.maxQuestions` | `3` | Max clarifying questions per Enhance (0–3). Set to `0` to always skip straight to expansion. |

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

Each Enhance click makes two model calls (generate questions, then expand). At default settings that's roughly a fraction of a cent per use on any provider — the free-tier "flash"/"mini"/"haiku" tiers cost effectively nothing for normal daily use.

## Commands

- **SmartPrompting: Enhance Prompt** — focuses the panel.
- **SmartPrompting: Set API Key** — set or change the stored key for the current provider.

## Requirements

None beyond an API key for your chosen provider (free tier available for Gemini).
