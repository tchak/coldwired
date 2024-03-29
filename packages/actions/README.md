# @coldwired/actions [![npm package][npm-badge]][npm]

[npm-badge]: https://img.shields.io/npm/v/@coldwired/actions.svg
[npm]: https://www.npmjs.com/package/@coldwired/actions

## Why?
Initial inspiration was [turbo-stream](https://turbo.hotwired.dev/handbook/streams), which allows
for the application of incremental changes to the page. The problem we faced was that applying
changes wiped out client changes and it was not always practical to propagate the client state
necessary for rendering to the server. We wanted to be able to preserve some state, such as open
dialogs an menus or input values.

## How?
`Actions` will create a `MutationObserver` and a `WeakMap` of some of the DOM state, such as class
names, aria attributes, and input values. This allows it to preserve state across morph changes. You
always have the possibility to force a state update through the attribute `data-turbo-force`.

## Usage
### Action
An action is an object describing a DOM operation. Actions can be fully serialized to carry them
over the wire ([turbo-stream](https://turbo.hotwired.dev/handbook/streams)).

```ts
type Action = {
  action: 'after' | 'before' | 'append' | 'prepend' | 'replace' | 'update' | 'remove' | 'focus' | 'enable' | 'disable' | 'hide' | 'show';
  targets: Element[] | string;
  fragment?: DocumentFragment | string;
  delay?: number;
  pin?: boolean;
}
```

### Setup
Before you start working with actions, you need to create and register an instance of `Actions`.
After that, actions can be applied through the `Actions` instance or dispatched as events. We also
provide an implementation of [turbo-stream](https://turbo.hotwired.dev/handbook/streams) on top of
`Actions` through the [@coldwired/turbo-stream](https://www.npmjs.com/package/@coldwired/turbo-stream)
package.

```ts
import { Actions } from '@coldwired/actions';

const actions = new Actions({ element: document.body });
actions.observe();
```

### DOM manipulation
```ts
// Insert a fragment after each target element
actions.after({ targets: '.item', fragment: '<p>Hello World</p>' });

// Insert a fragment before each target element
actions.before({ targets: '.item', fragment: '<p>Hello World</p>' });

// Append a fragment after the last child of each target element
actions.append({ targets: '.item', fragment: '<p>Hello World</p>' });

// Prepend a fragment before the first child of each target element
actions.prepend({ targets: '.item', fragment: '<p>Hello World</p>' });

// Replace every target element with the fragment.
// Uses morph to preserve interactive state
actions.replace({ targets: '.item', fragment: '<p>Hello World</p>' });

// Update every target inner with the fragment.
// Uses morph to preserve interactive state
actions.update({ targets: '.item', fragment: '<p>Hello World</p>' });

// Remove all target elements
actions.remove({ targets: '.item' });

// Focus first target element
actions.focus({ targets: '.item' });

// Disable all target elements
actions.disable({ targets: '.item' });

// Enable all target elements
actions.enable({ targets: '.item' });

// Hide all target elements
actions.hide({ targets: '.item' });

// Show all target elements
actions.show({ targets: '.item' });

// Apply actions in batch. This is the low level API
actions.applyActions([
  {
    action: 'update',
    targets: '.item-to-update',
    fragment: '<p>Hello World</p>'
  },
  {
    action: 'remove',
    targets: '.item-to-remove',
  },
])
```

### Dispatch from anywhere
If you want to dispatch actions from places where you don't have access to the `Actions` instance,
you can use global API.

```ts
import * as Actions from '@coldwired/actions';

Actions.after({ targets: '.item', fragment: '<p>Hello World</p>' });

// Same as `applyActions` but you don't need access to the instance
Actions.dispatchActions([
  {
    action: 'update',
    targets: '.item-to-update',
    fragment: '<p>Hello World</p>'
  },
  {
    action: 'remove',
    targets: '.item-to-remove',
  },
]);
```

### Delayed actions
You can add a delay to any action, which is useful for hiding flash messages after a short period of
time, for example.

```ts
// Hide targets after 2 seconds delay
actions.hide({ targets: '.item', delay: 2000 });
```

### Pinned actions
An action can be pinned — this is mostly useful in combination with full-page morph.

```ts
// In some client code append a new warning
actions.append({ targets: '.warnings', fragment: '<p>Warning !</p>', pin: true });

// Later, refresh the whole page. It will wipe out the warning added earlier.
// By running `applyPinnedActions`, you can restore previous changes
actions.morph(document, newDocument);
actions.applyPinnedActions();

// When you navigate to a new page, you might want to reset any pinned actions
actions.reset();
```
