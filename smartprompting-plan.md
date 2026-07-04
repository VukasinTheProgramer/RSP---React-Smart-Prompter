# SmartPrompting — Detailed MVP Build Plan

**What it is:** A VS Code extension for React developers that takes a rough coding prompt, asks sharp, context-aware clarifying questions (based on the actual project: React version, libraries installed), and outputs an expanded, precise prompt the developer can paste into any AI assistant (Copilot, Claude Code, Cursor, etc.).

**The wedge (why this vs existing tools):** Generic prompt enhancers (PromptDC, VS Code's built-in /create-prompt) ask generic questions. SmartPrompting asks React-specific, version-aware questions — e.g. it knows you're on React Router v6 and won't let the AI suggest v5 patterns. Depth on one framework, not breadth across all of them.

**Timeline:** No fixed deadline. Estimates below assume a few evenings per week at a "can read JS/TS, not professional" skill level. Total realistic range: 4–8 weeks to a usable MVP.

---

## Phase 0 — Environment Setup

**Goal:** A scaffolded extension running in VS Code's Extension Development Host.

**Estimated effort:** 2–4 hours

### Steps
1. Install Node.js (LTS version) if not already installed. Verify with `node -v` and `npm -v`.
2. Install the extension generator:
   ```
   npm install -g yo generator-code
   ```
3. Scaffold the project:
   ```
   yo code
   ```
   - Choose: **New Extension (TypeScript)**
   - Name: `smartprompting`
   - Answer defaults for the rest (bundler: esbuild is fine)
4. Open the generated folder in VS Code, press **F5**. A second VS Code window opens (the Extension Development Host). Run the sample "Hello World" command from the Command Palette to confirm everything works.
5. Initialize a git repo and make your first commit.

### Key files you'll be living in
| File | What it does |
|---|---|
| `package.json` | Extension manifest: name, commands, activation events, sidebar contributions |
| `src/extension.ts` | Entry point: `activate()` runs when your extension loads |
| `tsconfig.json` | TypeScript config — you won't touch this much |

### Done when
- F5 launches the dev host and the sample command works.

---

## Phase 1 — Sidebar UI

**Goal:** A SmartPrompting panel in the sidebar with a prompt input box and an "Enhance" button. No AI yet — clicking the button just echoes the text back.

**Estimated effort:** 3–6 evenings (Webviews are the fiddliest part of the whole project for a newcomer)

### Steps
1. In `package.json`, register a **Webview View** in the sidebar:
   - Add a `viewsContainers` entry (your icon in the Activity Bar) and a `views` entry pointing to it.
2. In `src/extension.ts`, implement a `WebviewViewProvider`:
   - Its `resolveWebviewView` method sets `webview.html` to your panel's HTML.
3. Write the panel HTML (keep it in a template string or separate file):
   - A `<textarea>` for the rough prompt
   - An "Enhance" button
   - An output `<div>`
4. Wire message passing (this is the core Webview pattern you'll reuse constantly):
   - Panel → extension: `vscode.postMessage({ type: 'enhance', prompt: text })`
   - Extension → panel: `webview.postMessage({ type: 'result', text: ... })`
5. For now, the extension just sends the same text back and the panel displays it.

### Watch out for
- Webviews are sandboxed iframes — you can't call VS Code APIs from inside them; everything goes through `postMessage`.
- State resets when the panel hides. Don't worry about persisting state in the MVP.

### Done when
- You type a prompt, hit Enhance, and see it echoed in the output area.

---

## Phase 2 — Context Detection

**Goal:** The extension builds a "context object" describing the user's project: React version, detected libraries + versions, current file type.

**Estimated effort:** 2–4 evenings

### Steps
1. **Detect the active file type:**
   - `vscode.window.activeTextEditor.document.languageId` → look for `javascriptreact` / `typescriptreact`.
2. **Find and parse `package.json`:**
   - `vscode.workspace.findFiles('package.json', '**/node_modules/**', 1)`
   - Read it, `JSON.parse`, merge `dependencies` + `devDependencies`.
3. **Detect React + key libraries.** Check for these packages (v1 priority list):
   - `react` (and version — strip the `^`/`~` prefix)
   - `react-router-dom` (v5 vs v6 is the classic version trap)
   - State: `@reduxjs/toolkit`, `redux`, `zustand`, `jotai`, `recoil`
   - Data fetching: `@tanstack/react-query`, `swr`, `axios`
   - Styling: `tailwindcss`, `styled-components`, `@emotion/react`, `sass`
   - Meta-framework: `next` (App Router vs Pages Router matters a lot)
   - Forms: `react-hook-form`, `formik`
4. **Build the context object**, e.g.:
   ```json
   {
     "isReactFile": true,
     "react": "18.2.0",
     "next": null,
     "router": "react-router-dom@6.21.0",
     "state": "zustand@4.4.0",
     "styling": "tailwindcss@3.4.0",
     "dataFetching": null,
     "forms": null,
     "activeFileName": "UserProfile.tsx"
   }
   ```
5. **Optionally include a code snippet:** if the user has text selected in the editor, grab it with `editor.document.getText(editor.selection)` and attach it to the context. This makes the AI's questions dramatically sharper for near-zero effort.
6. Display the detected context in the sidebar (small "Detected: React 18.2, Zustand, Tailwind" line) so the user can see the tool understood their project. This builds trust and helps you debug.

### Done when
- Opening a React project shows the correct detected stack in the panel.

---

## Phase 3 — AI Integration (the core)

**Goal:** Claude generates 1–3 targeted clarifying questions; after the user answers, it produces the expanded prompt.

**Estimated effort:** 1–2 weeks of evenings. This is where most of the thinking lives.

### 3a. API plumbing
1. Get an Anthropic API key (console.anthropic.com).
2. Store it via extension settings: add a `configuration` section in `package.json` (`smartprompting.apiKey`), read it with `vscode.workspace.getConfiguration()`. Never hardcode it.
3. Call the Messages API from the extension host (plain `fetch` works in modern VS Code's Node runtime, or use the official `@anthropic-ai/sdk` npm package — the SDK is easier).
4. Handle errors visibly: no key set, network failure, rate limit → show a clear message in the panel, not a silent failure.

### 3b. The two-step conversation flow
**Step 1 — Generate questions.** Send: system prompt + context object + user's rough prompt. Ask Claude to return **JSON only**: an array of 0–3 questions, each with 2–4 suggested answer options. (0 questions is allowed — if the prompt is already clear, skip straight to expansion. This matters: unnecessary questions are how the tool becomes annoying.)

**Step 2 — Expand the prompt.** Send: same context + original prompt + the Q&A pairs. Ask for the final expanded prompt as plain text.

Keep the full message history across both calls — the API is stateless, so you resend everything each time.

### 3c. System prompt design (draft to start from, then iterate)
Core instructions to include:
- Role: "You are a React specialist helping a developer refine a coding prompt before sending it to an AI assistant."
- Use the context object: reference the *actual* detected versions. If `react-router-dom@6` is detected, questions and the final prompt must target v6 idioms explicitly.
- Question quality bar: only ask questions whose answer would *change the generated code*. Never ask something answerable from the context object or the code snippet. Max 3 questions, fewer is better.
- Expanded prompt format: state the goal, the file/component involved, the exact library versions to target, constraints (styling approach, state pattern already in use), and what NOT to do (e.g. "do not introduce Redux; this project uses Zustand").
- Output format: strict JSON for step 1 (specify the schema in the prompt); plain text for step 2.

### 3d. UI for the flow
- After Enhance: render the questions in the panel as radio buttons / short text inputs.
- "Skip questions" button — power users will want to bypass.
- After answers submitted: show the expanded prompt with a **Copy** button (`navigator.clipboard.writeText` works inside Webviews).

### Done when
- Full loop works end-to-end on a real React project: rough prompt → smart questions → expanded prompt → copy.

---

## Phase 4 — Polish the Loop

**Goal:** Make the happy path smooth enough for daily personal use.

**Estimated effort:** 2–4 evenings

- Loading states (spinner while waiting on the API — calls take a few seconds).
- "Start over" button to reset the panel.
- Cache the context object per workspace; re-detect only when `package.json` changes (watch it with `vscode.workspace.createFileSystemWatcher`).
- Keyboard shortcut / command palette entry ("SmartPrompting: Enhance Prompt") that focuses the panel.
- A settings toggle for max number of questions (some users will want 0-question "just expand it" mode).

---

## Phase 5 — Validation (the most important phase)

**Goal:** Find out if this is actually better than typing into Copilot Chat directly.

**Duration:** 2+ weeks of real usage

### Method
1. Use it yourself on every real React task for two weeks. Every time, note:
   - Were the questions useful or annoying? (Count skips.)
   - Did the expanded prompt produce noticeably better AI output than your rough prompt would have? Try both occasionally — rough prompt in Copilot vs expanded prompt in Copilot — and compare.
2. Get 2–3 other React developers to try it (friends, classmates, a Discord/Reddit React community). Watch them use it if possible; where they hesitate is where the UX is broken.
3. The honest kill/continue criteria:
   - **Continue** if you and testers keep reaching for it voluntarily after the novelty wears off.
   - **Rethink** if everyone skips the questions, or the expanded prompts aren't visibly better — that would mean the core hypothesis failed, and no amount of features fixes that.

---

## Post-MVP Roadmap (only if Phase 5 validates)

In rough priority order:
1. **Live doc grounding (RAG):** when a library is detected, fetch the relevant current docs page (react.dev, TanStack docs, etc.) at prompt time and include key excerpts in the API call. This directly attacks the "model knowledge is stale for libraries" problem — your strongest differentiator.
2. **Deeper code awareness:** parse imports in the active file (light AST via something like `@babel/parser`) instead of relying only on `package.json`.
3. **Direct hand-off:** send the expanded prompt straight into Copilot Chat via VS Code's Chat/Language Model APIs (chat participant, e.g. `@smartprompt`) instead of copy-paste.
4. **Marketplace publishing:** publisher account, icon, README with GIF demo, CI for packaging (`vsce package`).
5. **Second framework** (Vue or Next.js-specific depth) — only after React feels genuinely great.

---

## Skills You'll Pick Up Along the Way
- **Phase 0–1:** VS Code extension anatomy, Webview message passing, a working level of TypeScript
- **Phase 2:** workspace/file APIs, JSON parsing, version-string handling
- **Phase 3:** calling LLM APIs, prompt engineering, structured (JSON) outputs, multi-turn conversation state
- **Phase 5:** product validation — the difference between "I built it" and "people want it"

## Cost Notes
- Building: free (all tooling is free).
- Running: Claude API usage — pennies per enhancement at MVP scale with a smaller model (Haiku-class is likely enough for question generation; try a bigger model only for the expansion step if quality demands it).
- Publishing to the Marketplace: free.

## Biggest Risks (ranked)
1. **The questions feel annoying rather than smart** → mitigated by the "0 questions allowed" rule and the skip button; iterate hard on the system prompt.
2. **Copilot/Cursor ship this natively** → real risk; your defense is React-specific depth + doc grounding, which generalist tools won't prioritize.
3. **Webview UI frustration slows you down early** → keep the UI ugly-but-functional; do not polish before Phase 5.
