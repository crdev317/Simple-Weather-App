# Technical Context

Engineering-practice contract for code-writing agents in **simple-weather-desktop-app**. Every implementation must respect what's written here. If a constraint conflicts with the user's request, flag the conflict — don't silently bypass it.

> Versions below reflect the intended stack as of 2026-06-18 (greenfield). Pin them in `package.json` / `Cargo.toml` when scaffolding; reconcile this doc whenever they change.

## Overriding Principles
1. **Networking lives in the Rust core.** The webview never makes direct external HTTP calls. All outbound IO (Open-Meteo) goes through typed Tauri commands in Rust. This keeps the webview's network surface minimal and gives one place to test, log, and harden the integration seam.
2. **Least-privilege Tauri capabilities.** The Tauri v2 capability/permission allowlist grants only what the app needs (the commands the frontend invokes — nothing more). No blanket `fs`/`shell`/`http` permissions to the webview. A new capability requires a clear justification.
3. **No secrets in source.** Open-Meteo is keyless, so this is currently dormant. The moment a keyed service is added, the key lives in the **Rust core** (loaded from the OS secure store via `keyring`-equivalent, never the webview bundle) and is never committed. The frontend bundle is shippable and must be treated as public.
4. **Strict typing on both sides.** Frontend is TypeScript with `strict: true` — no plain `.js`, no `any` without an inline justification. Rust builds clean under `clippy` with no warnings.
5. **Tests for logic.** Any non-trivial logic — data parsing, unit conversion, formatting, query shaping, command payload mapping — ships with a test (`vitest` on the frontend, `cargo test` in Rust). No untested business logic.
6. **No new dependencies without reason.** Reach for the standard library and the packages already listed below before adding anything. A new crate or npm package requires a clear justification.

