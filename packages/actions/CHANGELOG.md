# @coldwired/actions

## 0.11.2

### Patch Changes

- dd2239c: fix dispatch event

## 0.11.1

### Patch Changes

- b6797ec: preserve style attribute
- Updated dependencies [b6797ec]
  - @coldwired/utils@0.11.1

## 0.11.0

### Minor Changes

- feat(actions): use data-turbo-force=“browser” instead of data-turbo-permanent

## 0.10.0

### Minor Changes

- - feat(actions): preserve hidden attribute
  - feat(actions): add support for data-turbo-permanent attribute
  - feat(actions): set focus to next focusable element if focused element is removed
  - feat(actions): focusable elements can be grouped together
  - feat(actions): make next focus direction configurable
  - feat(actions): add global helpers

### Patch Changes

- Updated dependencies
  - @coldwired/utils@0.10.0

## 0.9.0

### Minor Changes

- feat(actions): can specify next focused element in actions
  fix(actions): only pause observer if there are actions to apply

## 0.8.1

### Patch Changes

- feat(actions): add debug option
- Updated dependencies
  - @coldwired/utils@0.8.1

## 0.8.0

### Minor Changes

- refactor(actions): start/stop -> observe/disconnect

## 0.7.0

### Minor Changes

- feat(actions): expose materialized actions

## 0.5.0

### Minor Changes

- fix(actions): cleanup pending actions

## 0.4.1

### Patch Changes

- Dispatch events with detail
- Updated dependencies
  - @coldwired/utils@0.4.1

## 0.3.1

### Patch Changes

- Make routes optional
- Updated dependencies
  - @coldwired/utils@0.3.1

## 0.3.0

### Minor Changes

- Add `delay` and `pin` handling
- Improuve batching

### Patch Changes

- Updated dependencies
  - @coldwired/utils@0.3.0

## 0.2.0

### Minor Changes

- Add show/hide
- Preserve attributes

## 0.1.1

### Patch Changes

- Initial release
- Updated dependencies
  - @coldwired/utils@0.1.1
