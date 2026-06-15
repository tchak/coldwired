# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.19.5] - 2026-06-15

### Fixed

- React updates driven by a morph (fragment re-render, stash/adopt, post-morph
  cleanup) now commit synchronously via `flushSync`. coldwired triggers these
  from outside React (the morph lifecycle, microtasks, mutation observers); a
  concurrent root would otherwise leave the commit _scheduled but pending_ when
  it lands during react-aria's own concurrent work, so a value typed into a
  react-aria control right after a `_morph(document.body, …)` would only commit
  after repeated external event-loop turns drained the scheduler. Forcing the
  flush keeps the React tree settled at the end of every morph.

## [0.19.4] - 2026-06-15

### Fixed

- Fragment in-place reconciliation (0.19.3) now also works when the stable id
  lives on a container element wrapping the `<react-fragment>` rather than on
  the fragment itself. The rescue/adopt correlation now keys off a stable
  _anchor_ — the fragment's own id, else its nearest id-bearing ancestor —
  captured from the pristine tree before morphlex runs (morphlex can strip a
  container's id while matching, so the key must be read up front). This covers
  the common react-aria layout where an unkeyed `<react-fragment>` sits inside
  an id'd container nested under unkeyed `<form>`/`<div>` wrappers.

## [0.19.3] - 2026-06-15

### Fixed

- React fragment subtrees are now reconciled in place across a morph even when
  their unkeyed ancestors (e.g. a wrapping `<form>` or `<div>`) are
  restructured by the server. Previously such a morph could tear down and
  re-create the fragment, producing a brand-new DOM node — dropping any state
  bound to the old node (a react-aria controlled input would lose its event
  bindings and drop keystrokes in the window after re-creation). The morph now
  rescues mounted fragments from a removed subtree and re-adopts them (matched
  by id) wherever the server re-introduces them, preserving the live node and
  its React/react-aria state. Regression introduced in 0.19.0 (morphdom, which
  relocated keyed nodes anywhere in the tree, was replaced by morphlex, which
  only matches within siblings).

## [0.19.2] - 2026-06-15

### Fixed

- A full-document morph (e.g. `turbo_stream.refresh`) no longer removes
  React-rendered DOM that lives outside the server document — most notably
  react-aria overlays (popovers, listboxes) which portal directly into
  `<body>`. Previously, morphing while such an overlay was open (e.g. a
  ComboBox selection that auto-submits a form) removed the overlay's
  React-managed nodes mid-interaction, corrupting react-aria's state and
  leaving the trigger input non-reactive (keystrokes dropped, listbox never
  reopens). The morph now preserves any node React owns (detected via its
  fiber) via `Plugin.shouldPreserveElement`. Regression introduced in 0.19.0.

## [0.19.1] - 2026-06-15

### Added

- The attribute observer now tracks the `open` and `data-fr-opened`
  attributes, so the open/closed state of elements such as `<details>`,
  `<dialog>`, and DSFR components is preserved across morphs.

### Fixed

- A full-document morph (e.g. `turbo_stream.refresh`) no longer removes
  client-only containers created by the React integration's
  `findOrCreateContainerElement` (the React root, react-aria portal targets,
  …). Because these elements are absent from the server-rendered HTML,
  `morphlex` previously treated them as unmatched and removed them, unmounting
  the entire React tree and leaving react-aria controlled inputs dead after the
  first refresh. The morph now preserves them via a new optional plugin hook,
  `Plugin.shouldPreserveElement`. Regression introduced in 0.19.0.
- `data-turbo-force="browser"` now takes precedence over the React plugin's
  in-place re-render: a browser-forced fragment is left untouched instead of
  being re-rendered from the server template (while `data-turbo-force="server"`
  still wins over `browser`).

## [0.19.0] - 2026-05-01

### Changed

- Replaced [`morphdom`](https://github.com/patrick-steele-idem/morphdom) with
  [`morphlex`](https://github.com/morphlex/morphlex) as the underlying morph
  engine. The wrapper around morphlex preserves coldwired's existing behavior
  (state preservation via metadata, `data-turbo-force` attribute, plugin
  integration) but matches elements by `name` / `href` / `src` and id rather
  than by position. This is more semantically correct, but in rare cases
  where the previous behavior relied on morphdom's positional reuse the
  result may differ — use `data-turbo-force="server"` to opt out of
  preservation when you need a clean re-render.
- Bumped runtime and dev dependencies (notably `react-aria-components`).

## [0.18.4] - 2026-04-09

### Changed

- `react` and `react-dom` are now peer dependencies instead of regular
  dependencies, letting consumers pin their own React version.

## [0.18.3] - 2026-04-09

### Removed

- The `pin` option on actions has been removed. Pinned actions were a niche
  feature that complicated action scheduling; pin behavior can be replicated
  at the call site.

### Performance

- Reduced hot-path allocations and DOM walks in the morph and React
  integration, cutting per-update cost noticeably on large fragments.

## [0.18.2] - 2026-04-08

### Added

- HTML comments are now stripped during fragment normalization, so
  comment-laden server output round-trips cleanly through morph.

### Fixed

- Externalized `react-error-boundary` so the browser bundle no longer
  pulls in a `node:module` import that breaks at runtime.

## [0.18.0] - 2026-04-08

Initial release in this repository, imported from the legacy monorepo.
This release consolidates the previously-separate `@coldwired/actions`,
`@coldwired/react`, `@coldwired/turbo-stream`, and `@coldwired/utils`
packages into a single multi-entry `coldwired` package with
`coldwired/actions`, `coldwired/react`, `coldwired/turbo-stream`, and
`coldwired/utils` subpath exports.

[Unreleased]: https://github.com/tchak/coldwired/compare/v0.19.5...HEAD
[0.19.5]: https://github.com/tchak/coldwired/compare/v0.19.4...v0.19.5
[0.19.4]: https://github.com/tchak/coldwired/compare/v0.19.3...v0.19.4
[0.19.3]: https://github.com/tchak/coldwired/compare/v0.19.2...v0.19.3
[0.19.2]: https://github.com/tchak/coldwired/compare/v0.19.1...v0.19.2
[0.19.1]: https://github.com/tchak/coldwired/compare/v0.19.0...v0.19.1
[0.19.0]: https://github.com/tchak/coldwired/compare/v0.18.4...v0.19.0
[0.18.4]: https://github.com/tchak/coldwired/compare/v0.18.3...v0.18.4
[0.18.3]: https://github.com/tchak/coldwired/compare/v0.18.2...v0.18.3
[0.18.2]: https://github.com/tchak/coldwired/compare/v0.18.0...v0.18.2
[0.18.0]: https://github.com/tchak/coldwired/releases/tag/v0.18.0