## Frameworks
- **Tauri v2** — desktop shell: Rust core + the OS-native system webview, plus packaging/updater. The app's backend (commands, networking) is Rust; the UI is web.
- **Rust (stable)** — the core/backend: Tauri commands, Open-Meteo networking, typed payloads.
- **React v19** — UI component framework, running in the webview.
- **TypeScript v5.x** — frontend language; strict mode on (see Overriding Principles).
- **Vite v7** — frontend dev server and production bundler (Tauri's default frontend tooling; `@vitejs/plugin-react`).

This is a **two-process app**: a Rust core and a web frontend that talk over the Tauri `invoke` command boundary. There is no separate backend server.

## 3rd-party tech
- **Open-Meteo** — weather data (current conditions + forecast) and geocoding (city → coordinates). Free, no API key required, no auth. Called **from the Rust core via `reqwest`**, never directly from the webview.

## Packages in use
**Frontend framework/build:** react, react-dom, vite, @vitejs/plugin-react, typescript
**Tauri bindings (frontend):** @tauri-apps/api, @tauri-apps/cli *(dev)*
**Data / server state:** @tanstack/react-query, wrapping Tauri `invoke` calls (cache/loading/error state over the command boundary) — do **not** add axios or call `fetch` to external hosts from the frontend.
**Styling:** styled-components (CSS-in-JS, component-scoped) — matches the house style; revisit if a design system is adopted.
**Rust crates:** tauri, serde + serde_json (typed command payloads), reqwest (HTTP to Open-Meteo), tokio (async runtime), tauri-plugin-log (logging bridge)
**Frontend testing:** vitest, @testing-library/react, @testing-library/jest-dom
**Rust testing:** built-in `cargo test`; tauri-driver / WebDriver for end-to-end where a real window is needed
**Lint/format:** eslint, prettier (frontend); rustfmt + clippy (Rust) — *intended; install when tooling is scaffolded.*

## Instrumentation
No external monitoring service. Logging spans both processes:
- **Frontend:** a **React Error Boundary** wraps the app to catch render-time errors and show a graceful fallback instead of a blank window. `console.error` for failed `invoke` calls and caught exceptions. Keep `console.log` out of committed code.
- **Rust core:** structured logging via **tauri-plugin-log** (bridges Rust logs to the webview console and a log file). Always log: every outbound Open-Meteo request and its failures, command errors, and caught panics.
- **Levels:** `ERROR` (failed external call / command error), `WARN` (degraded/retry), `INFO` (lifecycle), `DEBUG` (dev only, not noisy in release).

## User Feedback Approach
- **Channel:** in-app, inline UI states — loading skeletons/spinners while a command is in flight, inline error messages on failure, and empty/initial states before a search. No toasts, no modals. (Native OS notifications may be added later, but inline is the default.)
- **Tone:** friendly, plain language. Default agent-generated copy to short, human sentences, e.g. _"Couldn't find that city — check the spelling and try again."_ rather than raw error codes.

## Branching and Environments
- **Model:** trunk-based (see `CONTRIBUTING.md`). HITL work lands via PR branches; AFK work uses one `story/<issue#>-<slug>` branch per Story, squash-merged into `main`.
- **Branches:** `main` (default, protected), `story/*` (AFK), `claude/*` / feature branches (HITL).
- **Environments:** local dev (`tauri dev`). Distribution is packaged per-OS desktop binaries/installers via `tauri build`; release channel **TBD**. No server environments — there is no backend service.
- **Protected:** `main` (no direct pushes; PR + passing `ci` required).

## Git Guardrails
- Never force-push to `main`.
- Never `git reset --hard`, `git clean`, or delete a branch without explicit confirmation.
- Enforced tooling (pre-commit hooks via `/setup-pre-commit`, command-blocking hooks via `/git-guardrails-claude-code`) is **not yet set up** — decision deferred.

## Testing & the ratchet
> Seeded from the Factory standard — **opt-out, not opt-in**. Trim a line only with a deliberate, recorded decision; don't start from nothing. Full standard: <https://github.com/kitcox-dev/enate-claude-skills/blob/main/docs/testing-and-the-ratchet-standard.md> · the *why*: <https://github.com/kitcox-dev/enate-claude-skills/blob/main/docs/agentic-e2e-testing-principles.md>.
>
> **Recorded adaptation (2026-06-18):** this product has **no LLM**. Read every "LLM" reference in the standard as **"the external service (Open-Meteo)"** — the nondeterministic source whose responses are replayed as recorded fixtures at Tier 1 and hit live at Tier 2/3. The deterministic-envelope discipline applies unchanged.

- **Test the contract, not the external service.** Assert on the deterministic envelope (the typed command payload shape, state transition, side-effect ordering), never on Open-Meteo's exact response text or transient fields.
- **Every seam gets a real-IO test on at least one side.** The primary seam is the **Tauri `invoke` command boundary** (frontend ↔ Rust). Mock-on-both-sides only proves the mocks agree; defects live at integration seams. So: Rust commands tested against real Open-Meteo (Tier 2/3) or recorded fixtures (Tier 1); the frontend tested against a real `invoke` to a test harness or replayed fixtures.
- **Three tiers, each catching a class the others can't.** Tier 1 — recorded-replay (real local IO, fakes at the seams, replayed Open-Meteo fixtures; every commit); Tier 2 — live-service, disposable (real subprocess/window against live Open-Meteo with a per-run throwaway substrate; bounded cost, scheduled); Tier 3 — live (real distribution build + real service; continuous/release).
- **Platform matrix is non-negotiable.** Tauri is OS-touching (native webview, filesystem, subprocess, packaging). OS-touching code runs Tier 1 + Tier 2 on **every** OS the app ships to (Windows / macOS / Linux), not just the dev box's.
- **Plan test coverage at the Feature level, not the Story level.** Each Feature declares at kickoff which tiers it needs, which fixtures/substrates must exist, and a Tier-2 cost ceiling.
- **The ratchet — every Tier-3 defect pins a cheap-tier regression.** A live defect's fix lands with a Tier-1 (or Tier-2) regression that would have caught it, encoding the **class** of defect **bounded by the seam** where it surfaced — not the exact reproducer, and not a project-wide sweep. A Story that surfaced from a live defect carries that ratcheting fixture as an acceptance criterion.
- **Disposable substrate, not shared.** Tier-2 substrate is created per run and torn down; reproducibility comes from a seed (fixture tarball/manifest/script), never persistent state.
- **Assert on observable behaviour, not internal state.** For Tier 2/3 the target is what an operator could verify from external artefacts — the rendered window state, log events, the command's returned payload.
