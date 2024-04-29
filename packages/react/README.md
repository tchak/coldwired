# @coldwired/react [![npm package][npm-badge]][npm]

[npm-badge]: https://img.shields.io/npm/v/@coldwired/react.svg
[npm]: https://www.npmjs.com/package/@coldwired/react

## Why?

## Usage

### Setup

You need to create a react root and a plugin that you will register with your `Actions` instance.

```ts
import { Actions } from '@coldwired/actions';
import { createRoot, createReactPlugin } from '@coldwired/react';

const root = createRoot(document.getElementById('react-root'), {
  loader: (name) => import(`./${name}.js`).default,
});
const plugin = createReactPlugin({ root });
const actions = new Actions({ element: document.body, plugins: [plugin] });
actions.observe();
await actions.ready();
```
