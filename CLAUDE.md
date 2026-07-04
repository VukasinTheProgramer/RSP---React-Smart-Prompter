# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A VS Code extension (TypeScript). Takes a rough coding prompt from a React developer, detects the project's actual stack (React version, router, state lib, styling, etc. from `package.json`), asks Claude a small number of context-aware clarifying questions, then returns an expanded, precise prompt to paste into any AI coding assistant.

Full build plan, phased roadmap, and design rationale: `smartprompting-plan.md`. Read it before making architectural decisions — it documents *why* choices were made (e.g. why 0-question output must be allowed, why questions must be answerable-only-by-the-user).

**Current status:** Phase 0 complete (scaffold only). `src/extension.ts` is still the generator's Hello World boilerplate — no sidebar UI, context detection, or Claude API integration exists yet.

## Commands

```
npm run compile        # type-check + lint + esbuild bundle (dev)
npm run watch          # parallel watch: esbuild --watch + tsc --watch
npm run package        # production bundle (minified, used by vscode:prepublish)
npm run check-types    # tsc --noEmit only
npm run lint           # eslint src
npm test               # compile-tests + compile + lint, then vscode-test
```

Run/debug the extension itself: open this folder in VS Code, press **F5** — launches the Extension Development Host (a second VS Code window) with the extension loaded. Reload that window (Cmd+R) after code changes instead of restarting.

No single-test-file runner is configured; `vscode-test` (via `.vscode-test.mjs`) runs the full suite in `src/test/`.

## Architecture

- `src/extension.ts` — entry point, exports `activate()`/`deactivate()`. All commands, webview providers, and API calls register here (or in modules imported from here).
- `package.json` `contributes` block is the extension manifest surface: commands, sidebar view containers, views, and settings (`smartprompting.*` config) all get declared here before any corresponding TS code can use them.
- Bundling: esbuild (`esbuild.js`), not webpack — output goes to `dist/extension.js`, which is what `package.json` `main` points to.

### Planned architecture (per `smartprompting-plan.md`)

- **Sidebar Webview** (Phase 1): a `WebviewViewProvider` registered against a `views` contribution. Webviews are sandboxed — the panel HTML/JS can only reach the extension host via `postMessage`; there's no direct `vscode` API access inside the panel.
- **Context detection** (Phase 2): reads the workspace's `package.json` (`vscode.workspace.findFiles`) to build a context object (React version, router, state/styling/data-fetching libs, active file type). This object is what makes the tool's questions React-version-aware instead of generic.
- **Claude integration** (Phase 3): two sequential Messages API calls sharing full message history (API is stateless) — (1) generate 0–3 clarifying questions as strict JSON, (2) expand the prompt as plain text using the context object + Q&A pairs. API key is read from extension settings (`smartprompting.apiKey`) via `vscode.workspace.getConfiguration()` — never hardcoded.

When implementing a phase, match its "Done when" criteria in the plan before considering it finished.
