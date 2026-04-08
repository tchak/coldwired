# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Toolchain

This project uses **Vite+** via the global `vp` CLI. See `AGENTS.md` for full details — the key rules:

- Use `vp` commands directly; do **not** invoke `pnpm`/`npm`/`yarn`/`bun` to run tools.
- `vp test`, `vp check`, `vp lint`, `vp fmt` run the built-in Vitest / Oxlint / Oxfmt / tsgo — there is no `vp vitest` or `vp oxlint`.
- Built-in `vp` commands take precedence over `package.json` scripts of the same name. Use `vp run <script>` to force a script.
- Import test/config helpers from `vite-plus` (e.g. `import { defineConfig } from 'vite-plus'`), never from `vite` or `vitest` directly.
- Do not install `vitest`, `oxlint`, `oxfmt`, or `tsdown` — they are wrapped by `vp`.

## Commands

- `vp install` — install deps (run after pulling).
- `vp check` — format + lint + TypeScript type check. Lint is type-aware (`typeAware: true`) via `vite.config.ts`.
- `vp test` — run the full test suite. Tests run in a **real browser** via Playwright across chromium, firefox, and webkit (see `test.browser.instances` in `vite.config.ts`). Playwright browsers must be installed locally.
- `vp test <path>` — run a single test file, e.g. `vp test src/actions.test.ts`.
- `vp test -t "<name>"` — filter by test name.
- `vp run build` — build the library (wraps `vp pack`). Produces multi-entry ESM output in `dist/` plus d.ts via tsgo, with `attw` and `publint` checks enabled.
- `vp run dev` — `vp pack --watch` for library dev.

Before finishing a change, run `vp check` and `vp test`.

## Architecture

Coldwired is a small multi-entry library for applying incremental DOM updates while preserving client-side state (open dialogs, input values, focus, class names, ARIA attributes). It was inspired by Hotwire's turbo-stream, but the core differentiator is state preservation across morphs.

### Package entry points (`src/*.ts` → `dist/*.mjs`)

Declared in `vite.config.ts` under `pack.entry` and re-exported in `package.json#exports`:

- `coldwired/actions` — the core `Actions` class and action schema.
- `coldwired/react` — React integration: rendering React components inside morph targets and preserving them across updates.
- `coldwired/turbo-stream` — a turbo-stream compatible parser that converts `<turbo-stream>` elements into `Action` objects and applies them via `Actions`.
- `coldwired/utils` — shared helpers.

Each entry has its own `*.test.ts(x)` file next to it in `src/`.

### Core concept: `Actions` (`src/actions/`)

`Actions` (in `actions.ts`) is the runtime. On `observe()` it installs a `MutationObserver` plus two helper observers (`attribute-observer.ts`, `class-list-observer.ts`) to snapshot "interactive" DOM state into a `WeakMap` (see `metadata.ts`). When an action replaces/updates a subtree, `morph.ts` (built on `morphdom`) reuses existing nodes and the recorded metadata is re-applied — this is how user edits to class names, aria state, and input values survive a re-render. The `data-turbo-force` attribute opts a subtree out of this preservation.

An `Action` is a plain serializable object (`{ action, targets, fragment?, delay?, pin? }`) with action kinds `after | before | append | prepend | replace | update | remove | focus | enable | disable | hide | show`. They are applied either directly on an `Actions` instance or by dispatching a custom event that the instance listens for (see `dispatchAction` / the top-level functions re-exported from `src/actions.ts`). `pin: true` records the action so that after a full-page morph, `applyPinnedActions()` can replay client-side changes that would otherwise be wiped.

`schema.ts` defines the Zod schema for actions (used by the turbo-stream parser to validate incoming actions). `plugin.ts` is the extension point by which `react` and `turbo-stream` hook into the `Actions` instance.

### React integration (`src/react/`)

The React plugin attaches to an `Actions` instance and lets morph targets contain React subtrees. `root.ts` / `root.react.tsx` manage a React root per container; `tree-builder.react.ts` walks incoming HTML fragments and reconstructs the React element tree so that morphing a fragment into a React-owned container updates the React tree in-place instead of trashing it. `preload.ts` handles lazy component loading. Any change to morph/plugin behavior in `src/actions/` must be cross-checked against the React plugin, which relies heavily on metadata and the mutation observer ordering.

### Turbo-stream (`src/turbo-stream.ts`)

A thin adapter: parses `<turbo-stream>` HTML, validates with the Zod schema from `actions/schema.ts`, and forwards to `Actions`. No network transport is included — it is just the DOM-side of turbo-stream.

### Tests

Tests live alongside sources in `src/` and run inside real browsers via `vite-plus/test/browser-playwright`. `src/__screenshots__/` holds visual snapshots. Because the whole suite is browser-based, a failing test run often means the Playwright browsers aren't installed (`vp dlx playwright install`) rather than a code issue.

### Version Control

**IMPORTANT: ALWAYS use jj (Jujutsu). NEVER use git commands directly.**

This project uses jj as its version control interface. Do not use `git add`, `git commit`, `git status`, `git diff`, `git log`, or any other git commands. Always use the jj equivalents:

| Instead of              | Use                  |
| ----------------------- | -------------------- |
| `git status`            | `jj status`          |
| `git diff`              | `jj diff`            |
| `git add && git commit` | `jj commit -m "..."` |
| `git log`               | `jj log`             |
| `git push`              | `jj git push`        |
| `git branch`            | `jj bookmark`        |

```bash
jj status
jj diff
jj commit -m "<type>: <description>"
jj log
```
