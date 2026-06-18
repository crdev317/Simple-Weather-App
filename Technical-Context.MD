# Technical Context

Engineering-practice contract for code-writing agents in this project. Every implementation must respect what's written here. If a constraint conflicts with the user's request, flag the conflict — don't silently bypass it.

> Versions below reflect the intended stack as of 2026-06-17 (greenfield). Pin them in `package.json` when scaffolding; reconcile this doc whenever they change.

## Overriding Principles
1. **No secrets in source.** Any API key or secret is loaded from a Vite env var (`import.meta.env.VITE_*`), never hardcoded. The current weather provider (Open-Meteo) needs no key, so this principle is dormant — but it binds the moment any keyed service is added. Frontend bundles are public, so a keyed service must use a key restricted by HTTP referrer.
2. **TypeScript strict mode.** All code is TypeScript with `strict: true`. No plain `.js`, and no `any` escape hatches without an inline justification.
3. **Tests for logic.** Any non-trivial logic — data parsing, unit conversion, formatting, query shaping — ships with a unit test. No untested business logic.
4. **No new dependencies without reason.** Reach for the standard library and the packages already listed below before adding anything. A new dependency requires a clear justification.

## Frameworks
- **React v19** — UI component framework.
- **Vite v7** — dev server and production build tooling (`@vitejs/plugin-react`).
- **TypeScript v5.8** — language; strict mode on (see Overriding Principles).

This is a **frontend-only SPA** — no backend. The browser calls the weather API directly.

## 3rd-party tech
- **Open-Meteo** — weather data (current conditions + forecast) and geocoding (city → coordinates). Free, no API key required, no auth.

## Packages in use
**Framework/build:** react, react-dom, vite, @vitejs/plugin-react, typescript
**Styling:** styled-components (CSS-in-JS, component-scoped)
**Data fetching / server state:** @tanstack/react-query over the native `fetch` API (no separate HTTP client — do not add axios)
**Testing:** vitest, @testing-library/react, @testing-library/jest-dom
**Lint/format:** eslint, prettier — *intended, not yet installed* (no `package.json` entries as of Story #4; add when lint/format tooling is scaffolded)

## Instrumentation
No external monitoring service. Two mechanisms:
- **React Error Boundary** wraps the app to catch render-time errors and show a graceful fallback instead of a blank screen.
- **Console logging** for runtime diagnostics: always log failed API calls (`console.error`) and caught exceptions. Keep `console.log` out of committed code.

## User Feedback Approach
- **Channel:** in-app, inline UI states — loading skeletons/spinners while fetching, inline error messages on failure, and empty/initial states before a search. No toasts, no modals.
- **Tone:** friendly, plain language. Default agent-generated copy to short, human sentences, e.g. _"Couldn't find that city — check the spelling and try again."_ rather than raw error codes.

## Branching and Environments
- **Model:** trunk-based. Short-lived feature branches merge into `main` via pull request.
- **Branches:** `main` (default), feature branches (e.g. `claude/*`).
- **Environments:** local dev (`vite`) today. Production deploy target is **TBD** — not yet chosen.
- **Protected:** `main`.

## Git Guardrails
- Never force-push to `main`.
- Never `git reset --hard`, `git clean`, or delete a branch without explicit confirmation.
- Enforced tooling (pre-commit hooks via `/setup-pre-commit`, command-blocking hooks via `/git-guardrails-claude-code`) is **not yet set up** — decision deferred.
